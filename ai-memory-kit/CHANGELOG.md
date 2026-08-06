# CHANGELOG — MemoryOS

## v4.2 — 2026-08-06
Bỏ `addons/` (dev-playbook + ai-patterns + skills) — nội dung kỹ thuật dev từ project cũ, không phải quy tắc nghiệp vụ chung. Kit giờ thuần **bộ nhớ NGHIỆP VỤ**. Khôi phục qua git history (tag/commit trước khi xoá) nếu cần tham khảo lại. `tools/nang-luc-registry.json` re-theme sang 12 capability nghiệp vụ (pricing, vendor-selection, contract-terms, onboarding-sop, refund-policy, escalation, promotion-campaign, hiring, partner-deal, budget-approval, customer-segment, kpi-report) thay cho danh mục dev cũ.

- `handbook-gate.mjs` +cache TTL-free (`tmpdir()/handbook-gate-ok-<hash transcript_path>`) — phiên đã chứng minh đọc HANDBOOK 1 lần thì các Edit/Write sau trong phiên đó pass ngay, khỏi đọc lại full transcript mỗi lần (giảm P2 latency).
- Thêm `tools/khoa-vault.mjs` (`acquireLock`/`releaseLock`, mkdir atomic + stale-break 10 phút + fail-open) — wire vào mọi đường WRITE (`memory-doctor.mjs --fix`, `build-index.mjs --write`, `tien-do.mjs --write`, `so-nang-luc.mjs --write`, `ghi-manh.mjs`, `moi-so-nang-luc.mjs --write`) chống 2 phiên CÙNG MÁY đè ghi lẫn nhau; đa-máy qua Drive sync vẫn KHÔNG được bảo vệ (xem `docs/multi-session.md`).

## v4.1 — 2026-07-10
Đào thêm **cụm kiến thức generic** đúc từ đợt vận hành nhiều dự án 09–10/07 (đã rửa sạch danh tính) — mở rộng Dev Playbook + 2 công cụ đối-soát mới + siết Tầng-0.

**Dev Playbook +4 bài (28–31):**
- `28-cong-dang-nhap-chuan` — cổng đăng-nhập chuẩn: middleware chặn **cả KHUNG** (không chỉ data) khi ẩn danh → `/login` · màn login full-screen · dò multi-cookie · **verify JWT chọn theo thuật-toán-ký** (HS256 verify tại chỗ vs bất-đối-xứng/ECC gọi endpoint) · `requireAccess()` phải **redirect, không throw**. (+ snippet `graceful-shutdown.ts`)
- `29-rbac-phan-quyen-chuan` — RBAC: 3 bảng (memberships/roles/role_permissions) + catalog quyền trong code + biến-thể scope-theo-bản-ghi (fail-closed) + **2 bẫy** (role_permissions rỗng khóa MỌI role kể cả owner → seed idempotent trước; auth.users dùng chung → gỡ membership, đừng deleteUser toàn cục) + sider FE phải tự lọc menu.
- `30-harness-e2e-playwright` — harness E2E: auth-qua-API→storageState · smoke màn tham-số-hóa · 3 biến-thể app-load (Vite/RN-Web/Next-cookie) · bẫy tương tác (tour-mask · OTP throttle · JWT-rotation-race · popup điều-khoản).
- `31-kiem-thu-hinh-anh-3-tang` — tháp kiểm-thử hình-ảnh: T1 Hình-học (đo DOM, baseline 0, **chặn CI**) → T2 Pixel-diff (mock cố-định, mask vùng động, baseline Linux-CI, **cổng hẹp**) → T3 AI-vision (nightly, **không chặn**); báo-cáo-trước, auto-scan route, fixtures tự-test, cách-ly-flake, golden-set 30–50.

