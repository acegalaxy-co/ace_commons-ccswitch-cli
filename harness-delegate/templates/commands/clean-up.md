---
name: clean-up
description: Dọn repository/worktree an toàn bằng dry-run, phân loại candidate, hỏi xác nhận trước mọi xoá/sửa.
user-invocable: true
---

# /clean-up — cleanup an toàn cho mọi project

## Usage

```text
/clean-up
/clean-up dry-run
/clean-up apply
/clean-up scope=<all|repo|worktrees|branches|artifacts|logs|dead-code>
/clean-up since=<7d|30d|90d>
/clean-up include-remote
```

Mặc định:

```text
/clean-up dry-run scope=all since=30d
```

Ý nghĩa:

- `dry-run`: chỉ audit + liệt kê candidate. Không xoá, không sửa.
- `apply`: chỉ chạy sau dry-run trong cùng session và user xác nhận danh sách cụ thể.
- `scope`: giới hạn vùng cleanup.
- `since`: ngưỡng tuổi cho log/artifact/cache stale.
- `include-remote`: cho phép xét remote branch đã merge; vẫn cần confirm riêng trước delete.

## Luật cứng

- Không dùng `rm -rf`.
- Không dùng `git reset --hard`.
- Không dùng `git clean -fdx` hoặc `git clean -fd` để apply.
- Không dùng `git branch -D`.
- Không dùng `git push --force` hoặc `--force-with-lease`.
- Không xoá/sửa `.env*`, credentials, private keys, vault, Notion records, token/cache auth nếu chưa có rule project rõ.
- Không in nội dung file có thể chứa secret. Chỉ in path, size, mtime, loại rủi ro.
- Không commit, push, merge, deploy nếu user không yêu cầu rõ.
- Không bypass hook hoặc permission deny.
- Mọi destructive action phải hiển thị command dự kiến và hỏi confirm `[a]ll / [s]elect / [n]one`.
- Mặc định chọn `[n]one` nếu user trả lời mơ hồ.

Nếu phát hiện secret đã lộ trong diff/log/output: dừng cleanup, báo secret compromised, khuyến nghị rotate/revoke, không lặp lại secret.

## Vùng luôn loại trừ khi scan source

Loại trừ khỏi grep/find rộng, trừ khi scope yêu cầu trực tiếp:

```text
.git/
.worktrees/
node_modules/
vendor/
dist/
build/
coverage/
__pycache__/
*.egg-info/
.env
.env.*
*_vault_/
vault/
secrets/
credentials/
*.pem
*.key
*.p12
*.pfx
settings.local.json
.claude/settings.local.json
```

Ví dụ `find` an toàn cho source scan:

```sh
find . \
  -path ./.git -prune -o \
  -path ./.worktrees -prune -o \
  -path ./node_modules -prune -o \
  -path ./vendor -prune -o \
  -print
```

## Phase 1 — xác định bối cảnh

Chạy read-only:

```sh
git rev-parse --show-toplevel
git branch --show-current
git status --short
git diff --stat
git worktree list
```

Branch policy:

- Nếu project có rule working branch (`dev`, `main`, `develop`, ...), tuân theo rule đó.
- Nếu đang ở protected branch và cleanup có thể sửa/xoá, dừng hỏi user chuyển branch/worktree.
- Nếu repo dirty, không revert/reset. Chỉ phân loại file nào là WIP, file nào là cleanup candidate.

Protected branch mặc định:

```text
main
master
dev
develop
stable
staging
prod
production
release/*
hotfix/release-*
```

Không xoá protected branch. Không remote-delete protected branch.

## Phase 2 — dry-run candidate

### 2.1 Repo status

Mục tiêu: biết repo bẩn vì gì trước khi cleanup.

Thu:

- Modified files.
- Untracked files.
- Diff ngoài scope.
- Generated/junk candidate.
- WIP cần giữ.

Không tự sửa file modified. Không tự xoá untracked nếu chưa confirm.

### 2.2 Registered stale worktree

Dry-run:

```sh
git worktree list
git worktree prune --dry-run
```

Apply sau confirm:

```sh
git worktree prune
```

Chỉ dùng cho stale worktree git biết. `git worktree prune` không dọn orphan directory không có `.git`.

### 2.3 Worktree hợp lệ cần xoá sau merge

Candidate chỉ khi:

- Worktree path nằm trong project `.worktrees/`.
- Branch prefix thuộc whitelist:
  - `feat/`
  - `fix/`
  - `hotfix/`
  - `chore/`
  - `refactor/`
