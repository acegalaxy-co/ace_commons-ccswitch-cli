# 21 — CI tiết kiệm chi phí: gate bước NẶNG sang PR, giữ lưới NHẸ mọi trigger

Bài này giải quyết gì: CI hao phút runner vì bước build/test NẶNG chạy **2 lần mỗi thay đổi** (một lần trên PR, một lần khi merge vào nhánh chính) × nhiều repo → cạn quota, billing fail, CI cả hệ đứng.

## 🎯 Vấn đề
Gốc hao = mỗi thay đổi build nặng lặp lại (PR + push nhánh chính) và nhiều workflow thiếu huỷ-run-cũ nên chồng run vô ích. Cần cắt phần dư mà KHÔNG làm thủng lưới chặn lỗi.

## ✅ Cách làm — chính sách chuẩn (tái dùng mọi repo)

1. **Bước/job NẶNG gate sang PR.** Build · export bundle · full unit test (jest/vitest full) · e2e · migrate/seed lên **DB tạm trong CI** → gắn `if: github.event_name == 'pull_request'` ⇒ chỉ chạy trên PR.
2. **Giữ bước NHẸ chạy MỌI trigger làm lưới.** `install` + `typecheck` (`tsc --noEmit`) + `lint`. ⇒ push nhánh chính vẫn được typecheck bắt lỗi (kể cả khi các lane merge tuần tự đè nhau), chỉ bỏ build nặng dư.
3. **concurrency huỷ run cũ:** `group: ${{ github.workflow }}-${{ github.ref }}` + `cancel-in-progress: true` → đẩy commit mới thì run cũ tự huỷ.
4. **KHÔNG dùng `paths-ignore`.** Dễ kẹt **required status check**: check bị skip → PR không bao giờ "xanh" để merge.
5. **`timeout-minutes` cho MỌI job** → job treo không "đốt phút" vô hạn (đúng cú billing hay gặp).
6. **Cache deps + build:** cache thư mục build của framework (vd cache build Next/Metro…) + cache store gói. ⚠️ **pnpm khác npm**: dùng đúng key theo trình quản lý gói; đừng thêm npm-cache cho repo dùng pnpm (gãy). Repo KHÔNG có bước build thì đừng thêm cache-build (config chết).

### 🚫 TUYỆT ĐỐI không đụng
Không gate/không tắt các workflow: **deploy/release** · **migration apply lên DB THẬT** · **money-guard / autofix-guard** · **secret-scan / gitleaks** · **codeql** · **build-image** · **cron**. (Test trên **DB tạm trong CI** thì gate sang PR ĐƯỢC — đó là lưới-chặn-merge, khác hẳn migration-apply thật.)

→ Tiết kiệm ~**1 build nặng mỗi lần merge** + cắt run chồng. Đánh đổi nhỏ: lỗi chỉ-lộ-khi-build (hiếm, typecheck bắt phần lớn) có thể lọt tới nhánh chính — nhưng PR đã build đủ TRƯỚC khi merge.

## 📋 Checklist
- [ ] Bước NẶNG (build/e2e/test-full/DB-tạm) gắn `if: github.event_name == 'pull_request'`
- [ ] Bước NHẸ (install + typecheck + lint) vẫn chạy mọi trigger làm lưới
- [ ] `concurrency` + `cancel-in-progress: true`
- [ ] KHÔNG `paths-ignore` (tránh kẹt required-check)
- [ ] `timeout-minutes` cho mọi job
- [ ] Cache đúng theo trình quản lý gói (npm ≠ pnpm), chỉ cache-build khi có bước build
- [ ] Không đụng deploy · migration-thật · money-guard · secret-scan · codeql · cron

## 💻 Code mẫu
`snippets/ci-cost.yml` — workflow minh hoạ gate-PR + concurrency + timeout + cache (generic).

## ⚠️ Cạm bẫy
- **Required status check gắn vào TÊN bước build cụ thể** → build bị skip trên push nhánh chính làm check thiếu → merge kẹt. Rà branch-protection nếu merge bị chặn (chuyển required-check sang bước NHẸ luôn chạy).
- `paths-ignore` tưởng tiện nhưng làm skip required-check → PR treo mãi.
- Thêm npm-cache cho repo pnpm (hoặc cache-build cho repo không build) → CI gãy vì config trỏ vào path không tồn tại.
- Gốc sự cố thường là **billing** (payment fail / spending limit) khiến CI mọi repo đứng — không phải lỗi code. Theo dõi quota.

## 🧭 Roadmap (SOTA — làm khi đã ĐO thấy vẫn hao)
- **Runner thuê ngoài** (self-host / runner bên thứ ba): rẻ hơn nhiều + nhanh hơn, đổi 1 dòng `runs-on`; đổi lại thêm vendor/phụ thuộc → vắt free-wins trước.
- **Merge Queue** (gộp nhiều PR chạy CI 1 lần): hợp đội đông PR; 1-người + AI lợi ít, hoãn.
- **Affected-only cho monorepo** (chỉ build phần thay đổi, vd `--affected` của công cụ build monorepo): đòn mạnh nhất cho monorepo nhiều package.
> Ngành: tinh chỉnh CI tốt giảm ~60% chi phí là bình thường.

## Liên quan
- Chuẩn an toàn Git & quyền AI: `07-an-toan-git-claude.md`.
- Giám sát job nền / cron: `14-giam-sat-job-nen.md`.
- Snippet: `snippets/ci-cost.yml`.