**Bổ sung bài cũ:** `01` graceful-shutdown (npm start nuốt SIGTERM→"crashed" giả) + NestJS tsconfig.build + `NEXT_PUBLIC_*` nhúng build-time · `02` region app phải **KHỚP** region DB · `07` stacked-PR squash-conflict + **làm việc VỚI rào an-toàn của agent-tự-lái** (2 tầng quyền, đừng vòng qua classifier) · `11` gitleaks thiếu `permissions: pull-requests: read` (403 bị `continue-on-error` nuốt) + quét full lịch-sử PR · `14` "Lớp 0 — DB connection resilience" (`unhandledRejection` chỉ nuốt regex lỗi-kết-nối) · `15` +5 gotcha (lockfile+optional-dep+CI-frozen · alias vỡ ở test-runner · fail-closed chỉ chặn cái MỚI phải xoay credential sống · "chưa deploy" đừng kết luận bằng grep tên repo · main-guard ESM vỡ khi path có space/`~` → `realpathSync` 2 đầu).

**ai-patterns:** `05` +OS process supervisor (registry · heal-not-kill · watchdog · crash-loop theo đổi-PID) + cầu cloud↔máy-cá-nhân qua hàng-đợi-lệnh DB (đánh-đổi, không phải đích) · `07` +verify UTF-8 khi agent sửa hàng-loạt text (perl/sed double-encode mojibake → verify snapshot-diff, decode strict).

**Công cụ +2 (`tools/`):**
- `build-catalog.mjs` — sinh **mục lục PHẲNG** toàn tủ (đọc name/description/status/canonical/capability), gom theo nhóm, đẩy `canonical:true` lên đầu → `Memories/CATALOG.md` (mặc định dry-run, `--write` mới ghi). Tra 2 bước: grep mục-lục phẳng trước khi mở mảnh.
- `doi-soat.mjs` — **đối-soát trạng-thái ↔ chứng-cứ Git** (chống over-claim): quét `verify: pr=/sha=/gate=` + `git cat-file -e` → 🔴 sha thiếu / 🟡 sha có mà status chưa bump + heuristic "nghi xong chưa bump". Git-optional (không có git vẫn chạy heuristic).

**Engine cải tiến:** `memory-doctor.mjs` +vòng ⑨d **trần Tầng-0** (ước token HANDBOOK+MEMORY.md, cảnh báo 🟡 vượt `MEMORY_MAX_TOKENS_TIER0`, không chặn) · `tien-do.mjs` nối heuristic **suspect-done** ("🟡 NGHI XONG CHƯA BUMP") từ `doi-soat.mjs`.

**docs:** `do-recall-thu-thu` +"TRA 2 BƯỚC qua mục-lục phẳng" · `chay-bo-nho-nhe-tiet-kiem-token` +5b "TRẦN riêng cho TẦNG-0" · `trang-thai-cong-viec-6-nac` +4b "ĐỐI SOÁT với Git (chống over-claim)".

**PRINCIPLES:** thêm cụm **C++++++ (v4.1)** — #55 đối-soát-trạng-thái↔chứng-cứ · #56 tra-qua-mục-lục-phẳng+ưu-tiên-canonical. VERSION → 4.1.

Đã quét rò sạch (0 danh tính/secret) + `node --check` engine 🟢. `nang-cap.mjs`/`dong-gop.mjs` tự phủ file mới (bê nguyên thư mục `dev-playbook/`+`ai-patterns/`+`tools/`+`docs/`).

## v4.0 — 2026-07-09
**Bản CHÍNH THỨC "MemoryOS" + gói nâng cấp lớn** (đúc thêm từ thực chiến vận hành nhiều dự án, đã rửa sạch danh tính). Thêm 4 cụm:
- **Chạy bộ nhớ NHẸ / tiết kiệm token** (`docs/chay-bo-nho-nhe-tiet-kiem-token.md`): đọc phân tầng nhẹ mặc định · Tầng-0 mỏng (mục lục + trỏ mảnh) · chẩn đoán token hao đến từ nhóm/mảnh phình · chọn model theo vai · tự-động-nén > nhắc-tay · bảng chẩn đoán nhanh.
- **Máy trạng thái công việc 6 nấc** (`docs/trang-thai-cong-viec-6-nac.md`): tách task-state khỏi `status:` mảnh · `plan→wip→blocked→done→verified→activated` · cấm nhảy tắt done→activated · rollup = view tự in.
- **Dev Playbook +3 bài (25–27):** rà cửa hậu dev-bypass trước go-live (bẫy NODE_ENV) · robot tự-vá có lưới (4 lằn ranh) · dựng-để-bàn-giao (mô hình 3 vai).
- **ai-patterns +2 (07–08):** kiểm soát kết quả sub-agent · chống tiêm-lệnh qua sub-agent.
- **PRINCIPLES:** thêm mục **C+++++ (v4.0)** — nguyên tắc #46–54. VERSION → 4.0.

