#!/usr/bin/env bash
# Claude Code UserPromptSubmit hook — check session/weekly limit % BEFORE action.
# Enforces the project's orchestrator/session-budget rule (adapt thresholds/rule-path
# reference below to whatever your project's rule doc is called, if any).
# Output: inject tier + guidance into AI context. Exit 0 always (advisory).

set -u

# harness off-switch — set HARNESS_DELEGATE=0 in .claude/settings.local.json to disable
[ "${HARNESS_DELEGATE:-1}" = "0" ] && exit 0

# Resolve repo + cache dirs
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" 2>/dev/null || REPO="."
CACHE_DIR="${HOME}/.cache/claude-code-@@PROJECT_SLUG@@"
mkdir -p "$CACHE_DIR" 2>/dev/null || true

CACHE_FILE="$CACHE_DIR/session-pct.json"
CACHE_TTL=300  # 5 minutes — realtime check to catch >80% threshold before HARD lock

# Try to read % from cache (if fresh)
get_cached_pct() {
  if [[ -f "$CACHE_FILE" ]]; then
    local ts_now=$(date +%s)
    local ts_cache=$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
    local age=$((ts_now - ts_cache))
    if (( age < CACHE_TTL )); then
      jq -r '.session_pct, .weekly_pct' "$CACHE_FILE" 2>/dev/null | paste -sd, - | tr -d '\n'
    fi
  fi
  return 0
}

# Try to read % from env vars (user manual override)
get_env_pct() {
  local sp="${CLAUDE_SESSION_PCT:-}"
  local wp="${CLAUDE_WEEKLY_PCT:-}"
  if [[ -n "$sp" || -n "$wp" ]]; then
    echo "$sp,$wp"
  fi
  return 0
}

# Fallback: ask user
prompt_user() {
  cat >&2 << 'PROMPT'

⚠️  **Session/Weekly limit % unknown — check Account & Usage in Claude Code UI.**

Hook needs % to apply orchestrator tier. Options:

1. **Supply now:** Reply with `session=X% weekly=Y%` (vd: `session=42% weekly=68%`). Hook caches for 30 min.
2. **Set env:** `export CLAUDE_SESSION_PCT=X CLAUDE_WEEKLY_PCT=Y` before next session.
3. **Continue anyway:** Hook will skip tier check this turn (advisory, not blocking).

Docs: project's session-budget rule (Session > 80% HARD, Weekly > 85% soft) — see your rule doc if you have one.

PROMPT
}

# Parse & return
SESSION_PCT=""
WEEKLY_PCT=""

# Try cache first
cached=$(get_cached_pct)
if [[ -n "$cached" ]]; then
  SESSION_PCT=$(echo "$cached" | cut -d, -f1)
  WEEKLY_PCT=$(echo "$cached" | cut -d, -f2)
fi

# Fallback to env
if [[ -z "$SESSION_PCT" && -z "$WEEKLY_PCT" ]]; then
  env_pct=$(get_env_pct)
  if [[ -n "$env_pct" ]]; then
    SESSION_PCT=$(echo "$env_pct" | cut -d, -f1 | tr -d '%')
    WEEKLY_PCT=$(echo "$env_pct" | cut -d, -f2 | tr -d '%')
  fi
fi

# If still unknown, ask user (but don't block)
if [[ -z "$SESSION_PCT" && -z "$WEEKLY_PCT" ]]; then
  prompt_user
  exit 0
fi

