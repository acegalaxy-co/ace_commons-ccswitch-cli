#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash).
# Bịt 2 lỗ mà pre-edit-orchestrator-gate.sh (matcher Edit|Write) KHÔNG cover —
# MAIN agent (orchestrator — mọi model) né gate bằng Bash:
#   (A) Direct-CLI bypass: gõ thẳng aider/gemini/codex → mất worktree isolation
#       + secret redaction của delegate wrapper (per .claude/rules/delegate-llm.md).
#   (B) Bash-write vào core source (@@CORE_DIRS_HUMAN@@) qua redirect / sed -i /
#       tee / patch / git apply / python -c ... → né orchestrator gate hoàn toàn.
#
# THREAT MODEL: chống Opus *lười/nhầm vô ý*, KHÔNG chống adversary. Đây là
# command-string heuristic, không phải sandbox — chuỗi obfuscate (eval, base64,
# biến gián tiếp) lách được. Đúng threat model: Opus không phải kẻ tấn công.
#
# Discriminator main vs subagent: agent_id (chỉ có ở subagent) — giống
# pre-edit-orchestrator-gate.sh. Subagent Bash → luôn allow.
#
# Escape hatch (A không có bypass — isolation boundary; B có):
#   ORCHESTRATOR_GATE_BYPASS=1  → allow Bash-write core + ghi audit log.
#
# Output: exit 0 = allow · exit 2 = block (stderr shown to model).
# Fail-open: thiếu jq / payload không JSON → allow (nhất quán gate Edit|Write).
set -euo pipefail

# harness off-switch — set HARNESS_DELEGATE=0 in .claude/settings.local.json to disable
[ "${HARNESS_DELEGATE:-1}" = "0" ] && exit 0

LOG="${HOME}/.cache/claude-code-@@PROJECT_SLUG@@/orchestrator-gate.log"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
ts() { date '+%Y-%m-%dT%H:%M:%S'; }

payload=$(cat)

command -v jq >/dev/null 2>&1 || exit 0
printf '%s' "$payload" | jq empty >/dev/null 2>&1 || exit 0

cmd=$(echo "$payload"      | jq -r '.tool_input.command // empty')
agent_id=$(echo "$payload" | jq -r '.agent_id // empty')

[ -z "$cmd" ] && exit 0

# 1) Subagent Bash → luôn allow (delegate wrapper tự chạy CLI hợp lệ trong đây).
[ -n "$agent_id" ] && exit 0

# 2) Direct-CLI bypass — chặn aider/gemini/codex gọi như command word từ main.
#    KHÔNG có bypass (isolation boundary, giống risk-path). Anchor vào vị trí
#    command (đầu chuỗi / sau ; && || | ( / sau env|sudo|time|xargs) để tránh
#    match path/substring (vd "gemini/foo", "mycodex").
if echo "$cmd" | grep -Eq '(^|[;&|(]|&&|\|\||[[:space:]](env|sudo|time|xargs|nice|nohup)[[:space:]])[[:space:]]*(aider|gemini|codex)([[:space:]]|$)'; then
  echo "$(ts) BLOCK main-agent direct-CLI → ${cmd:0:120}" >> "$LOG" 2>/dev/null || true
  cat >&2 << 'EOF'
🚦 orchestrator-gate: MAIN agent KHÔNG gọi thẳng aider/gemini/codex qua Bash.
   Bypass delegate wrapper = mất worktree isolation + secret redaction.

   Rule: .claude/rules/delegate-llm.md — route qua persona subagent (Task tool):
     • delegate-codex   (hard-reasoning-code / security-sensitive)
     • delegate-sonnet  (L/XL execute)
     • delegate-deepseek (M mechanical / batch)
     • delegate-gemini  (read-only audit / cross-file)

   Không có bypass cho nhánh này (isolation boundary, không phải size-S convenience).
EOF
  exit 2
fi

# 3) Escape hatch cho Bash-write core (size-S 1-line thật sự).
if [ "${ORCHESTRATOR_GATE_BYPASS:-}" = "1" ]; then
  echo "$(ts) BYPASS main-agent bash-write → ${cmd:0:120}" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# 4) Bash-write vào core source. Mỗi pattern tự-đủ (đã bao hàm "target = core"):
#    core dir alternation = @@CORE_DIRS_ALT@@ (vd src|lib). Rỗng → skip (no core).
ALT='@@CORE_DIRS_ALT@@'
if [ -n "$ALT" ]; then
  P=(
    "(>>?|[0-9]+>)[[:space:]]*(\./)?($ALT)/"          # redirect vào core (kể cả 2> src/)
    "\bsed\b.*(-i|--in-place).*($ALT)/"               # sed inplace target core
    "\btee\b[[:space:]].*(\./)?($ALT)/"               # tee ghi file core
    "\bpatch\b.*($ALT)/"                              # patch chạm core
    "\bgit[[:space:]]+apply\b.*($ALT)/"               # git apply patch core
    "\bdd\b.*of=[\"']?(\./)?($ALT)/"                  # dd of= core
    "\b(perl|ruby)\b.*-i.*($ALT)/"                    # perl/ruby inplace core
    "\bpython[0-9.]*\b.*-c\b.*($ALT)/"                # python -c ... core
    "\b(cp|mv|install|rsync)\b.*[[:space:]](\./)?($ALT)/[^[:space:]]*[[:space:]]*$"  # dest = core (arg cuối)
  )
  for pat in "${P[@]}"; do
    if echo "$cmd" | grep -Eq "$pat"; then
      echo "$(ts) BLOCK main-agent bash-write → ${cmd:0:120}" >> "$LOG" 2>/dev/null || true
      cat >&2 << EOF
🚦 orchestrator-gate: MAIN agent (orchestrator — mọi model) KHÔNG ghi vào source core qua Bash.
   Command: ${cmd:0:160}

   Rule: .claude/rules/orchestrator.md — Opus = pure orchestrator. Edit core
   (@@CORE_DIRS_HUMAN@@) PHẢI route qua delegate subagent (Task tool):
     • L/XL algo / refactor / fix sau chẩn đoán → delegate-sonnet (fb: delegate-codex)
     • M mechanical / batch edit / boilerplate   → delegate-deepseek

   Nếu ĐÚNG size-S (1-line + 0 read context), chạy lại với:
     ORCHESTRATOR_GATE_BYPASS=1
EOF
      exit 2
    fi
  done
fi

exit 0