## v3.9 — 2026-07-09
**Đổi tên chính thức:** bỏ "Starter Kit" → nay gọi gọn là **MemoryOS** (bộ đã ổn định, không còn là bản khởi đầu). Chỉ đổi tên hiển thị + tên repo (`memory-os`) + tên zip phát; engine/nội dung không đổi.

## v3.8 — 2026-07-01
Đào thêm **cụm kiến thức generic mới** đúc từ thực chiến vận hành nhiều dự án (đã rửa sạch danh tính). Mở rộng Dev Playbook + `ai-patterns/`, thêm chương "bộ nhớ chung cho team", viết lại nguyên tắc #6 + 7 nguyên tắc mới.

**Dev Playbook (`dev-playbook/`) — 8 bài mới:**
- `17-toan-ven-tien` — 5 luật ghi sổ an toàn (txn+FOR UPDATE · khóa chống-trùng tự nhiên · trạng thái terminal BẤT BIẾN · đếm-atomic · idempotent) + vòng đời thanh toán online chốt-khi-PAID (latch chạy-đúng-1-lần). (+ snippet `money-guard.sql`, `payment-finalize-latch.ts`)
- `18-che-pii-va-kyc` — che PII admin 3 tầng (mask · reveal-có-audit · quyền riêng) + nâng cấp KYC (state machine · mã hóa at-rest + `*_last4` · ảnh giấy-tờ bucket private+signed-url). (+ snippet `pii-mask.ts`)
- `19-canh-bao-bat-thuong-va-doi-soat` — trung tâm cảnh báo rule-based (không cần AI) + đối-soát dashboard ("Chưa gán X" + Tổng-khớp).
- `20-chong-trung-va-xoa-day-chuyen` — chống trùng đúng-mức (chặn/nhắc) + xem-trước cascade delete (heuristic test/thật) + xóa mềm có nhật ký.
- `21-ci-tiet-kiem-chi-phi` — CI tiết kiệm: bước nặng chỉ chạy PR + concurrency cancel + timeout + cache. (+ snippet `ci-cost.yml`)
- `22-template-non-tech-3-tang` — template email/tài-liệu cho non-tech tự chủ: tách nội-dung / câu-chữ / bố-cục + luôn xem-trước.
- `23-monitor-status-dang-tin` — kiểm site/service sống-chết đáng tin (ping server + UA browser + cổng-mạng chống báo-giả).
- `24-share-card-social-og` — sinh ảnh share (OG + story) render server + gotchas `'use client'`→server, satori quirks.
- `15-gotchas-thuong-gap` — thêm 7 gotcha: bigint→chuỗi (tổng tiền) · searchParams refetch cả trang · CI xanh ≠ app boots (DI) · grep-schema sai · vendored pnpm `--offline` · thêm-quyền-vỡ-test-đếm · cờ-ngưỡng-mặc-định-0.
- `02-supabase-an-toan` — thêm mục "backup FILE object-storage" (backup-DB không cứu file). (+ snippet `backup-storage.mjs`)

**`ai-patterns/` — 3 bài mới:**
- `04-connector-mcp-toan-nghiep-vu` — dựng connector MCP phủ trọn nghiệp vụ 1 app: token per-user · 5-KIND gate bật-dần (hiệu-lực-ngay không deploy) · quy trình đa-agent · gotcha connector qua CDN/anti-bot.
- `05-noi-chay-tu-dong-hoa` — chọn nơi chạy tự-động-hóa theo có-gọi-AI-không; "đừng để máy cá nhân gánh tim business".
- `06-diem-cam-tich-hop-ngoai` — pattern điểm-cắm thêm kênh ngoài (SMS/email/push/webhook): registry + StubSender + fail-soft + config-by-key.