- Branch đã merge vào current working branch.
- Commit cuối >= 24h, trừ khi user chỉ định cleanup ngay.
- User không nói giữ branch/worktree.

Dry-run:

```sh
git worktree list
git branch --merged
git for-each-ref --format='%(refname:short) %(committerdate:iso8601)' refs/heads
```

Apply sau confirm, đúng thứ tự:

```sh
git worktree remove <wt-path>
git branch -d <branch>
git push origin --delete <branch>
```

Remote delete:

- Best-effort.
- Chỉ `origin`.
- Chỉ khi user xác nhận remote delete.
- Nếu fail, log warning; không retry bằng force.

### 2.4 Orphan directory trong `.worktrees/`

Dry-run:

```sh
if [ -d .worktrees ]; then
  (cd .worktrees && git worktree list && for d in */; do [ -e "$d/.git" ] || echo "ORPHAN non-worktree: $d"; done)
fi
```

Apply rules:

- Orphan dir rỗng, không có `.git`: `rmdir .worktrees/<dir>`.
- Orphan dir không rỗng: dừng, báo user path + size + lý do không xoá.
- `.worktrees/.DS_Store`: xoá bằng `rm .worktrees/.DS_Store` sau confirm.
- `*.bundle` trong `.worktrees/`: move ra ngoài repo, không xoá.

Không dùng `rm -rf .worktrees/<dir>`.

### 2.5 File rác tĩnh

Candidate:

```text
.DS_Store
*.tmp
*.temp
*.bak
*.orig
*.rej
*.swp
*.swo
*~
*.log nếu nằm trong log/cache/generated path và quá since
```

Dry-run:

```sh
find . \
  -path ./.git -prune -o \
  -path ./.worktrees -prune -o \
  -path ./node_modules -prune -o \
  -type f \( \
    -name .DS_Store -o \
    -name '*.tmp' -o \
    -name '*.temp' -o \
    -name '*.bak' -o \
    -name '*.orig' -o \
    -name '*.rej' -o \
    -name '*.swp' -o \
    -name '*.swo' -o \
    -name '*~' \
  \) -print
```

Apply sau confirm:

```sh
rm <exact-reviewed-file>
```

Chỉ xoá file trong danh sách đã duyệt. Không xoá thư mục bằng `rm`.

### 2.6 Build artifacts / generated junk

Dry-run read-only:

```sh
git clean -ndX
```

Candidate chỉ an toàn khi:

- Path bị ignore bởi repo.
- Có thể tái tạo bằng build/test.
- Không phải env/secret/auth cache.
- Không phải artifact user cần giữ.

Apply:

- Ưu tiên xoá từng path đã duyệt.
- Nếu path là directory: chỉ xoá bằng command project-specific đã rõ hoặc hỏi user confirm riêng với danh sách file count/size.
- Không chạy `git clean -fdx`.

### 2.7 Logs/cache stale

Không đọc nội dung log nếu có thể chứa token/header/cookie/URL credential.

Dry-run chỉ metadata:

```sh
find . \
  -path ./.git -prune -o \
  -path ./.worktrees -prune -o \
  -path ./node_modules -prune -o \
  -type f -name '*.log' -mtime +30 -print
```

Report gồm path, size, mtime, reason. Không in content.

Apply chỉ sau confirm từng path. Nếu log thuộc runtime service đang chạy, dừng hỏi user có cần restart/logrotate không.

### 2.8 Local merged temp branches

Whitelist cleanup:

```text
feat/*
fix/*
hotfix/*
chore/*
refactor/*
```

Dry-run:

```sh
git branch --merged
git for-each-ref --format='%(refname:short) %(committerdate:iso8601) %(upstream:short)' refs/heads
```

Skip branch nếu:

- Protected branch.
- Branch ngoài whitelist.
- Chưa merge thật vào current branch.
- Commit cuối < 24h.
- Có worktree active còn dùng branch đó.
- User nói giữ.

Apply sau confirm:

```sh
git branch -d <branch>
```

Nếu Git từ chối vì unmerged, dừng. Không dùng `-D`.

### 2.9 Remote tracking stale

Dry-run:

```sh
git remote prune origin --dry-run
```

Apply sau confirm:

```sh
git remote prune origin
```

Không xoá remote branch thật ở bước này; chỉ dọn remote-tracking refs stale.

### 2.10 Remote branches đã merge

Chỉ chạy nếu user dùng `include-remote` hoặc yêu cầu rõ.

Dry-run:

```sh
git branch -r --merged origin/<base>
```

