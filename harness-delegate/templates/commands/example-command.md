---
description: Scaffold — copy this file, rename it, replace the body with your project's steps. Not wired to anything until you do.
---

<!--
This is a NEUTRAL example, not a working command. The harness installer copies it
so a new project can see the *shape* of a slash command. To use it:
  1. Copy to a new name, e.g. .claude/commands/deploy-dev.md
  2. Rewrite the `description:` above to say what YOUR command does + when to run it.
  3. Replace every step below with real, ordered commands for your project.
  4. Delete this comment block.

Slash commands are discovered automatically from any .md under .claude/commands/ —
no registration step, unlike hooks (which the installer wires into settings.json).

Why no ready-made deploy-local / deploy-dev / deploy-prod here: deploy is
per-project by nature (host, artifact, secret, restart command differ every
time) and outward-facing (needs user confirmation, the orchestrator keeps it —
it is not delegated). A generic deploy stub would be a hollow file that lies
about being usable. See .claude/skills/deploy-aws-9router for what a REAL,
project-specific deploy looks like.
-->

Run the steps below in order, stopping at the first failure. Report each step's
result as it completes. Do not skip a step or proceed past a failure.

## 1. Preflight (read-only)

State what must be true before the command runs — e.g. on the right branch,
required tool installed, target reachable. Check it; if a check fails, STOP and
tell the user what is missing. No writes in this step.

## 2. The action

The real work: build / test / deploy / whatever this command exists to do.
Show the exact command(s). If it writes anywhere outward-facing (a remote host,
a package registry, a production branch), ask the user for explicit
confirmation BEFORE the first write — approval for one run does not carry to the
next.

## 3. Verify

Prove the action worked by observing behavior, not by assuming success. Run a
check that would FAIL loudly if step 2 half-worked (curl the deployed endpoint,
re-read the written file, run the smoke test).

## 4. Report

Tell the user what changed, where, and the verify result. Mask any secret in
output (see rule `secrets-no-printout`). If a rollback path exists (a `.bak`, a
previous tag), name it.