**`docs/multi-session.md` — 3 chương mới:** bộ nhớ chung cho TEAM (2 lớp, cổng rửa+duyệt, KHÔNG auto-trộn) · resume đúng sau /clear + tự verify tiến độ · khi nào /clear là vừa (theo % cửa sổ) + đọc Drive khi thiếu connector.

**`PRINCIPLES.md`:**
- **Viết lại #6** — "AI CHỦ ĐỘNG chạy việc trong lằn ranh, gặp rào thì thử đường khác + nói cho chủ gỡ, đừng mặc định đẩy nút" (thay bản cũ "tạo nút 1-bấm cho chủ" — quá thụ động).
- **Thêm #39–45** — terminal bất-biến · 2-số-phải-đối-soát · giám-sát-đáng-tin (thà im còn hơn báo giả) · chia-sẻ-bộ-nhớ-chỉ-qua-cổng-rửa · resume-đọc-mốc+verify-trước-khi-hỏi · đừng-phức-tạp-hóa-ca-đơn-giản · đừng-để-máy-cá-nhân-gánh-tim-business.

Đã quét rò sạch (0 danh tính/secret) + `node --check` engine 🟢. `nang-cap.mjs`/`dong-gop.mjs` tự phủ file mới (đã gồm `dev-playbook/`+`ai-patterns/`).

## v3.7 — 2026-06-26
Xuất thêm **4 GÓI kiến thức generic** (đã rửa sạch danh tính) — mở rộng Dev Playbook + 2 thư mục mới `ai-patterns/` và `skills/`.

**Gói 1 — Chất lượng & An toàn dữ liệu** (`dev-playbook/`):
- `11-dam-bao-chat-luong-4-luoi` — defense-in-depth: CI+quét-secret · Zod · error-tracking · typed-DB · backup+diễn-tập-restore.
- `12-audit-log-undo-confirm` — 3 lớp cho app non-tech sửa data: xác nhận · audit log · hoàn tác (kèm schema + undo).
- `13-doi-soat-import-migration` — đối soát 5 chiều (khớp tổng tiền chưa đủ: kẹp-ngày/nhãn-sai/rớt-dòng).
- `14-giam-sat-job-nen` — cron 4 lớp: fail-closed · heartbeat · hàng-đợi-ngoại-lệ · alert best-effort.

**Gói 4 — Gotchas lẻ** (`dev-playbook/`):
- `15-gotchas-thuong-gap` — server-action trả `{ok,error}` · overlay Portal thoát backdrop-filter · Supabase singleton chống rò RAM (+ 3 snippet).
- `16-mo-hinh-trunk-preview` — trunk (1 nhánh main=live) + preview per-PR + feature-flag = lưới QA thay người-QA.

**Gói 2 — `ai-patterns/` (MỚI)** — mẫu xây tính năng AI:
- `01-vong-hoc-lien-tuc` (human-in-the-loop: đề xuất→duyệt→nhớ→tự động dần; ngưỡng tự-điền/tự-duyệt; PII không gộp não chung) · `02-lien-ket-luong` (state-machine suy read-only · gate mềm · luồn ID qua UI thay vì đổi schema) · `03-red-team-agent` (soi bảo mật "tư duy kẻ tấn công" trước go-live khối PII/tiền).

**Gói 3 — `skills/` (MỚI)** — 4 slash-command đã rửa: `/ra-soat` (rà code song song) · `/kiem-thu` (chạy thử luồng thật) · `/hoi-dong` (hội đồng chuyên gia phản biện) · `/don-tu` (dọn tủ bộ nhớ theo nghĩa + chế độ học-chéo) + README cách cài.

`nang-cap.mjs`/`dong-gop.mjs` đã thêm `ai-patterns/` + `skills/` vào phạm vi (người cũ nâng cấp nhận được; góp ngược được). Đã quét rò sạch + node --check engine 🟢.

## v3.6 — 2026-06-26
Đào thêm **6 cải tiến cấp hệ-trí-nhớ** đúc từ thực chiến vận hành tủ ở quy mô lớn + nhiều phiên song song (đã rửa sạch danh tính). Tất cả vẫn markdown + Node, không vector, không dịch vụ ngoài.

