#!/usr/bin/env bash
# SessionStart hook — probe the currently-active router endpoint; if it times out or
# errors, AUTO-SWITCH to the first healthy profile (runs `ccswitch fallback`).
# Fires for both remote 9router and local router; skips Anthropic-direct.
#
# NOTE: Claude Code loads env at process launch, BEFORE this hook. A switch here heals
# ~/.claude/settings.json for the NEXT start; the CURRENT session may still use the old
# endpoint until you Reload Window / restart. Mid-session API errors cannot be auto-
# switched (no on-error hook) — that belongs to router-level upstream failover.
#
# Disable auto-switch (warn only): export CCSWITCH_NO_AUTO=1
set -uo pipefail

CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
CCSWITCH="$CLAUDE_DIR/ccswitch.sh"

command -v jq   >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
[ -f "$SETTINGS" ] || exit 0

base=$(jq -r '.env.ANTHROPIC_BASE_URL // empty' "$SETTINGS" 2>/dev/null)
# direct-to-Anthropic (no custom base) → nothing to check
case "$base" in
  *9router.acegalaxy.co*|*127.0.0.1:20128*|*localhost:20128*) ;;
  *) exit 0 ;;
esac

tok=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN // .env.ANTHROPIC_API_KEY // empty' "$SETTINGS" 2>/dev/null || true)
code=$(curl -s -m 4 "${base%/}/models" ${tok:+-H "Authorization: Bearer $tok"} \
         -o /dev/null -w "%{http_code}" 2>/dev/null); [ -n "$code" ] || code="000"

# healthy → nothing to do
[ "$code" = "200" ] && exit 0

# unhealthy (timeout=000 or error code). Warn-only when disabled or tool missing.
if [ "${CCSWITCH_NO_AUTO:-}" = "1" ] || [ ! -x "$CCSWITCH" ]; then
  echo "⚠️  router (${base}) health=${code} — có thể đang DOWN." >&2
  echo "   Auto-fallback:  ccswitch fallback   (9router → local → original)" >&2
  echo "   Hoặc chỉ định:  ccswitch local | ccswitch original  rồi restart Claude Code." >&2
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
