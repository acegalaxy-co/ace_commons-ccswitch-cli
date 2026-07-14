#!/usr/bin/env bash
# SessionStart hook — probe the currently-active router endpoint, warn (do NOT auto-switch).
# Fires for both remote 9router and local router; skips Anthropic-direct.
set -uo pipefail

SETTINGS="$HOME/.claude/settings.json"

command -v jq >/dev/null 2>&1 || exit 0
[ -f "$SETTINGS" ] || exit 0

base=$(jq -r '.env.ANTHROPIC_BASE_URL // empty' "$SETTINGS" 2>/dev/null)
# direct-to-Anthropic (no custom base) → nothing to check
case "$base" in
  *9router.acegalaxy.co*|*127.0.0.1:20128*|*localhost:20128*) ;;
  *) exit 0 ;;
esac

tok=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN // .env.ANTHROPIC_API_KEY // empty' "$SETTINGS" 2>/dev/null || true)
code=$(curl -s -m 4 "${base%/}/models" ${tok:+-H "Authorization: Bearer $tok"} \
         -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [ "$code" != "200" ]; then
  echo "⚠️  router (${base}) health=${code} — có thể đang DOWN." >&2
  echo "   Auto-fallback:  ccswitch fallback   (9router → local → original)" >&2
  echo "   Hoặc chỉ định:  ccswitch local | ccswitch original  rồi restart Claude Code." >&2
fi
exit 0
