---
name: git-workflow
description: Branch strategy (dev/main/stable/prod) + working-branch discipline, merge gate, prod deploy confirm, worktree lifecycle, cleanup-sau-merge. P0 guardrail cho mọi git op có tính destructive/outward-facing.
status: live
updated: 2026-07-19
metadata:
  type: reference
---

# Git Workflow (project: ccswitch)

Bổ sung [[git-conventions]] (org default + commit format). Phần này = branching + merge/deploy guardrail.

## Branching strategy

- **main** — branch chính, nhận merge từ `dev`.
- **dev** — branch phát triển, làm việc hàng ngày.
- **stable** — branch ổn định, CHỈ merge từ `main` hoặc `dev`, KHÔNG push trực tiếp.
- **prod** — branch deploy AWS production, CHỈ merge từ `dev`, KHÔNG push trực tiếp.

## Working branch (QUAN TRỌNG)

- **CHỈ sửa trực tiếp trên `dev`.** KHÔNG sửa trên `main`/`stable`/`prod`/`feat/*`/`fix/*` trừ khi user yêu cầu rõ.
- Nhận task mới → check `git branch --show-current` trước → khác `dev` thì checkout `dev` (trừ khi user chỉ định).
- Merge về `main`/`stable`/`prod` chỉ khi user xác nhận. Sau merge → cleanup ở dưới.

## Merge to main

- **KHÔNG tự động merge `dev` → `main`.** Chỉ khi user nói rõ ("merge main", "đẩy lên main").
- Trước merge check commit gần nhất trên `main` (`git log -1 --format=%ct main`):
  - Gap < **20 phút** → in **WARNING: MERGE QUÁ NHIỀU** + dừng hỏi user.
  - Gap ≥ 20 phút → merge bình thường.

## Prod branch (QUAN TRỌNG)

- **KHÔNG push thẳng `prod`.** Mọi commit trên `prod` PHẢI từ `git merge dev`.
- **KHÔNG tự động merge `dev` → `prod` hoặc push `prod`.** Chỉ khi user chỉ thị rõ ("deploy", "đẩy lên prod").
- Trước `git push origin prod`, BẮT BUỘC dừng hỏi user **confirm** kèm:
  - Số commit sẽ đẩy + tóm tắt 1 dòng mỗi commit (`git log origin/prod..prod --oneline`)
  - Loại thay đổi: code/runtime / docs / config / mix
  - Tác động: cần restart container? có downtime?
- **Worktree bắt buộc** khi merge `dev` → `prod`: dùng `.worktrees/prod-deploy/` để giữ working tree ở `dev`. Push xong → `git worktree remove`.

## Worktree (task song song)

- Đặt **trong** project tại `.worktrees/<slug>` (đã gitignored, không xoá thủ công).
- Grep/find phải loại trừ `.worktrees/` tránh context pollution.
- Tự tạo khi task độc lập / user có nhiều việc dở / user nói rõ:
  1. Branch mới: `git worktree add .worktrees/<slug> -b feat/<slug>` (branch từ `dev`).
     Branch có sẵn (vd deploy): `git worktree add .worktrees/<slug> <existing-branch>` (KHÔNG `-b`).
  2. Báo user path + lệnh `cd`.
- Naming: `feat/`, `fix/`, `chore/`, `refactor/`, `hotfix/` + slug kebab-case ngắn.
- Worktree đã tồn tại cho cùng task → dùng lại, không chồng.
- Delegate wrapper worktree (`.worktrees/delegate-*/`) do wrapper quản lý riêng — xem [[delegate-llm]].

### Dọn `.worktrees/` — orphan dir + junk

`git worktree prune` CHỈ dọn worktree registered stale — KHÔNG đụng dir rác không-phải-worktree (leftover parent delegate `.worktrees/delegate-*/`, `.DS_Store`, bundle backup lạc chỗ). Cleanup-sau-merge không cover các thứ này.

- Trước khi kết session / khi thấy `.worktrees/` bẩn, audit:
  ```bash
  cd .worktrees && git worktree list        # danh sách worktree HỢP LỆ
  for d in */; do [ -e "$d/.git" ] || echo "ORPHAN non-worktree: $d"; done
  ```
- Orphan dir rỗng (0B, không `.git`) → `rmdir <dir>` (chỉ xoá được nếu rỗng).
- File lạc chỗ: `.DS_Store` → xoá; `*.bundle` có giá trị → **move ra ngoài repo** (`../`), KHÔNG xoá.
- Chỉ `rmdir` (không `rm -rf`) cho orphan — dir không rỗng → dừng, báo user.

## Cleanup sau merge (BẮT BUỘC, in-session)

**Cốt lõi**: branch tạm (`feat/`, `fix/`, `hotfix/`, `chore/`, `refactor/`) sau khi merge vào branch chính (`dev`/`main`/`stable`/`prod`) trong CÙNG SESSION phải cleanup ngay. KHÔNG để branch rác qua session.

**Trigger**: ngay sau `git merge feat/<slug>` thành công — 3 bước theo thứ tự:

1. **Worktree** — `git worktree remove <wt-path>`. Stale → `git worktree prune`.
2. **Local branch** — `git branch -d feat/<slug>` (safe delete). Git từ chối (unmerged) → dừng, báo user. KHÔNG `-D` force.
3. **Remote branch** — `git push origin --delete feat/<slug>` (best-effort). Lỗi → log warning, không fail flow. CHỈ trên `origin`.

**Whitelist cleanup**: `feat/`, `fix/`, `hotfix/`, `chore/`, `refactor/`.
**Protected (HARD BLOCK)**: `main`, `dev`, `stable`, `prod`, `backup`.

**Slash command**: [/push-to-github](../commands/push-to-github.md) để gom push + smoke test + gitleaks + sensitive scan. Tránh `git push` thô (dễ quên cleanup).

**Confirm trước xoá**: BẮT BUỘC liệt kê candidates + hỏi `[a]ll / [s]elect / [n]one` trước delete. Destructive → không auto-execute không xác nhận.

**Không cleanup khi**:
- User explicit "giữ branch <slug>" / "keep ...".
- Branch chưa merge thật (`git branch --merged <current>`).
- Branch ngoài 5 prefix whitelist (`release/`, `experiment/` → user tự quyết).
- Commit cuối < 24h.

## Env files — KHÔNG push remote

`.env.pro`, `.env.aws` (đã gitignored) chỉ giữ **LOCAL**. `origin` repo này = github `acegalaxy-co` → push env lên đây = **leak secret**. KHÔNG push env/secret lên bất kỳ remote nào. Backup → security_envs local. Xem [[secrets-no-printout]], [[vault-no-mcp]].