**Engine:**
- `memory-doctor.mjs` — thêm **mục ⑨ LUẬT TRẦN chống phình**: canh 1 mảnh ≤ ~6.000 từ · 1 INDEX nhóm ≤ ~3.000 từ · 1 nhóm ≤ ~60 mảnh → **cảnh báo 🟡 KHÔNG chặn** (phình = nợ kỹ thuật, xé khi rảnh). Chỉnh qua env `MEMORY_MAX_WORDS_PIECE`/`MEMORY_MAX_WORDS_INDEX`/`MEMORY_MAX_PIECES_GROUP`.
- `so-nang-luc.mjs` + `nang-luc-registry.json` — Sổ Năng Lực giờ gom **2 LOẠI**: *năng lực* (`capability:` = cách DỰNG) + 🔧 **đồ nghề chạy được** (`cach-chay:` = công cụ có sẵn gọi chạy NGAY) → in bảng "Đồ nghề chạy được" riêng.
- `eval-recall.mjs` + `recall-eval.sample.json` 🆕 — **bộ đo Recall@K của thủ thư**: biến "bộ tra-cứu có sót mảnh không" thành 1 con số chạy-lại-được (ngưỡng 🔴<80% · 🟡80–92% · 🟢≥92%), 4 loại bẫy (lệch-từ/cross-group/nhóm-to/đối-chứng-dương). Là **cổng quyết định "có cần vector chưa"**.

**Nguyên tắc (`PRINCIPLES.md`) — thêm mục 35–38** + đồ-nghề ở #29:
- **#35 LUẬT TRẦN** — token hao đến từ NHÓM/MẢNH phình, KHÔNG từ Tầng-0 (rẻ+cache); xé mảnh con+hub / sub-INDEX `_idx-<miền>.md` / sub-INDEX 2 cấp.
- **#36 TỰ GHI BỘ NHỚ mỗi checkpoint + QUÉT-SÓT trước /clear** — đừng đợi nhắc; bump `status:` cùng cú edit; `/clear` xoá ngữ cảnh tức thì nên phải ghi TRƯỚC.
- **#37 VERIFY hiện-trạng THẬT trước khi build** — chống "THIẾU GIẢ" (gương ngược của "phủ giả"): grep/đọc code thật trước khi tin backlog "còn thiếu".
- **#38 CHẠY TRỌN trước khi xuất file** — làm hết phần cần-chạy mới rồi xuất 1 lần, đừng xuất nửa-vời.

**Tài liệu:** thêm `docs/do-recall-thu-thu.md`; cập `docs/methodology.md` (mục "Chi phí token đến từ đâu — LUẬT TRẦN" + đổi ngưỡng vector từ "đủ N mảnh" → "recall đo được <90% sau khi xé+alias"), `docs/hoc-cheo-tu-bao-tri.md` (loại đồ-nghề), `docs/giao-thuc-lam-viec-ai.md` (mục 5 checkpoint). Đã quét rò sạch + chạy thử mọi engine 🟢.

## v3.5 — 2026-06-18
**Chốt ĐÍCH gom đóng góp ngược:** thư mục Google Drive chung **"MemoryOS - Đóng góp"** — ghi link vào `CONTRIBUTING.md` (mục 📍) + lời nhắc `dong-gop.mjs` + `HUONG-DAN.html`. Maintainer duyệt + merge từ folder đó. (Đích đánh dấu "[nội bộ — tổ chức khác đổi link]".)

Thêm **NÚT BẤM cho người không rành Terminal** — thư mục `nut-bam/`: `.command` (macOS nhấp đúp) + `.bat` (Windows) cho 3 việc hay làm: **1-Kham-tu** (chạy bác sĩ), **2-Nang-cap** (lên bản mới, giữ data), **3-Dong-gop** (góp ngược). Ghi rõ trong `HUONG-DAN.html`: HTML không tự chạy lệnh được (trình duyệt chặn) → dùng nút bấm hoặc nhờ AI làm hộ. `nang-cap`/`dong-gop` đã thêm `nut-bam/` vào phạm vi. **HUONG-DAN.html viết ĐẦY ĐỦ tự-giải-thích:** ô "2 phần kit / ai đọc gì", Dev Playbook + đóng-góp-ngược ở mục nâng cao, và mục **"Hỏi nhanh"** (giới hạn trung thực: bấm-1-nút-không-xong-hết, cài-mới cần điền tay/nhờ AI, lên bản mới không mất data, Windows/.bat, không cần internet/DB, mở khoá Gatekeeper Mac).

