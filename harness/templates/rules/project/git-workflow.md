---
name: git-workflow
description: Branch strategy (working branch + protected branches) + working-branch discipline, protected-branch deploy confirm, worktree lifecycle, cleanup-sau-merge. P0 guardrail cho mọi git op có tính destructive/outward-facing.
status: live
updated: 2026-07-21
metadata:
  type: reference
---

# Git Workflow

Bổ sung [[git-conventions]] (org default + commit format). Phần này = branching + merge/deploy guardrail.

## Branching strategy

- **@@BRANCH@@** — working branch, phát triển hàng ngày, sửa trực tiếp.
- **Protected branches** (vd `stable`, `prod`, `release` — điền theo thực tế project) — CHỈ merge từ `@@BRANCH@@`, KHÔNG push trực tiếp.

## Working branch (QUAN TRỌNG)

- **Sửa trực tiếp trên `@@BRANCH@@`.** KHÔNG sửa trên protected branch/`feat/*`/`fix/*` trừ khi user yêu cầu rõ. **Chỉ áp khi 1 session duy nhất chạm repo** — đa session xem block dưới.
- Nhận task mới → check `git branch --show-current` trước → khác `@@BRANCH@@` thì checkout `@@BRANCH@@` (trừ khi user chỉ định).
- Merge về protected branch chỉ khi user xác nhận. Sau merge → cleanup ở dưới.

## Đa session song song (QUAN TRỌNG)

Nhiều Claude session mở cùng repo dir = **chung 1 working tree + chung branch checked-out (`@@BRANCH@@`)** — không phải chung logic mà chung file trên đĩa + chung `HEAD`/index. 2 session cùng "sửa trực tiếp `@@BRANCH@@`" → đè uncommitted lẫn nhau, race `git add`/`commit` (commit lẫn changes 2 task), `git branch --show-current` cả 2 đều thấy `@@BRANCH@@` nên không biết đối phương tồn tại.

