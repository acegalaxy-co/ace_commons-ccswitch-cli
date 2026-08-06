#!/usr/bin/env bash
# cai-dat.sh — cài 1 LẦN, dùng MÃI: wire MemoryOS vào ~/.claude GLOBAL (mọi project, mọi session).
# Khác install-memory.sh (per-project, settings.local.json) — cai-dat.sh ghi ~/.claude/settings.json
# + ~/.claude/CLAUDE.md 1 LẦN, không cần chạy lại cho từng dự án.
# Dùng: bash "<đường-dẫn-vault>/cai-dat.sh"
#       bash cai-dat.sh --self-check    # kiểm tra khô, không đụng vault thật
#       bash cai-dat.sh --go-remove     # gỡ hook + env + CLAUDE.md pointer khỏi ~/.claude
set -euo pipefail

VAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKER="ai-memory-kit"
CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"
CLAUDE_MD_MARKER="<!-- ai-memory-kit -->"

# ---------------------------------------------------------------------------
# 1. Preflight
# ---------------------------------------------------------------------------
preflight() {
  if ! command -v node >/dev/null 2>&1; then
    echo "❌ Không tìm thấy 'node' trong PATH." >&2
    echo "   Cài Node.js (bản LTS) tại: https://nodejs.org rồi chạy lại." >&2
    exit 1
  fi
  local ver major
  ver="$(node -e 'console.log(process.versions.node)')"
  major="${ver%%.*}"
  if [ "$major" -lt 18 ]; then
    echo "❌ node hiện tại là v$ver — cần >= 18." >&2
    echo "   Cài bản mới tại: https://nodejs.org" >&2
    exit 1
  fi
  if [ ! -w "$VAULT" ] || [ ! -r "$VAULT" ]; then
    echo "❌ Vault không đọc/ghi được: $VAULT" >&2
    exit 1
  fi
  if ! printf '%s' "$VAULT" | grep -qE 'CloudStorage|Google Drive|Shared drives'; then
    echo "⚠️  Vault ($VAULT) có vẻ KHÔNG nằm trong Google Drive/Shared drive." >&2
    echo "   Khuyến nghị đặt vault trên Drive để cả team tự sync — vẫn tiếp tục cài." >&2
  fi
}

# ---------------------------------------------------------------------------
# 2. HANDBOOK.md chung team
# ---------------------------------------------------------------------------
ensure_handbook() {
  if [ ! -f "$VAULT/HANDBOOK.md" ]; then
    cp "$VAULT/HANDBOOK.template.md" "$VAULT/HANDBOOK.md"
    echo "✅ HANDBOOK.md tạo mới từ template: $VAULT/HANDBOOK.md"
    echo "👉 Nhớ điền các mục ⚙️ trong đó (lằn ranh đỏ, quyết định riêng team)."
  else
    echo "ℹ️  HANDBOOK.md đã có, không đụng."
  fi
}

# ---------------------------------------------------------------------------
# 3. Wire settings.json + CLAUDE.md — node script làm merge JSON (không jq)
# ---------------------------------------------------------------------------
wire_settings() {
  mkdir -p "$CLAUDE_DIR"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

  node "$VAULT/tools/wire-global-settings.mjs" "$VAULT" "$SETTINGS" "$HOME"
}

ensure_claude_md_pointer() {
  mkdir -p "$CLAUDE_DIR"
  touch "$CLAUDE_MD"
  if grep -qF "$CLAUDE_MD_MARKER" "$CLAUDE_MD" 2>/dev/null; then
    echo "ℹ️  ~/.claude/CLAUDE.md: đã có pointer ai-memory-kit."
    return
  fi
  {
    echo ""
    echo "$CLAUDE_MD_MARKER"
    echo "🧠 **Bộ nhớ (MemoryOS):** vault tại \`$VAULT\`."
    echo "   Đọc PHÂN TẦNG: Tầng 0 (HANDBOOK.md) → INDEX nhóm liên quan → mảnh cụ thể. KHÔNG quét cả kho."
    echo "   Business rules nằm ở \`$VAULT/Memories/\` — vào \`Memories/MEMORY.md\` trước để tra nhóm."
    echo "$CLAUDE_MD_MARKER"
  } >> "$CLAUDE_MD"
  echo "✅ ~/.claude/CLAUDE.md: đã thêm pointer."
}

