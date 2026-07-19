#!/usr/bin/env bash
# Delegate edit task to Gemini CLI inside an isolated worktree.
# Usage: run-gemini.sh <feat-slug> "<task prompt>" [context-file...]
# Output: prints worktree path + diff summary; never auto-commits.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$DIR/_common.sh"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <feat-slug> \"<task>\" [context-file...]" >&2
  exit 1
fi

FEAT="$1"; TASK="$2"; shift 2

load_env_chain
# Gemini CLI uses OAuth by default; GEMINI_API_KEY optional override.

WT="$(ensure_worktree delegate-gemini "$FEAT")"
delegate_log gemini "worktree: $WT"
trap 'delegate_log gemini "exit trap — cleaning empty worktree if clean"; cleanup_worktree_if_clean "$WT"' EXIT

# Model: default to a stable Gemini model unless overridden.
# Override per-call: GEMINI_MODEL=<id>.
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-pro}"
delegate_log gemini "model: $GEMINI_MODEL"

# P0 deny-list: never pump secret-bearing files into prompts.
is_secret_path() {
  case "$1" in
    *.env|*.env.*|*/.env|*/.env.*|*/_vault_/*|_vault_/*|*/.env-bootstrap|.env-bootstrap) return 0 ;;
    *id_rsa*|*id_ed25519*|*.pem|*.key|*credentials*.json) return 0 ;;
  esac
  return 1
}

# Build context block from optional paths (cap each file to keep prompt sane).
CTX=""
for p in "$@"; do
  if is_secret_path "$p"; then
    delegate_log gemini "REFUSED secret-bearing path: $p"
    exit 2
  fi
  if [[ -f "$p" ]]; then
    CTX+=$'\n\n--- FILE: '"$p"$' ---\n'
    CTX+="$(head -c 200000 "$p")"
  elif [[ -d "$p" ]]; then
    CTX+=$'\n\n--- DIR LISTING: '"$p"$' ---\n'
    CTX+="$(find "$p" -maxdepth 3 -type f | head -200)"
  fi
done

FULL_PROMPT="$TASK"
[[ -n "$CTX" ]] && FULL_PROMPT="$TASK"$'\n'"$CTX"

cd "$WT"

# Agentic edit mode: gemini reads+edits files in cwd (the worktree).
# --approval-mode auto_edit auto-approves edit tools only (not arbitrary shell) —
# safer than --yolo. P0: pass prompt via -p argv is required for agentic mode
# (stdin -p - is single-shot text-only, no tool use); worktree isolation is the
# containment boundary instead of avoiding argv (prompt has no secrets — see deny-list above).
gemini -p "$FULL_PROMPT" --approval-mode auto_edit -m "$GEMINI_MODEL"

delegate_log gemini "diff summary:"
git -C "$WT" diff --stat >&2 || true
echo "WORKTREE=$WT"
