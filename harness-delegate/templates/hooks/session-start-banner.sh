#!/usr/bin/env bash
# Claude Code SessionStart hook — announce orchestrator-gate (+ session-budget rule
# if you wired check-session-limit.sh too). Fire 1 per session start. Exit 0 advisory.

set -u

# harness off-switch — set HARNESS_DELEGATE=0 in .claude/settings.local.json to disable
[ "${HARNESS_DELEGATE:-1}" = "0" ] && exit 0

cat >&2 << 'EOF'

═══════════════════════════════════════════════════════════════════════════
🚦 Orchestrator Gate ACTIVE (.claude/rules/orchestrator.md)
═══════════════════════════════════════════════════════════════════════════

Opus = pure orchestrator. Trước MỖI execution: tuyên bố [nhãn] → target.
  • [S: 1-line/config/plan/read<50] → Opus tự làm
  • [M mechanical] → delegate-deepseek   • [read-only] → delegate-gemini
  • [L/XL execute] → delegate-sonnet (fb: delegate-codex)

HARD GATE: main-agent Edit/Write vào @@CORE_DIRS_HUMAN@@ bị chặn (exit 2).
  Subagent edit OK. Size-S 1-line thật → ORCHESTRATOR_GATE_BYPASS=1.
  Hook: .claude/hooks/pre-edit-orchestrator-gate.sh

═══════════════════════════════════════════════════════════════════════════
📊 Session-Budget Rule (nếu đã cài check-session-limit.sh — optional group)
═══════════════════════════════════════════════════════════════════════════

Mỗi turn sẽ check session/weekly limit % trước action (nếu hook được wire).

Hooks:
  • SessionStart (1x)           → .claude/hooks/session-start-banner.sh
  • UserPromptSubmit (mỗi turn) → .claude/hooks/check-session-limit.sh

Hook đọc % từ:
  1. Cache ~/.cache/claude-code-@@PROJECT_SLUG@@/session-pct.json (TTL 5 min)
  2. Env var CLAUDE_SESSION_PCT / CLAUDE_WEEKLY_PCT
  3. Fallback → prompt user reply "session=X% weekly=Y%"

Rule tiers:
  • Normal (Session <50%, Weekly <70%)
  • Cautious (50–80% / 70–85%)
  • Orchestrator soft (Weekly >85%, Session <80%)  ← Weekly thắng
  • Orchestrator HARD (Session >80%)               ← HARD is strongest — tier cao thắng

Chi tiết tier: xem rule session-budget của project (nếu có), hoặc adapt threshold theo ý bạn.

═══════════════════════════════════════════════════════════════════════════

EOF

# C — audit surfacing: nếu gate từng chặn, cho biết đã chặn bao nhiêu lần (all-time).
GATE_LOG="${HOME}/.cache/claude-code-@@PROJECT_SLUG@@/orchestrator-gate.log"
if [ -f "$GATE_LOG" ]; then
  n_block=$(grep -c ' BLOCK ' "$GATE_LOG" 2>/dev/null); n_block=${n_block:-0}
  n_bypass=$(grep -c ' BYPASS ' "$GATE_LOG" 2>/dev/null); n_bypass=${n_bypass:-0}
  if [ "${n_block:-0}" -gt 0 ] || [ "${n_bypass:-0}" -gt 0 ]; then
    echo "🚦 orchestrator-gate history: ${n_block} block · ${n_bypass} bypass (${GATE_LOG})" >&2
  fi
fi

exit 0