# ---------------------------------------------------------------------------
# 4. Smoke sau cài (fail-open)
# ---------------------------------------------------------------------------
smoke() {
  echo "🩺 Chạy memory-doctor smoke test..."
  if ! MEMORY_ROOT="$VAULT" MEMORY_GIT_MIRROR="$HOME/MemoryGitMirror" MEMORY_BACKUP_DIR="$HOME/MemoryBackups" \
      node "$VAULT/tools/memory-doctor.mjs" --no-snapshot >/dev/null 2>&1; then
    echo "⚠️  memory-doctor báo lỗi (không chặn cài đặt) — chạy tay: node \"$VAULT/tools/memory-doctor.mjs\" để xem chi tiết." >&2
  else
    echo "✅ memory-doctor: OK"
  fi
}

# ---------------------------------------------------------------------------
# --self-check
# ---------------------------------------------------------------------------
self_check() {
  local fail=0
  echo "== self-check (HOME=$HOME) =="

  wire_settings >/dev/null
  ensure_claude_md_pointer >/dev/null

  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$SETTINGS" 2>/dev/null; then
    echo "PASS: settings.json hợp lệ JSON"
  else
    echo "FAIL: settings.json KHÔNG hợp lệ JSON"; fail=1
  fi

  local count1 count2
  count1="$(node "$VAULT/tools/count-hooks.mjs" "$SETTINGS" "$VAULT" 2>/dev/null || echo -1)"
  wire_settings >/dev/null
  count2="$(node "$VAULT/tools/count-hooks.mjs" "$SETTINGS" "$VAULT" 2>/dev/null || echo -1)"
  if [ "$count1" = "4" ] && [ "$count2" = "4" ]; then
    echo "PASS: chạy 2 lần không nhân đôi hook (4 = 4)"
  else
    echo "FAIL: hook count lần1=$count1 lần2=$count2 (kỳ vọng 4/4)"; fail=1
  fi

  local mcount
  mcount="$(grep -cF "$CLAUDE_MD_MARKER" "$CLAUDE_MD" 2>/dev/null || echo 0)"
  if [ "$mcount" = "2" ]; then
    echo "PASS: CLAUDE.md có đúng 1 block marker (2 dòng mở/đóng)"
  else
    echo "FAIL: CLAUDE.md marker count=$mcount (kỳ vọng 2)"; fail=1
  fi

  if node "$VAULT/tools/check-env.mjs" "$SETTINGS" "$VAULT" "$HOME" 2>/dev/null; then
    echo "PASS: env keys đúng giá trị"
  else
    echo "FAIL: env keys sai giá trị"; fail=1
  fi

  if [ "$fail" = "0" ]; then
    echo "== self-check: ALL PASS =="
    return 0
  else
    echo "== self-check: FAIL =="
    return 1
  fi
}

# ---------------------------------------------------------------------------
# --go-remove
# ---------------------------------------------------------------------------
go_remove() {
  if [ -f "$SETTINGS" ]; then
    node "$VAULT/tools/unwire-global-settings.mjs" "$VAULT" "$SETTINGS"
    echo "✅ Đã gỡ hook + env khỏi $SETTINGS"
  fi
  if [ -f "$CLAUDE_MD" ]; then
    node -e '
      const fs = require("fs");
      const path = process.argv[1];
      const marker = process.argv[2];
      const txt = fs.readFileSync(path, "utf8");
      const lines = txt.split("\n");
      const out = [];
      let inBlock = false;
      for (const l of lines) {
        if (l.trim() === marker) { inBlock = !inBlock; continue; }
        if (!inBlock) out.push(l);
      }
      fs.writeFileSync(path, out.join("\n").replace(/\n{3,}/g, "\n\n"));
    ' "$CLAUDE_MD" "$CLAUDE_MD_MARKER"
    echo "✅ Đã gỡ pointer khỏi $CLAUDE_MD"
  fi
  echo "Xong. (HANDBOOK.md và vault KHÔNG bị đụng.)"
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
case "${1:-}" in
  --self-check)
    preflight
    self_check
    exit $?
    ;;
  --go-remove)
    go_remove
    exit 0
    ;;
esac

preflight
ensure_handbook
wire_settings
ensure_claude_md_pointer
smoke

echo ""
echo "===== Xong — cài 1 lần, dùng mãi ====="
echo "Từ giờ mọi project trên máy này, Claude Code tự đọc vault: $VAULT"
echo "Gỡ cài đặt: bash \"$VAULT/cai-dat.sh\" --go-remove"
