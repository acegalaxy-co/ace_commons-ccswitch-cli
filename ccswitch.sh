#!/usr/bin/env bash
# ccswitch — swap Claude Code auth profile.
# Only replaces the `env` block in ~/.claude/settings.json; leaves everything else intact.
#
# Profiles (priority order):
#   9router  (DEFAULT)  https://9router.acegalaxy.co/v1   — remote router
#   local               http://127.0.0.1:20128/v1         — local router (fallback 1)
#   original            https://api.anthropic.com          — Anthropic direct (fallback 2)
#
# Aliases: router->local, direct->original (backward compat).
#
# Usage:
#   ccswitch              # show current + health of all profiles
#   ccswitch 9router      # remote router (default)
#   ccswitch local        # local :20128 router
#   ccswitch original     # straight to api.anthropic.com
#   ccswitch check        # probe health of every profile
#   ccswitch fallback     # pick first healthy profile in order 9router->local->original
#   ccswitch clear        # remove the env block (revert to Anthropic-direct default)
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
PROFILES="$CLAUDE_DIR/profiles"

# priority order used by `status` and `fallback`
ORDER=(9router local original)

die() { echo "❌ $*" >&2; exit 1; }

# resolve alias -> canonical profile name
canon() {
  case "$1" in
    router)  echo local ;;
    direct)  echo original ;;
    *)       echo "$1" ;;
  esac
}

# probe a profile's base url /models endpoint; echoes http code
probe() {
  local prof="$PROFILES/$1.json"
  [ -f "$prof" ] || { echo "000"; return; }
  local base tok key auth vers
  base=$(jq -r '.ANTHROPIC_BASE_URL // "https://api.anthropic.com"' "$prof" 2>/dev/null)
  tok=$(jq -r '.ANTHROPIC_AUTH_TOKEN // empty' "$prof" 2>/dev/null || true)
  key=$(jq -r '.ANTHROPIC_API_KEY // empty' "$prof" 2>/dev/null || true)
  auth="${tok:-$key}"
  # api.anthropic.com answers /v1/models only with the anthropic-version header;
  # without it a healthy endpoint false-reports DOWN.
  vers=""; case "$base" in *api.anthropic.com*) vers=1 ;; esac
  local code
  code=$(curl -s -m 4 "${base%/}/models" \
    ${auth:+-H "Authorization: Bearer $auth"} \
    ${key:+-H "x-api-key: $key"} \
    ${vers:+-H "anthropic-version: 2023-06-01"} \
    -o /dev/null -w "%{http_code}" 2>/dev/null)
  [ -n "$code" ] && echo "$code" || echo "000"
}

current() {
  local base
  base=$(jq -r '.env.ANTHROPIC_BASE_URL // "https://api.anthropic.com (original)"' "$SETTINGS")
  echo "current base: $base"
}

apply() {
  local name; name=$(canon "$1")
  local prof="$PROFILES/$name.json"
  [ -f "$prof" ] || die "profile not found: $prof"
  [ -f "$SETTINGS" ] || die "settings not found: $SETTINGS"
  jq empty "$prof" 2>/dev/null || die "profile $prof is not valid JSON"
  cp "$SETTINGS" "$SETTINGS.bak"
  jq --slurpfile e "$prof" '.env = $e[0]' "$SETTINGS.bak" > "$SETTINGS.tmp" \
    || die "jq merge failed (settings unchanged, see $SETTINGS.bak)"
  mv "$SETTINGS.tmp" "$SETTINGS"
  echo "✅ switched to '$name' profile (backup: $SETTINGS.bak)"
  if [ "$name" = "original" ] && jq -e '.env.ANTHROPIC_API_KEY // "" | test("fill-me")' "$SETTINGS" >/dev/null 2>&1; then
    echo "⚠️  original profile still has placeholder key — edit $PROFILES/original.json then re-run."
  fi
  echo "↻ restart Claude Code (quit + reopen) to load new env."
}

case "${1:-status}" in
  9router|local|original|router|direct)
    name=$(canon "$1"); c=$(probe "$name")
    [ "$c" = "200" ] || echo "⚠️  '$name' health=$c (not 200) — switching anyway, may be down"
    apply "$name" ;;
  check)
    for p in "${ORDER[@]}"; do
      c=$(probe "$p"); echo "  $p: $c $([ "$c" = 200 ] && echo OK || echo DOWN)"
    done ;;
  fallback)
    for p in "${ORDER[@]}"; do
      c=$(probe "$p")
      if [ "$c" = "200" ]; then echo "→ first healthy: $p"; apply "$p"; exit 0; fi
      echo "  $p down ($c), trying next…"
    done
    die "all profiles down — no healthy endpoint" ;;
  clear)
    [ -f "$SETTINGS" ] || die "settings not found: $SETTINGS"
    cp "$SETTINGS" "$SETTINGS.bak"
    jq 'del(.env)' "$SETTINGS.bak" > "$SETTINGS.tmp" \
      || die "jq del failed (settings unchanged, see $SETTINGS.bak)"
    mv "$SETTINGS.tmp" "$SETTINGS"
    echo "✅ removed env block (backup: $SETTINGS.bak) — reverts to Anthropic-direct default."
    echo "↻ restart Claude Code (quit + reopen) to load new env." ;;
  status|"")
    current
    for p in "${ORDER[@]}"; do
      c=$(probe "$p"); echo "  $p: $c $([ "$c" = 200 ] && echo OK || echo DOWN)"
    done
    echo "profiles: $(ls "$PROFILES" 2>/dev/null | sed 's/\.json//' | tr '\n' ' ')" ;;
  *)
    die "usage: ccswitch [9router|local|original|check|fallback|clear|status]" ;;
esac
