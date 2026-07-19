#!/usr/bin/env bash
# Delegate edit task to Aider + DeepSeek inside an isolated worktree.
# Usage: run-aider-deepseek.sh <feat-slug> "<task spec>" <file1> [file2 ...]
# Output: prints worktree path + diff summary; never auto-commits.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$DIR/_common.sh"

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <feat-slug> \"<task>\" <file...>" >&2
  exit 1
fi

FEAT="$1"; TASK="$2"; shift 2

load_env_chain
require_env DEEPSEEK_API_KEY

WT="$(ensure_worktree delegate-deepseek "$FEAT")"
DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek/deepseek-v4-pro}"
delegate_log deepseek "worktree: $WT"
delegate_log deepseek "model: $DEEPSEEK_MODEL"
trap 'delegate_log deepseek "exit trap — cleaning empty worktree if clean"; cleanup_worktree_if_clean "$WT"' EXIT

cd "$WT"

# Aider headless: no auto-commit, no git suggestions, no analytics, single shot.
# P0: pass key via env (aider auto-detects DEEPSEEK_API_KEY) — never via argv (leaks to `ps aux`).
export DEEPSEEK_API_KEY
aider \
  --model "$DEEPSEEK_MODEL" \
  --yes-always \
  --no-auto-commits \
  --no-analytics \
  --no-show-model-warnings \
  --message "$TASK" \
  "$@"

delegate_log deepseek "diff summary:"
git -C "$WT" diff --stat >&2 || true
echo "WORKTREE=$WT"