# Apply tier logic (Session/Weekly thresholds — adjust to your own rule doc if it differs)
determine_tier() {
  local sp="${SESSION_PCT:-0}"
  local wp="${WEEKLY_PCT:-0}"

  sp="${sp%\%}"  # strip % if present
  wp="${wp%\%}"

  # Convert to numeric (default 0 if empty)
  sp="${sp:-0}"
  wp="${wp:-0}"

  local session_tier="normal"
  local weekly_tier="normal"

  # Session tiers
  if (( sp > 80 )); then
    session_tier="orchestrator-hard"
  elif (( sp >= 50 )); then
    session_tier="cautious"
  fi

  # Weekly tiers
  if (( wp > 85 )); then
    weekly_tier="orchestrator-soft"
  elif (( wp >= 70 )); then
    weekly_tier="cautious"
  fi

  # Tier interaction: higher wins
  if [[ "$session_tier" == "orchestrator-hard" ]]; then
    echo "orchestrator-hard"
  elif [[ "$weekly_tier" == "orchestrator-soft" && "$session_tier" != "normal" ]]; then
    # Weekly soft + Session cautious/higher → cautious (lower of two)
    echo "$session_tier"
  elif [[ "$weekly_tier" == "orchestrator-soft" ]]; then
    echo "orchestrator-soft"
  elif [[ "$session_tier" == "cautious" || "$weekly_tier" == "cautious" ]]; then
    echo "cautious"
  else
    echo "normal"
  fi
}

TIER=$(determine_tier)

# Normal tier → stay silent (free flow, no context cost every turn).
# Only emit guidance when tier ≥ cautious (actual warning needed).
if [[ "$TIER" == "normal" ]]; then
  exit 0
fi

# Emit guidance based on tier
cat >&2 << EOF

─────────────────────────────────────────────────────────────
📊 Session/Weekly Budget Check
─────────────────────────────────────────────────────────────

Session: ${SESSION_PCT}%  |  Weekly: ${WEEKLY_PCT}%  |  Tier: ${TIER}

EOF

case "$TIER" in
  orchestrator-hard)
    cat >&2 << 'HARD'
⚠️  **ORCHESTRATOR HARD MODE — Session > 80%**

Action protocol:
  ❌ KHÔNG execute trực tiếp (edit, grep, bash, deploy, build, test).
  ✅ CHỈ làm: phân rã task → giao delegate-{deepseek,codex,gemini} → review output → synthesize.

Exception (main agent OK):
  1. TodoWrite / planning (không tool execution)
  2. 1-line git (commit, push, tag)
  3. Read single file <50 lines
  4. Synthesize delegate output → user report

Delegate routing:
  • Read-only audit / cross-file         → delegate-gemini
  • Edit + mechanical / boilerplate      → delegate-deepseek
  • Edit/review + hard reasoning / algo  → delegate-codex

Fallback: codex FAIL → deepseek → STOP (không escalate Claude).

Session reset trong ~5 phút. Switch Orchestrator mode đến lúc đó.
HARD
    ;;
  orchestrator-soft)
    cat >&2 << 'SOFT'
⚠️  **ORCHESTRATOR SOFT MODE — Weekly > 85%**

Action protocol:
  • Ưu tiên delegate task lớn (audit, batch refactor, summarize).
  • Claude main giữ cho: review, design, debug subtle, synthesis.

Delegate candidates:
  • Batch refactor, code cleanup  → delegate-deepseek
  • Cross-file audit, summary     → delegate-gemini
  • Complex reasoning, security   → delegate-codex (khi cần)

weekly reset trong ~${WEEKLY_RESET_DAYS:-1-2} ngày.
SOFT
    ;;
  cautious)
    cat >&2 << 'CAUTIOUS'
⚠️  **CAUTIOUS MODE — 50% ≤ Session < 80% hoặc 70% ≤ Weekly < 85%**

Action protocol:
  • Normal flow, nhưng ưu tiên delegate cho task lớn (>3 file, >30 dòng code).
  • Đọc memory + reference trước khi re-read source (giảm token burn).
  • Suggest `/compact` nếu task switch nhiều lần.
CAUTIOUS
    ;;
  normal)
    cat >&2 << 'NORMAL'
✅ NORMAL MODE — Session/Weekly thấp, free flow.
NORMAL
    ;;
esac

cat >&2 << 'EOF'

─────────────────────────────────────────────────────────────
EOF

exit 0
