#!/usr/bin/env bash
# SessionStart hook — (1) LUÔN in banner: endpoint đang chạy + thứ tự fallback + hướng dẫn.
# (2) Nếu đang ở router mà endpoint timeout/lỗi → AUTO-SWITCH (ccswitch fallback).
#
# NOTE: Claude Code loads env at process launch, BEFORE this hook. A switch here heals
# ~/.claude/settings.json for the NEXT start; the CURRENT session may still use the old
# endpoint until you Reload Window / restart. Mid-session API errors cannot be auto-
# switched (no on-error hook) — that belongs to router-level upstream failover.
#
# Disable auto-switch (chỉ cảnh báo): export CCSWITCH_NO_AUTO=1
set -uo pipefail

CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
CCSWITCH="$CLAUDE_DIR/ccswitch.sh"

command -v jq >/dev/null 2>&1 || exit 0

# Endpoint session thực dùng: ưu tiên env (Claude Code truyền xuống hook), fallback settings.json.
base="${ANTHROPIC_BASE_URL:-}"
if [ -z "$base" ] && [ -f "$SETTINGS" ]; then
  base=$(jq -r '.env.ANTHROPIC_BASE_URL // empty' "$SETTINGS" 2>/dev/null || true)
fi

case "$base" in
  *9router.acegalaxy.co*)                 name="9router (remote router)" ;;
  *127.0.0.1:20128*|*localhost:20128*)    name="local (router :20128)" ;;
  ""|*api.anthropic.com*)                 name="original (Anthropic-direct)" ;;
  *)                                      name="custom" ;;
esac

# ── Banner (LUÔN in, câu đầu session) ─────────────────────────────
{
  echo "━━━ ccswitch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Endpoint đang chạy: ${name}${base:+  ($base)}"
  echo "  Fallback (khi router chết): 9router → local → original"
  echo "    • original = safe-harbor: LUÔN về được (cần key sk-ant- thật để không lỗi)"
  echo "  Lệnh: ccswitch [check | 9router | local | original | fallback | clear]"
  echo "        đổi endpoint xong → RESTART Claude Code (env nạp lúc khởi động)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} >&2

# ── Health probe + auto-switch (chỉ cho router) ───────────────────
command -v curl >/dev/null 2>&1 || exit 0
[ -f "$SETTINGS" ] || exit 0
case "$base" in
  *9router.acegalaxy.co*|*127.0.0.1:20128*|*localhost:20128*) ;;
  *) exit 0 ;;   # original/custom → không có "cấp trên" để fallback
esac

tok=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN // .env.ANTHROPIC_API_KEY // empty' "$SETTINGS" 2>/dev/null || true)
[ -n "${ANTHROPIC_AUTH_TOKEN:-}" ] && tok="$ANTHROPIC_AUTH_TOKEN"
code=$(curl -s -m 4 "${base%/}/models" ${tok:+-H "Authorization: Bearer $tok"} \
         -o /dev/null -w "%{http_code}" 2>/dev/null); [ -n "$code" ] || code="000"

# healthy → nothing more to do
[ "$code" = "200" ] && { echo "  ✓ health=200 OK" >&2; exit 0; }

# unhealthy. Warn-only when disabled or tool missing.
if [ "${CCSWITCH_NO_AUTO:-}" = "1" ] || [ ! -x "$CCSWITCH" ]; then
  echo "⚠️  router (${base}) health=${code} — có thể đang DOWN." >&2
  echo "   Chạy:  ccswitch fallback   rồi restart Claude Code." >&2
  exit 0
fi

echo "⚠️  router (${base}) health=${code} (timeout/lỗi) — auto-switching:" >&2
out="$(bash "$CCSWITCH" fallback 2>&1)"; rc=$?
echo "$out" | sed 's/^/   /' >&2
if [ "$rc" -eq 0 ]; then
  echo "   ↻ restart Claude Code (quit + reopen) / Reload Window để nạp endpoint mới." >&2
else
  echo "   ❌ Không có endpoint healthy — kiểm tra router hoặc điền key profiles/original.json." >&2
fi
exit 0
