# MemoryOS

> 🚀 **Cài nhanh nhất (khuyến nghị): [`CAI-DAT-1-LAN.md`](CAI-DAT-1-LAN.md)** — chạy `cai-dat.sh` **1 lần**, wire GLOBAL vào `~/.claude` → mọi project trên máy tự biết vault, không cần cài lại.
>
> 👉 **Mới nhận bộ này? NHẤP ĐÚP file [`HUONG-DAN.html`](HUONG-DAN.html)** — mở bằng trình duyệt, đọc là làm theo được (không cần biết kỹ thuật).
>
> 🔼 **Đã cài bản cũ (v1/v2) rồi?** Muốn lên bản mới mà KHÔNG mất dữ liệu → xem [`NANG-CAP.md`](NANG-CAP.md) (1 lệnh `node tools/nang-cap.mjs <thư-mục-của-bạn>`, tự sao lưu + giữ nguyên sổ tay & mảnh của bạn).
>
> 🔁 **Học được cái hay, muốn góp ngược cho cả nhóm?** Xem [`CONTRIBUTING.md`](CONTRIBUTING.md) (`node tools/dong-gop.mjs "đề xuất"` — chỉ gói phần KHUNG + tự quét rò chặn dữ liệu riêng). Vòng 2 chiều: `nang-cap` (xuống) ↔ `dong-gop` (lên).

Kit này ưu tiên **bộ nhớ NGHIỆP VỤ** (business rules) dùng chung nhiều dự án.

Bộ khung **trí nhớ cho trợ lý AI** bằng file markdown đọc-được — có kỷ luật, tự kiểm tra, không cần vector DB. Cho cá nhân/team tự dựng "tủ ký ức" riêng để AI nhớ quyết định, dự án, cách làm việc qua nhiều phiên.

> Đây là **bộ KHUNG rỗng** (engine + template + ví dụ). KHÔNG chứa dữ liệu riêng của ai — bạn điền của mình.

## Có gì trong này
```
HANDBOOK.template.md     Sổ tay AI (Tầng 0) — khung rỗng, điền của bạn
NANG-CAP.md              Hướng dẫn NÂNG CẤP cho người đã cài bản cũ 🆕
VERSION                  Số phiên bản kit (để dò bản khi nâng cấp) 🆕
PRINCIPLES.md            Thư viện NGUYÊN TẮC VÀNG (mẫu) — bê thẳng cái nào đúng vào HANDBOOK
Memories/                Cây bộ nhớ: MEMORY.md (mục lục tổng) + các nhóm + ví dụ
tools/                   engine (Node) + hook + snapshot:
  build-index.mjs          in lại INDEX nhóm từ frontmatter (SSOT)
  build-catalog.mjs        in MỤC-LỤC PHẲNG toàn tủ (tra 2 bước · canonical lên đầu) 🆕
  doi-soat.mjs             đối-soát trạng-thái ↔ chứng-cứ Git (chống over-claim) 🆕
  memory-doctor.mjs        khám + TỰ VÁ status/mồ côi/INDEX + chụp git mirror + in 2 bảng + canh LUẬT TRẦN ⑨ 🆕
  tien-do.mjs              in bảng TIẾN ĐỘ toàn hệ (1 chỗ liếc) 🆕
  so-nang-luc.mjs          in SỔ NĂNG LỰC (học chéo: năng lực + 🔧 đồ nghề chạy được) 🆕
  eval-recall.mjs          đo RECALL@K của thủ thư (bộ tra-cứu có sót mảnh không) 🆕
  recall-eval.sample.json  bộ câu hỏi MẪU cho eval-recall (4 loại bẫy) 🆕
  moi-so-nang-luc.mjs      mồi capability hàng loạt (chống cold-start) 🆕
  ghi-manh.mjs             tạo mảnh 1 bước, đúng chuẩn từ đầu 🆕
  nang-luc-registry.json   danh mục năng lực + từ-khoá (sửa cho hợp bạn) 🆕
  md-to-pdf.mjs            Markdown → HTML đẹp (in PDF qua Chrome) 🆕
  nang-cap.mjs             nâng cấp tủ đã cài lên bản mới (giữ data) 🆕
  handbook-gate.mjs        hook chặn sửa bộ nhớ khi chưa đọc Tầng 0
  cleanup-nudge.mjs        hook nhắc dọn tủ + nhắc đúc-kết khi tới hẹn
  pre-work-nudge.mjs       hook nhắc tra Sổ Năng Lực trước việc lặp 🆕
  memory-autofix.mjs       hook tự khám + vá cuối mỗi lượt 🆕
  snapshot.sh              snapshot FIFO ra ngoài cây bộ nhớ
  cai-dat.sh               cài GLOBAL 1 lần vào ~/.claude — mặc định/khuyến nghị, xem CAI-DAT-1-LAN.md 🆕
  install-memory.sh        cài hook per-project (settings.local.json) — nâng cao, khi cần khác vault cho từng repo
  dong-gop.mjs             gói phần KHUNG + tự quét rò → góp ngược lên nhóm
  test-fixes.mjs           test hồi quy cho engine (CRLF · SECRET_RE…) 🆕
templates/               mẫu mảnh · INDEX nhóm · CLAUDE.md repo · tien-do (bảng tiến độ) · BACKLOG (điều phối đa-phiên)
docs/                    methodology · setup-guide · multi-session · hoc-cheo-tu-bao-tri · giao-thuc-lam-viec-ai · do-recall-thu-thu · chay-bo-nho-nhe-tiet-kiem-token (tiết kiệm token) · trang-thai-cong-viec-6-nac (task-state 6 nấc) 🆕
```