Skip:

- Protected remote branch.
- Branch ngoài whitelist.
- Branch không thuộc `origin`.
- Branch commit cuối < 24h.
- Không chắc base branch đúng.

Apply sau confirm riêng:

```sh
git push origin --delete <branch-without-origin-prefix>
```

Không xoá remote branch nếu user chỉ confirm local cleanup.

### 2.11 Dead code nghi vấn

Dead code cleanup mặc định là audit-only.

Candidate:

- File không được import/require.
- Export không có reference.
- Script không được gọi từ package/config/CI.
- Legacy folder không có owner rõ.

Rules:

- Không xoá runtime code chỉ vì grep không thấy reference.
- Không xoá public API, migration, fixture, plugin entrypoint, CLI command, generated schema nếu chưa hiểu entrypoint.
- Nếu user muốn xoá dead code: tách thành task riêng, diff nhỏ, verify bằng test/lint/typecheck/app flow phù hợp.

## Phase 3 — confirmation gate

Trước apply, in bảng:

```text
#  category      action                 target                         reason                 risk   command
1  worktree      git worktree remove    .worktrees/feat-x              merged into dev         med    git worktree remove .worktrees/feat-x
2  branch        git branch -d          feat/x                         merged + older 24h      med    git branch -d feat/x
3  junk-file     rm                     ./foo.tmp                      temp file              low    rm ./foo.tmp
```

Sau đó hỏi:

```text
Apply cleanup? [a]ll / [s]elect / [n]one
```

Rules:

- `[a]ll`: apply toàn bộ candidate trong bảng, trừ item risk high cần confirm riêng.
- `[s]elect`: user liệt kê số item, ví dụ `1,3,5`.
- `[n]one`: không apply gì.
- Response không rõ: coi như `[n]one`.
- Item risk high: hỏi confirm riêng với command đầy đủ.

## Phase 4 — apply order

Nếu user confirm, chạy theo thứ tự ít rủi ro trước:

1. Remote-tracking stale: `git remote prune origin`.
2. Registered stale worktree: `git worktree prune`.
3. Orphan empty dirs: `rmdir <path>`.
4. Known junk files: `rm <path>`.
5. Worktree sau merge: `git worktree remove <path>`.
6. Local merged branches: `git branch -d <branch>`.
7. Remote merged branches: `git push origin --delete <branch>`.
8. Generated artifacts/logs: từng path đã confirm hoặc command project-specific đã confirm.

Nếu bước nào fail:

- Dừng category hiện tại.
- Không dùng force fallback.
- Báo command, exit summary, item còn lại.

## Phase 5 — verify

Sau dry-run:

```sh
git status --short
git diff --stat
git worktree list
```

Sau apply:

```sh
git status --short
git diff --stat
git worktree list
git branch --merged
```

Nếu cleanup chạm code/runtime/build artifact:

- Chạy verify phù hợp với project hiện có: test, lint, typecheck, build, smoke test.
- Không thêm dependency/test runner mới.
- Nếu chỉ xoá junk file/branch/worktree: không cần full test suite; `git status`, `git worktree list`, branch check là đủ.

Nếu user yêu cầu commit/push sau cleanup:

- Commit chỉ sau verify pass hoặc user chấp nhận fail rõ ràng.
- Push nên dùng command/skill project có sensitive scan/gitleaks nếu tồn tại.
- Không push `.env*` hoặc secret lên remote.

## Output dry-run

```text
CLEANUP DRY-RUN
Branch: <branch>
Scope: <scope>
Since: <since>
Repo status: <clean|dirty summary>

Candidates:
1. [category] <target> — action: <action> — reason: <reason> — risk: <low|med|high>

Skipped:
- <target/category> — <reason>

Need confirmation:
- Reply "apply all", "apply 1,3,5", or "stop".
```

## Output apply

```text
CLEANUP APPLY RESULT
Applied:
- [category] <target> — <command/action>

Skipped:
- <target> — <reason>

Failed:
- <target> — <command> — <short failure>

Verification:
- <command>: PASS/FAIL <summary>

Diff/status summary:
<git status --short>
<git diff --stat>

Remaining risk/TODO:
- <item or none>
```

## Recovery notes

- Local branch deleted by mistake: inspect `git reflog`, then recreate with `git branch <branch> <commit>`.
- Worktree removed but branch remains: restore with `git worktree add <path> <branch>`.
- File junk deleted by mistake: restore from backup or Git only if file was tracked.
- Bundle file found in `.worktrees/`: move outside repo, do not delete.