- **≥2 session mở cùng repo → mỗi session PHẢI worktree riêng** `.claude/worktrees/<slug>` + branch `feat/<slug>` (hoặc `fix/`, `chore/`... theo loại task). KHÔNG session nào sửa trực tiếp `@@BRANCH@@`.
- Áp **kể cả khi task disjoint** (khác file / khác module hoàn toàn) — chung working tree vẫn race index/HEAD dù không đụng nội dung file. Nghi ngờ overlap-hay-không → coi là overlap, tách.
- Ngoại lệ duy nhất: user nói rõ chấp nhận rủi ro chung `@@BRANCH@@`.
- Phát hiện đa session: session hiện tại thấy uncommitted changes lạ / branch `@@BRANCH@@` nhảy commit không do mình → dừng, cảnh báo user có session khác đang chạm repo.
- Worktree lifecycle (tạo/cleanup) theo section [Worktree](#worktree-task-song-song) dưới.

## Protected branch deploy (nếu project có)

- **KHÔNG push thẳng protected branch.** Mọi commit trên đó PHẢI từ `git merge @@BRANCH@@`.
- **KHÔNG tự động merge `@@BRANCH@@` → protected branch hoặc push protected branch.** Chỉ khi user chỉ thị rõ ("deploy", "đẩy lên prod"...).
- Trước push protected branch, BẮT BUỘC dừng hỏi user **confirm** kèm:
  - Số commit sẽ đẩy + tóm tắt 1 dòng mỗi commit (`git log origin/<protected>..<protected> --oneline`)
  - Loại thay đổi: code/runtime / docs / config / mix
  - Tác động: cần restart service? có downtime?
- **Worktree bắt buộc** khi merge `@@BRANCH@@` → protected branch: dùng `.claude/worktrees/<protected>-deploy/` để giữ working tree ở `@@BRANCH@@`. Push xong → `git worktree remove`.

## Worktree (task song song)

- Đặt tại `.claude/worktrees/<slug>` (gitignored, không xoá thủ công) — path hardcode trong `EnterWorktree`, dùng chung agent-tool native + delegate wrapper. Grep/find phải loại trừ dir này.
- Tự tạo khi task độc lập / user nhiều việc dở / user nói rõ:
  - Branch mới: `git worktree add .claude/worktrees/<slug> -b feat/<slug>` (từ `@@BRANCH@@`).
  - Branch có sẵn (deploy): `git worktree add .claude/worktrees/<slug> <existing-branch>` (KHÔNG `-b`).
  - Báo user path + lệnh `cd`.
- Naming: `feat/`, `fix/`, `chore/`, `refactor/`, `hotfix/` + slug kebab-case. Worktree cùng task đã có → dùng lại.
- Delegate wrapper worktree (`.claude/worktrees/delegate-*/`) do wrapper tự quản — xem [[delegate-llm]].
- **Nhiều subagent song song → mỗi task 1 worktree riêng.** KHÔNG để 2+ subagent cùng edit chung file/worktree (conflict). Chung 1 worktree chỉ khi chắc chắn không đụng file nhau — nghi ngờ → tách riêng.

### Dọn orphan dir + junk

`git worktree prune` CHỈ dọn worktree registered stale — không đụng dir rác (leftover `delegate-*/`, `.DS_Store`, bundle lạc chỗ). Trước khi kết session hoặc khi dir bẩn, audit:

```bash
cd .claude/worktrees && git worktree list  # worktree HỢP LỆ
for d in */; do [ -e "$d/.git" ] || echo "ORPHAN non-worktree: $d"; done
```

- Orphan rỗng → `rmdir` (chỉ `rmdir`, không `rm -rf`); không rỗng → dừng, báo user.
- `.DS_Store` → xoá; `*.bundle` giá trị → move ra `../` (KHÔNG xoá).

## Trước khi merge — check fix ledger

Trước `git merge` bất kỳ branch nào vào `@@BRANCH@@`/protected branch — chạy skill `fix-ledger` (chế độ CHECK) nếu project có `.claude/fix-ledger.md`. Tránh merge branch cũ/stale đè lại bugfix đã merge trước đó. Sau khi fix/feature có rủi ro bị đè merge xong → skill `fix-ledger` (chế độ RECORD).

## Cleanup sau merge (BẮT BUỘC, in-session)

**Cốt lõi**: branch tạm (`feat/`, `fix/`, `hotfix/`, `chore/`, `refactor/`) sau khi merge vào branch chính (`@@BRANCH@@` hoặc protected branch) trong CÙNG SESSION phải cleanup ngay. KHÔNG để branch rác qua session.

**Trigger**: ngay sau `git merge feat/<slug>` thành công — 3 bước theo thứ tự:

1. **Worktree** — `git worktree remove <wt-path>`. Stale → `git worktree prune`.
2. **Local branch** — `git branch -d feat/<slug>` (safe delete). Git từ chối (unmerged) → dừng, báo user. KHÔNG `-D` force.
3. **Remote branch** — `git push origin --delete feat/<slug>` (best-effort). Lỗi → log warning, không fail flow. CHỈ trên `origin`.

**Whitelist cleanup**: `feat/`, `fix/`, `hotfix/`, `chore/`, `refactor/`.
**Protected (HARD BLOCK)**: `@@BRANCH@@` + mọi protected/release branch khác của project (vd `stable`, `prod`, `release` — điền theo thực tế repo).

**Slash command**: [/git-push-safety](../commands/git-push-safety.md) để gom push + smoke test + gitleaks + sensitive scan. Tránh `git push` thô (dễ quên cleanup).

**Confirm trước xoá**: BẮT BUỘC liệt kê candidates + hỏi `[a]ll / [s]elect / [n]one` trước delete. Destructive → không auto-execute không xác nhận.

**Không cleanup khi**:
- User explicit "giữ branch <slug>" / "keep ...".
- Branch chưa merge thật (`git branch --merged <current>`).
- Branch ngoài 5 prefix whitelist (`release/`, `experiment/` → user tự quyết).
- Commit cuối < 24h.

## Env files — KHÔNG push remote

`.env*` (đã gitignored) chỉ giữ **LOCAL**. KHÔNG push env/secret lên bất kỳ remote nào (kể cả private repo). Xem [[secrets-no-printout]], [[vault-no-mcp]].
