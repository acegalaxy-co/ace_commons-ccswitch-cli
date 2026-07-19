#!/usr/bin/env bats
# harness-delegate/install.sh: interactive installer that copies the
# orchestrator/delegate mechanism (subagents + hooks) into another project.
# Non-interactive mode is driven entirely via HARNESS_* env vars (see the
# header comment in harness-delegate/install.sh) — every test below uses that,
# never real stdin/terminal prompts.

load test_helper.bash

setup() {
  ROOT="$(repo_root)"
  TARGET="$BATS_TEST_TMPDIR/target-repo"
  mkdir -p "$TARGET"
  git init -q "$TARGET"
  git -C "$TARGET" config user.email test@test.com
  git -C "$TARGET" config user.name test
}

run_install() {
  HARNESS_ROUTE_DIR="$TARGET" \
  HARNESS_CORE_DIRS="src,lib" \
  HARNESS_PROJECT_SLUG="testproj" \
  HARNESS_BRANCH="dev" \
  HARNESS_TEST_CMD="npm test" \
  HARNESS_GROUP_SUBAGENTS="Y" \
  HARNESS_GROUP_GUARD="Y" \
  HARNESS_GROUP_QUALITY="Y" \
  HARNESS_GROUP_SESSIONLIMIT="N" \
  HARNESS_OVERWRITE="all" \
  run bash "$ROOT/harness-delegate/install.sh" </dev/null
}

@test "installs 3 default groups: files land, no @@ tokens, settings.json wired" {
  run_install
  [ "$status" -eq 0 ]

  # subagents + wrappers
  [ -f "$TARGET/.claude/agents/delegate-deepseek.md" ]
  [ -f "$TARGET/.claude/agents/delegate-sonnet.md" ]
  [ -f "$TARGET/scripts/delegate/_common.sh" ]
  [ -x "$TARGET/scripts/delegate/run-gemini.sh" ]

  # guard + quality hooks
  [ -x "$TARGET/.claude/hooks/pre-edit-orchestrator-gate.sh" ]
  [ -x "$TARGET/.claude/hooks/pre-edit-secret-scan.sh" ]
  [ -x "$TARGET/.claude/hooks/post-edit-syntax-check.sh" ]
  [ -x "$TARGET/.claude/hooks/session-start-banner.sh" ]

  # session-limit group was declined — must NOT be installed
  [ ! -e "$TARGET/.claude/hooks/check-session-limit.sh" ]

  # no leftover placeholder tokens or 9router-specific hardcoding
  ! grep -rq '@@' "$TARGET"
  ! grep -rq 'open-sse\|ace_9router\|claude-code-9router\|decolua' "$TARGET"

  # settings.json valid + hooks wired under the right events
  run jq empty "$TARGET/.claude/settings.json"
  [ "$status" -eq 0 ]
  pre_count=$(jq '.hooks.PreToolUse[0].hooks | length' "$TARGET/.claude/settings.json")
  [ "$pre_count" -eq 2 ]
  post_cmd=$(jq -r '.hooks.PostToolUse[0].hooks[0].command' "$TARGET/.claude/settings.json")
  [[ "$post_cmd" == *"post-edit-syntax-check.sh" ]]
  session_cmd=$(jq -r '.hooks.SessionStart[0].hooks[0].command' "$TARGET/.claude/settings.json")
  [[ "$session_cmd" == *"session-start-banner.sh" ]]

  # slug substitution actually happened
  grep -q 'claude-code-testproj' "$TARGET/.claude/hooks/pre-edit-orchestrator-gate.sh"
}

@test "re-running is idempotent — no duplicate hook entries" {
  run_install
  [ "$status" -eq 0 ]
  first_len=$(jq '.hooks.PreToolUse[0].hooks | length' "$TARGET/.claude/settings.json")

  run_install
  [ "$status" -eq 0 ]
  second_len=$(jq '.hooks.PreToolUse[0].hooks | length' "$TARGET/.claude/settings.json")
  events_len=$(jq '.hooks.PreToolUse | length' "$TARGET/.claude/settings.json")

  [ "$first_len" -eq "$second_len" ]
  [ "$events_len" -eq 1 ]
}
