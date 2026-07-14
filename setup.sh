#!/usr/bin/env bash
# ccswitch setup (macOS / Linux).
# Installs ccswitch.sh + profile templates + SessionStart health hook into ~/.claude,
# then wires a `ccswitch` shell alias. Never overwrites existing profiles that already
# hold real keys — templates are only copied when the target file is missing.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
PROFILES="$CLAUDE_DIR/profiles"
HOOKS="$CLAUDE_DIR/hooks"

echo "▶ ccswitch setup — installing into $CLAUDE_DIR"

command -v jq  >/dev/null 2>&1 || { echo "❌ 'jq' required. Install: brew install jq  (mac) / apt install jq (linux)"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "❌ 'curl' required."; exit 1; }

mkdir -p "$PROFILES" "$HOOKS"

# 1. tool + hook (always refreshed — no secrets inside)
cp "$SRC/ccswitch.sh"        "$CLAUDE_DIR/ccswitch.sh"
cp "$SRC/hooks/check-router.sh" "$HOOKS/check-router.sh"
chmod +x "$CLAUDE_DIR/ccswitch.sh" "$HOOKS/check-router.sh"
echo "  ✓ ccswitch.sh + hooks/check-router.sh"

# 2. profile templates — copy ONLY if missing (never clobber real keys)
for p in 9router local original; do
  if [ -f "$PROFILES/$p.json" ]; then
    echo "  • profiles/$p.json exists — kept (edit manually to update key)"
  else
    cp "$SRC/profiles/$p.json" "$PROFILES/$p.json"
    echo "  ✓ profiles/$p.json (template — fill in your key)"
  fi
done

# 3. ensure settings.json exists + wire SessionStart hook idempotently
SETTINGS="$CLAUDE_DIR/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
HOOK_CMD="bash ~/.claude/hooks/check-router.sh"
if ! jq -e --arg c "$HOOK_CMD" \
     '.hooks.SessionStart[]?.hooks[]? | select(.command == $c)' "$SETTINGS" >/dev/null 2>&1; then
  cp "$SETTINGS" "$SETTINGS.bak"
  jq --arg c "$HOOK_CMD" '
    .hooks //= {} |
    .hooks.SessionStart //= [] |
    .hooks.SessionStart += [ { "hooks": [ { "type": "command", "command": $c } ] } ]
  ' "$SETTINGS.bak" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
  echo "  ✓ wired SessionStart health hook into settings.json"
else
  echo "  • SessionStart hook already wired — skipped"
fi

# 4. shell alias
SHELL_RC="$HOME/.zshrc"; [ -n "${BASH_VERSION:-}" ] && SHELL_RC="$HOME/.bashrc"
ALIAS_LINE="alias ccswitch='bash ~/.claude/ccswitch.sh'"
if ! grep -qF "$ALIAS_LINE" "$SHELL_RC" 2>/dev/null; then
  echo "$ALIAS_LINE" >> "$SHELL_RC"
  echo "  ✓ added alias to $SHELL_RC (run: source $SHELL_RC)"
else
  echo "  • alias already in $SHELL_RC — skipped"
fi

echo
echo "✅ Installed. Next steps:"
echo "   1. Fill your key:   \$EDITOR ~/.claude/profiles/9router.json   (replace <your-9router-key>)"
echo "   2. Activate:        source $SHELL_RC && ccswitch 9router"
echo "   3. Restart Claude Code (quit + reopen) to load the new env."
