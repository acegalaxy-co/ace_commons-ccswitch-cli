#!/usr/bin/env bash
# Shared helpers for LLM delegate wrappers (deepseek/gemini/codex).
# Loaded via: source "$(dirname "$0")/_common.sh"
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a git repository — refusing to run" >&2
  exit 1
}

# Load env chain (delegate wrapper scope only) — provide LLM API keys for
# Aider/Codex/Gemini CLI. @@PROJECT_SLUG@@ runtime code does NOT read via this
# function; it reads its own config from wherever the project's app config lives.
# Order: .env.local → .env. Only if files exist. Never echo values.
load_env_chain() {
  local f
  for f in .env.local .env; do
    if [[ -f "$REPO_ROOT/$f" ]]; then
      # Manual parser — `set -a; source` fails on values with unquoted spaces.
      while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
          local k="${BASH_REMATCH[1]}" v="${BASH_REMATCH[2]}"
          [[ "$v" =~ ^\"(.*)\"$ ]] && v="${BASH_REMATCH[1]}"
          [[ "$v" =~ ^\'(.*)\'$ ]] && v="${BASH_REMATCH[1]}"
          export "$k=$v"
        fi
      done < "$REPO_ROOT/$f"
    fi
  done

  # CLIs (Aider/Codex/Gemini) expect generic env names. These are read
  # straight from the .env chain above; nothing to alias. Kept explicit
  # so `set -u` downstream doesn't trip on unset vars.
  : "${DEEPSEEK_API_KEY:=}"
  : "${OPENAI_API_KEY:=}"
  : "${ANTHROPIC_API_KEY:=}"
  # GEMINI_USE_OAUTH=1 → route Gemini CLI via OAuth Workspace + GOOGLE_CLOUD_PROJECT
  # (Code Assist paid tier). Skip alias so CLI doesn't see an API key.
  if [[ "${GEMINI_USE_OAUTH:-0}" != "1" ]]; then
    : "${GEMINI_API_KEY:=${GOOGLE_API_KEY:-}}"
    : "${GOOGLE_API_KEY:=${GEMINI_API_KEY:-}}"
    export GEMINI_API_KEY GOOGLE_API_KEY
  else
    unset GEMINI_API_KEY GOOGLE_API_KEY
  fi
  export DEEPSEEK_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY
}

# Ensure isolated agent worktree.
# Usage: ensure_worktree <agent-id> <feat-slug>  → echoes worktree path to stdout.
ensure_worktree() {
  local agent_id="$1" feat="${2:-adhoc}"
  # P0 security: agent-id + feat-slug alphanumeric + dash/underscore only.
  # Prevents path traversal (`../`) and git branch name injection.
  if [[ ! "$agent_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: agent-id invalid chars (alphanumeric/-/_ only): $agent_id" >&2
    return 1
  fi
  if [[ ! "$feat" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: feat-slug invalid chars (alphanumeric/-/_ only): $feat" >&2
    return 1
  fi
  local wt="$REPO_ROOT/.worktrees/$agent_id/$feat"
  local branch="delegate/$agent_id-$feat"
  if [[ ! -d "$wt" ]]; then
    mkdir -p "$(dirname "$wt")"
    git -C "$REPO_ROOT" worktree add -b "$branch" "$wt" HEAD >&2
  else
    # P1: refuse to reuse a dirty worktree — contamination risk.
    if ! git -C "$wt" diff --quiet || ! git -C "$wt" diff --cached --quiet; then
      echo "ERROR: worktree $wt is dirty — clean or remove before re-running" >&2
      return 1
    fi
  fi
  echo "$wt"
}

# Cleanup a worktree if it has no changes (idempotent best-effort).
cleanup_worktree_if_clean() {
  local wt="$1"
  [[ -d "$wt" ]] || return 0
  if git -C "$wt" diff --quiet && git -C "$wt" diff --cached --quiet \
     && [[ -z "$(git -C "$wt" status --porcelain)" ]]; then
    delegate_log cleanup "removing empty worktree: $wt"
    git -C "$REPO_ROOT" worktree remove --force "$wt" >&2 || true
  fi
}

# Require a non-empty env var without printing its value.
require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: env $name not set (add it to .env / .env.local)" >&2
    return 1
  fi
}

# Log line to stderr with timestamp + delegate id.
delegate_log() {
  local id="$1"; shift
  printf '[delegate:%s %s] %s\n' "$id" "$(date +%H:%M:%S)" "$*" >&2
}