## v3.4 — 2026-06-18
Thêm **Dev Playbook** — gói cẩm nang kỹ thuật tái dùng cho anh em dev, ở thư mục riêng `dev-playbook/` (tách khỏi tủ ký ức để 2 chủ đề không lẫn). 10 bài (deploy Railway an toàn · Supabase RLS/SQL/migration · feature-flag 2 đầu · rate-limit · CMS Express+cheerio+i18n · clone web · an-toàn Git&Claude · chuẩn tài liệu · observability/autofix · điều-phối-đa-phiên trỏ chéo) + `snippets/` code mẫu đã rửa (rate-limit.ts, health-check.ts, feature-flag.ts, sql-idempotent.sql, rls-checklist.sql, cms-render.js, error-report-schema.ts, railpack-env.md, gitleaks-precommit.md). `nang-cap.mjs`/`dong-gop.mjs` đã thêm `dev-playbook/` vào phạm vi (người cũ nâng cấp sẽ nhận; góp ngược được). Đã quét rò sạch.

## v3.3 — 2026-06-18
Thêm **VÒNG HỌC 2 CHIỀU** (đóng góp ngược): `tools/dong-gop.mjs` + `CONTRIBUTING.md`.
- `dong-gop.mjs`: gói CẢI TIẾN phần KHUNG để gửi maintainer — chỉ lấy KHUNG (có git → đúng phần đã đổi vs origin/main; không git → snapshot KHUNG), **TỰ QUÉT RÒ** chặn secret + cảnh báo `--block` tên riêng, **KHÔNG bao giờ** gói `HANDBOOK.md`/`Memories/`. Ra thư mục `…-dong-gop-<ngày>/` (kèm zip) + `DE-XUAT.md` + `proposal.patch`.
- `CONTRIBUTING.md`: quy trình 2 kênh (gói đề-xuất cho non-tech · Pull Request cho người git) + vai maintainer gác cổng (quét rò + duyệt + merge + bump VERSION). Vòng khép kín: `nang-cap` (xuống) ↔ `dong-gop` (lên).

## v3.2 — 2026-06-18
Bổ sung **4 giao thức làm việc con người ↔ AI** (đào thêm theo yêu cầu, đã rửa sạch): thêm `docs/giao-thuc-lam-viec-ai.md` + `PRINCIPLES.md` mục **32–34**:
- **#32 Học từ việc làm** — không bắt người chủ khai báo; học thụ động + hỏi kiểu chọn-sẵn; bài học → Lessons.md → reflection.
- **#33 Chốt thiết kế TRƯỚC khi code** (việc lớn) — đủ data → thiết kế → chốt với người → mới code; rồi rà phản biện độc lập (mở rộng #7).
- **#34 Kết quả AI/agent = đầu-vào-để-kiểm** — verify bằng script/số TRƯỚC khi sửa hàng loạt (mở rộng #13).
Cập nhật `HANDBOOK.template.md` (Mục 7 trỏ học-từ-việc-làm).

## v3.1 — 2026-06-18
Thêm đường **NÂNG CẤP** cho người đã cài bản cũ: `tools/nang-cap.mjs` (1 lệnh, tự sao lưu + giữ data) + `NANG-CAP.md` + file `VERSION`.

## v3 — 2026-06-18
Bổ sung lớp **HỌC CHÉO + TIÊM PHÒNG + TỰ-BẢO-TRÌ** (đúc từ thực chiến, đã rửa sạch danh tính). Tất cả vẫn markdown + Node, không vector, không dịch vụ ngoài.

