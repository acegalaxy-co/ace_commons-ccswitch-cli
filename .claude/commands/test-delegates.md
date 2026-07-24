---
name: test-delegates
description: Smoke-test each delegate subagent backend (codex, deepseek, gemini) end-to-end — reachability, which model actually answered, and latency — then report a pass/fail table. Use when user says "test delegate agents", "kiểm tra delegate model", "test codex/deepseek/gemini", or runs /test-delegates.
user-invocable: true
---

# test-delegates — smoke test delegate CLI backends

Runs one minimal, real call through each delegate wrapper (not a mock) to
confirm the CLI is installed, authenticated, and returns a coherent response
from the backend the harness actually routes to. Never touches real project
files — the Gemini/DeepSeek smoke calls run inside their normal isolated
worktree and that worktree + branch are force-cleaned at the end of this
command regardless of outcome, since they're scaffolding created by this
command in the same run, not user work.

## 0. Preflight

Run:
```
scripts/delegate/doctor.sh
```
Report the pass/fail table verbatim. If a CLI (`codex`/`gemini`/`aider`) is
missing or its env keys don't resolve, mark that delegate SKIPPED in the
final report and do not attempt its smoke call.

## 1. Codex (review mode — read-only, no worktree)

```
time scripts/delegate/run-codex.sh smoke-test "Reply with exactly this text and nothing else: CODEX_OK" review
```
- Capture stdout (the reply) and stderr (`delegate_log` lines show which
  endpoint/model answered: 9router `cx/gpt-...` or OpenAI direct).
- PASS if stdout contains `CODEX_OK`. Record elapsed time from `time`.

## 2. Gemini (wrapper only supports edit mode — worktree required)

```
time scripts/delegate/run-gemini.sh smoke-test-gemini "Create a file named DELEGATE_SMOKE_TEST.txt in the current directory containing exactly this text and nothing else: GEMINI_OK"
```
- Wrapper prints `WORKTREE=<path>` on stdout; `delegate_log` lines on stderr
  show the model (`$GEMINI_MODEL`).
- PASS if `<worktree>/DELEGATE_SMOKE_TEST.txt` exists and contains
  `GEMINI_OK`. Record elapsed time.
- Cleanup (always, pass or fail):
  ```
  git worktree remove --force .worktrees/delegate-gemini/smoke-test-gemini
  git branch -D delegate/delegate-gemini-smoke-test-gemini
  ```

## 3. DeepSeek (Aider — edit mode, worktree required, needs a target file arg)

```
time scripts/delegate/run-aider-deepseek.sh smoke-test-deepseek "Create a file with exactly this content and nothing else: DEEPSEEK_OK" DELEGATE_SMOKE_TEST.txt
```
- `delegate_log` lines on stderr show endpoint (9router vs api.deepseek.com
  direct) and `$DEEPSEEK_MODEL`.
- PASS if `<worktree>/DELEGATE_SMOKE_TEST.txt` contains `DEEPSEEK_OK`.
  Record elapsed time.
- Cleanup (always, pass or fail):
  ```
  git worktree remove --force .worktrees/delegate-deepseek/smoke-test-deepseek
  git branch -D delegate/delegate-deepseek-smoke-test-deepseek
  ```

## 4. Cleanup note

These worktrees/branches are throwaway scaffolding this command creates and
destroys in the same run — force-delete without asking, unlike the
branch-cleanup rule that requires confirmation for real `feat/`/`fix/`
branches. If a smoke call failed before creating a worktree/branch, skip the
corresponding cleanup step silently (don't error on a missing target).

## 5. Report

Present one table:

| Delegate | Backend / model | Reachable | Output correct | Latency | Notes |
|---|---|---|---|---|---|
| codex | `<from stderr log>` | yes/no | yes/no | `<time>` | `<9router / OpenAI direct>` |
| gemini | `<GEMINI_MODEL>` | yes/no | yes/no | `<time>` | `<oauth account / api key>` |
| deepseek | `<DEEPSEEK_MODEL>` | yes/no | yes/no | `<time>` | `<9router / api.deepseek.com>` |

Below the table, one line per delegate SKIPPED at preflight and why. Report
facts only — no recommendations beyond what the table shows.
