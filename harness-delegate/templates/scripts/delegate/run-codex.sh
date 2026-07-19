#!/usr/bin/env bash
# Delegate hard reasoning / algo / deep security task to Codex CLI (OpenAI o-series).
# Usage: run-codex.sh <feat-slug> "<task>" [edit|review]
#   edit   → runs in worktree, codex may modify files (no auto-commit)
#   review → read-only, codex outputs analysis text
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$DIR/_common.sh"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <feat-slug> \"<task>\" [edit|review]" >&2
  exit 1
fi

FEAT="$1"; TASK="$2"; MODE="${3:-review}"

load_env_chain
# Codex CLI: typically authed via `codex login` (ChatGPT) or OPENAI_API_KEY env.

delegate_log codex "mode: $MODE"

if [[ "$MODE" == "edit" ]]; then
  WT="$(ensure_worktree delegate-codex "$FEAT")"
  delegate_log codex "worktree: $WT"
  trap 'delegate_log codex "exit trap — cleaning empty worktree if clean"; cleanup_worktree_if_clean "$WT"' EXIT
  cd "$WT"
  # exec mode = non-interactive single-shot; auto-edit allowed inside worktree only.
  codex exec --full-auto "$TASK"
  delegate_log codex "diff summary:"
  git -C "$WT" diff --stat >&2 || true
  echo "WORKTREE=$WT"
else
  # Read-only review: run from repo root, no file changes.
  cd "$REPO_ROOT"
  codex exec --sandbox read-only "$TASK"
fi
