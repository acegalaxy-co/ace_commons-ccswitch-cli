#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash).
# Block raw `git push`. Force it through /git-push-safety (test + gitleaks +
# /check-hardcode + user confirm). The gate itself pushes with the bypass
# token GIT_PUSH_GATE_OK=1 prefixed — that's the only sanctioned path.
#
# exit 0 → allow · exit 2 → block (stderr shown to model)
set -euo pipefail

# harness off-switch
[ "${HARNESS_DELEGATE:-1}" = "0" ] && exit 0

payload=$(cat)
command -v jq >/dev/null 2>&1 || exit 0   # fail-open (consistent w/ other gates)

cmd=$(echo "$payload" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

# Bypass: gate (or user) already ran the safety pipeline.
echo "$cmd" | grep -Eq 'GIT_PUSH_GATE_OK=1' && exit 0

# Match `git push` allowing global flags: git, git -C dir, git --no-pager …
if echo "$cmd" | grep -Eq '(^|[;&|]|[[:space:]])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^[:space:]-]+)?)*[[:space:]]+push([[:space:]]|$)'; then
  echo "🚨 pre-bash-git-push-gate: raw 'git push' bị chặn." >&2
  echo "Chạy /git-push-safety (test + gitleaks + /check-hardcode + hỏi confirm) thay vì push thẳng." >&2
  echo "Nếu đã qua gate và user đã confirm, push với prefix: GIT_PUSH_GATE_OK=1 git push ..." >&2
  exit 2
fi

exit 0