**Engine mới (`tools/`):**
- `tien-do.mjs` — in **TIEN-DO.md**: bảng tiến độ toàn hệ (đang làm / bị chặn / để-lâu ⚠️ / cảnh báo giẫm chân theo `area:`). Tự gom `status:`/`updated:` mọi mảnh.
- `so-nang-luc.mjs` + `nang-luc-registry.json` — in **SO-NANG-LUC.md**: sổ năng lực HỌC CHÉO ("năng lực → bản tốt nhất ở đâu, độ tin nào"). Tự gom `capability:`+`do-tin:`.
- `moi-so-nang-luc.mjs` — mồi `capability:` hàng loạt từ MAP (chống cold-start; idempotent).
- `ghi-manh.mjs` — tạo mảnh 1 bước, frontmatter đủ + tự vào INDEX (chống thiếu-status/mồ côi tận gốc).
- `md-to-pdf.mjs` — Markdown → HTML đẹp (font Việt + bảng), in PDF qua Chrome headless, không cần pandoc.

**Hook mới:**
- `pre-work-nudge.mjs` (UserPromptSubmit) — ngửi "mùi việc lặp" → nhắc tra Sổ Năng Lực TRƯỚC khi làm.
- `memory-autofix.mjs` (Stop) — chạy bác sĩ `--fix` cuối mỗi lượt (van 90s, im khi sạch) → lỗi cơ học không dồn.

**Nâng cấp engine cũ:**
- `memory-doctor.mjs` — giờ **TỰ VÁ** `status`/`updated` thiếu + mảnh mồ côi (không chỉ vá INDEX); gợi ý tên gần đúng cho link gãy; và **tự in lại** TIEN-DO.md + SO-NANG-LUC.md mỗi phiên (mục ⑦⑧).
- `handbook-gate.mjs` — vá để KHÔNG chặn nhầm **sub-agent** (quét transcript phiên cha trong 6h).
- `cleanup-nudge.mjs` — thêm nhắc **ĐÚC KẾT (reflection)** khi 1 nhóm tích nhiều mảnh mới gần đây.

**Nguyên tắc:** thêm `PRINCIPLES.md` mục **29–31** (học chéo · tiêm phòng · SSOT máy-in). **Tài liệu:** thêm `docs/hoc-cheo-tu-bao-tri.md`; cập nhật `setup-guide.md` (4 hook + bật học chéo), `methodology.md`, `HANDBOOK.template.md`.

**🔼 Đường NÂNG CẤP cho người đã cài bản cũ:** thêm `tools/nang-cap.mjs` (1 lệnh: tự sao lưu + ghi đè phần KHUNG, GIỮ NGUYÊN HANDBOOK.md + Memories/ + cấu hình đã sửa) · `NANG-CAP.md` (hướng dẫn) · file `VERSION` để dò bản. Từ nay lên bản mới chỉ cần chạy `node tools/nang-cap.mjs <thư-mục-bộ-nhớ>`.

## v2 — 2026-06-11
Bổ sung 4 nguyên tắc generic vào `PRINCIPLES.md` (đúc từ thực chiến, đã rửa sạch danh tính):
- **#12 — Hấp thụ tài liệu KỸ + ĐỆ QUY tới tận cùng.** Duyệt hết mọi tab/sheet (kể cả tab công cụ giấu), link con, nhánh lồng; nhiều quá → chia sub-agent đọc song song; báo trung thực đã/chưa đọc; giữ 1 "cây nguồn".
- **#13 — Giao việc cho sub-agent/automation phải KIỂM SOÁT được.** Rõ mục tiêu + nghiệm thu bằng chứng + AI điều phối chịu trách nhiệm cuối; "xong" = đã-kiểm-và-đạt.
- **#27 — Mọi tính năng có CÔNG TẮC tắt/bật tập trung.** Feature-flag 2 đầu (server + client), gắn từ đầu.
- **#28 — Hệ tự-chữa lỗi (autofix) chia 3 VÙNG an toàn.** Vùng đụng tiền = lằn ranh cứng, chỉ đề xuất + chờ duyệt.

Thêm 1 mục vào phần D (ví dụ khẩu vị riêng): giải thích cho người chủ non-tech.

Renumber liền mạch: A 1–13 · B 14–19 · C 20–28 · D (ví dụ).

## v1 — 2026-06-10
Bản đầu: khung trí nhớ AI markdown (không vector) — engine (build-index · memory-doctor · handbook-gate · cleanup-nudge · snapshot) + template + docs + 24 nguyên tắc vàng (A–C) + ví dụ khẩu vị riêng (D) + HUONG-DAN.html cho non-tech.
