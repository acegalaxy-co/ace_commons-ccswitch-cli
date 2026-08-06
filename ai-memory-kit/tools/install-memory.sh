#!/usr/bin/env bash
# install-memory.sh — wire MemoryOS hooks + CLAUDE.md pointer + memory group into a target project.
# Dùng: bash install-memory.sh [project-path]
#       bash install-memory.sh --self-check
set -euo pipefail

VAULT="$(cd "$(dirname "$0")/.." && pwd)"
SELF_CHECK="${MEMOS_SELF_CHECK:-0}"

# ---------------------------------------------------------------------------
# do_install PROJECT — core install logic, factored out so --self-check can
# exercise it twice (idempotency) against a tmp dir without touching the
# real vault Memories/ tree.
# ---------------------------------------------------------------------------
do_install() {
  local PROJECT="$1"
  local PROJECT_NAME SETTINGS TMP_JSON GROUP

  if [ ! -d "$PROJECT" ]; then
    echo "❌ PROJECT không tồn tại: $PROJECT" >&2
    exit 1
  fi
  PROJECT="$(cd "$PROJECT" && pwd)"
  PROJECT_NAME="$(basename "$PROJECT")"

  # --- 1. hooks in settings.local.json --------------------------------
  mkdir -p "$PROJECT/.claude"
  SETTINGS="$PROJECT/.claude/settings.local.json"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

  TMP_JSON="$(mktemp)"
  if ! jq \
    --arg vault "$VAULT/tools/" \
    --arg cleanup "node \"$VAULT/tools/cleanup-nudge.mjs\"" \
    --arg gate "node \"$VAULT/tools/handbook-gate.mjs\"" \
    --arg nudge "node \"$VAULT/tools/pre-work-nudge.mjs\"" \
    --arg autofix "node \"$VAULT/tools/memory-autofix.mjs\"" \
    '
    # strip any existing MemoryOS hook entries (whose inner command references
    # this vault tools/ dir) from every event, drop now-empty events, then
    # append the fresh 4.
    .hooks = ((.hooks // {}) | with_entries(
        .value = [ .value[] | select(
          ([.hooks[]?.command // empty] | map(contains($vault)) | any) | not
        ) ]
      )
      | with_entries(select(.value | length > 0))
    )
    | .hooks.SessionStart = ((.hooks.SessionStart // []) + [ { hooks: [ { type: "command", command: $cleanup } ] } ])
    | .hooks.PreToolUse   = ((.hooks.PreToolUse   // []) + [ { matcher: "Edit|Write|MultiEdit", hooks: [ { type: "command", command: $gate } ] } ])
    | .hooks.UserPromptSubmit = ((.hooks.UserPromptSubmit // []) + [ { hooks: [ { type: "command", command: $nudge } ] } ])
    | .hooks.Stop         = ((.hooks.Stop         // []) + [ { hooks: [ { type: "command", command: $autofix } ] } ])
    ' "$SETTINGS" > "$TMP_JSON"
  then
    echo "❌ jq thất bại khi cập nhật $SETTINGS (giữ nguyên file gốc)" >&2
    rm -f "$TMP_JSON"
    exit 1
  fi
  mv "$TMP_JSON" "$SETTINGS"
  echo "✅ hooks: $SETTINGS"

  # --- 2. CLAUDE.md pointer --------------------------------------------
  local CLAUDE_MD="$PROJECT/CLAUDE.md"
  if [ ! -f "$CLAUDE_MD" ]; then
    sed -e "s/&lt;Tên repo&gt;/$PROJECT_NAME/" \
        -e 's/&lt;/</g' -e 's/&gt;/>/g' \
      "$VAULT/templates/CLAUDE.template.md" > "$CLAUDE_MD"
    echo "✅ CLAUDE.md tạo mới: $CLAUDE_MD"
  elif ! grep -qF '🧠 **Bộ nhớ:**' "$CLAUDE_MD"; then
    {
      echo ""
      echo "🧠 **Bộ nhớ:** đọc nhóm \`Memories/$PROJECT_NAME/INDEX.md\`. (Tủ gốc + luật làm việc đã nạp sẵn từ sổ tay Tầng 0.)"
    } >> "$CLAUDE_MD"
    echo "✅ CLAUDE.md: đã thêm pointer"
  else
    echo "ℹ️  CLAUDE.md: đã có pointer"
  fi

  # --- 3. memory group (skip during --self-check) -----------------------
  GROUP="$PROJECT_NAME"
  if [ "$SELF_CHECK" != "1" ]; then
    if [ ! -d "$VAULT/Memories/$GROUP" ]; then
      node "$VAULT/tools/ghi-manh.mjs" "$GROUP" tong-quan "Tổng quan $GROUP" reference reference
      echo "✅ memory group tạo: Memories/$GROUP/"
    else
      echo "ℹ️  memory group đã tồn tại: Memories/$GROUP/"
    fi
    echo "👉 Thêm vào Memories/MEMORY.md: - ⚪ **$GROUP** — <mô tả 1 dòng> → $GROUP/INDEX.md"
  fi

  # --- 4. handbook warning ----------------------------------------------
  if [ ! -f "$VAULT/HANDBOOK.md" ]; then
    echo "⚠️  CẢNH BÁO: $VAULT/HANDBOOK.md chưa tồn tại (chỉ có HANDBOOK.template.md)." >&2
    echo "   handbook-gate hook sẽ CHẶN sửa memory tới khi tạo HANDBOOK.md (copy từ template + điền)." >&2
  fi
}

# ---------------------------------------------------------------------------
if [ "${1:-}" = "--self-check" ]; then
  MEMOS_SELF_CHECK=1
  SELF_CHECK=1
  T="$(mktemp -d)"
  fail() { echo "❌ self-check FAIL: $1" >&2; rm -rf "$T"; exit 1; }

  do_install "$T" > /dev/null

  [ -f "$T/.claude/settings.local.json" ] || fail "settings.local.json không tồn tại"
  jq empty "$T/.claude/settings.local.json" 2>/dev/null || fail "settings.local.json không phải JSON hợp lệ"

  for ev in SessionStart PreToolUse UserPromptSubmit Stop; do
    jq -e --arg vault "$VAULT/tools/" --arg ev "$ev" \
      '(.hooks[$ev] // []) | map(.hooks[]?.command // empty) | any(contains($vault))' \
      "$T/.claude/settings.local.json" > /dev/null \
      || fail "thiếu hook event $ev"
  done

  COUNT="$(jq --arg vault "$VAULT/tools/" \
    '[.hooks[][]?.hooks[]?.command | select(contains($vault))] | length' \
    "$T/.claude/settings.local.json")"
  [ "$COUNT" = "4" ] || fail "số hook MemoryOS = $COUNT, kỳ vọng 4 (lần 1)"

  # run twice — idempotency check
  do_install "$T" > /dev/null
  COUNT2="$(jq --arg vault "$VAULT/tools/" \
    '[.hooks[][]?.hooks[]?.command | select(contains($vault))] | length' \
    "$T/.claude/settings.local.json")"
  [ "$COUNT2" = "4" ] || fail "số hook MemoryOS = $COUNT2 sau lần chạy 2 (kỳ vọng 4, có duplicate)"

  [ -f "$T/CLAUDE.md" ] || fail "CLAUDE.md không tồn tại"
  grep -qF '🧠 **Bộ nhớ:**' "$T/CLAUDE.md" || fail "CLAUDE.md thiếu pointer 🧠 Bộ nhớ"

  rm -rf "$T"
  echo "✅ self-check PASS"
  exit 0
fi

# ---------------------------------------------------------------------------
PROJECT="${1:-}"
if [ -z "$PROJECT" ]; then
  read -r -p "Project path [$PWD]: " PROJECT
  PROJECT="${PROJECT:-$PWD}"
fi

do_install "$PROJECT"

echo ""
echo "===== Xong ====="
echo "Follow-up thủ công:"
echo "  1. Nếu chưa có: tạo $VAULT/HANDBOOK.md (copy từ HANDBOOK.template.md, điền)."
echo "  2. Thêm dòng nhóm vào Memories/MEMORY.md (xem gợi ý ở trên)."