## Quickstart
```bash
# 1. Copy kit thành thư mục bộ nhớ của bạn, đổi HANDBOOK.template.md → HANDBOOK.md, điền vào.
# 2. Chạy thử engine:
node tools/build-index.mjs --all --write
node tools/memory-doctor.mjs --fix          # khám + vá + in TIEN-DO.md & SO-NANG-LUC.md
# 3. Nối 4 hook vào trợ lý AI: SessionStart→cleanup-nudge · PreToolUse→handbook-gate
#    UserPromptSubmit→pre-work-nudge · Stop→memory-autofix
```
Chi tiết: [docs/setup-guide.md](docs/setup-guide.md). Triết lý + vì-sao-không-vector: [docs/methodology.md](docs/methodology.md). Học chéo + tiêm phòng: [docs/hoc-cheo-tu-bao-tri.md](docs/hoc-cheo-tu-bao-tri.md).

## Ý tưởng cốt lõi (1 phút)
- **Đọc phân tầng:** chỉ Tầng 0 nạp mặc định → mỗi phiên nhẹ.
- **SSOT:** trạng thái chỉ sống ở frontmatter mảnh; INDEX là báo cáo TỰ IN → không lệch tầng.
- **1 mảnh = 1 ý**, liên kết bằng `[[tên]]` (tên trùng nhiều nhóm → ghi rõ `[[Nhóm/tên]]`).
- **Ghi gì/bỏ gì có luật** + 4 loại ký ức (bền/nhật ký/quy trình/phiên) + mốc thời gian "đúng từ ngày".
- **3-2-1 versioning** tự động (git mirror + snapshot + off-site), không `.bak` tay.
- **Tự-kiểm 3 lớp:** bác sĩ (cơ học) · dọn-theo-nghĩa (người duyệt) · cổng-đọc-Tầng-0.
- **Reflection** định kỳ chắt bài học — nhớ cô-đọng là LOSSY, giữ bản gốc trước khi cắt.
- 🧬 **Học chéo:** gắn `capability:` cho mảnh → `SO-NANG-LUC.md` tự in "bản tốt nhất ở đâu" → tái dùng, đừng dựng lại.
- 💉 **Tiêm phòng:** tạo mảnh 1 bước (đúng chuẩn từ đầu) + bác sĩ tự-vá + tự-khám cuối lượt → lỗi không dồn.
- 📊 **1 chỗ liếc tiến độ:** `TIEN-DO.md` tự in (đang làm / bị chặn / để lâu / giẫm chân).
- 🗂️ **Trạng thái VIỆC 6 nấc** (plan→wip→blocked→done→verified→activated) tách khỏi status mảnh — cấm nhảy tắt merge→bật-thật; bảng việc tự in ([docs/trang-thai-cong-viec-6-nac.md](docs/trang-thai-cong-viec-6-nac.md)).
- 📏 **Luật trần chống phình:** token hao đến từ NHÓM/MẢNH phình (không phải Tầng-0) → bác sĩ canh trần mảnh/INDEX/nhóm, nhắc xé (🟡 không chặn). Cẩm nang chạy-nhẹ/tiết-kiệm-token: [docs/chay-bo-nho-nhe-tiet-kiem-token.md](docs/chay-bo-nho-nhe-tiet-kiem-token.md).
- 💾 **Tự ghi bộ nhớ mỗi checkpoint** + quét-sót TRƯỚC `/clear` (đừng đợi nhắc — `/clear` xoá ngữ cảnh tức thì).
- 🔧 **Đồ nghề chạy được:** gắn `cach-chay:` → Sổ Năng Lực gom riêng "công cụ gọi chạy ngay".
- 📐 **Đo được recall thủ thư** (`eval-recall.mjs`): cổng quyết định "đã cần vector chưa" — không đoán.
- **Nhiều phiên song song?** 1 file `_Backlog.md` chung + 11 luật tự-nạp ([docs/multi-session.md](docs/multi-session.md)).
- **Xem trực quan (tùy chọn):** mở kho bằng Obsidian để nhìn graph mạng lưới ký ức.
- **Secret KHÔNG vào cây bộ nhớ** — để két riêng ngoài cây; engine chặn nếu thấy secret.

## Dùng nội bộ
Khung này để chia sẻ trong nhóm/đồng nghiệp tự dựng tủ riêng. Không kèm dữ liệu, không secret. Cứ sửa cho hợp bạn.
