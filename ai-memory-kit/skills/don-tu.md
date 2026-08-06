---
description: DỌN TỦ BỘ NHỚ — quét tủ ký ức THEO NGHĨA để bắt mảnh trùng/chồng, mâu thuẫn, để nhầm nhóm, vụn nên đúc thành nguyên tắc → tờ trình 🟢🟡🔴 cho người chủ duyệt rồi mới sửa. Snapshot trước. KHÁC memory-doctor (lỗi cơ học) và /ra-soat (rà CODE).
argument-hint: "[để trống = dọn cả tủ] | 1 nhóm · 'nhanh' / 'kỹ' · '--hoc-cheo' (đúc kết Sổ Năng Lực)"
---

# /don-tu — Dọn tủ bộ nhớ (máy quét theo nghĩa)

Gọi lệnh này khi tủ ký ức tích nhiều mảnh và muốn gom/tổ chức lại cho gọn & đúng. (Có thể nối hook `tools/cleanup-nudge.mjs` để tự nhắc khi tủ tích +N mảnh hoặc quá D ngày.)

**Phân vai — đừng nhầm 3 thứ:**
- `tools/memory-doctor.mjs` = lỗi **CƠ HỌC** (nhãn frontmatter thiếu, INDEX lệch, link gãy, file rác, vượt LUẬT TRẦN). Máy tự làm.
- `/ra-soat` = rà **CODE** của các dự án (không liên quan tủ bộ nhớ).
- `/don-tu` (lệnh này) = lỗi **THEO NGHĨA** trong TỦ BỘ NHỚ — thứ chỉ đọc-hiểu mới thấy: 2 mảnh cùng 1 việc, 2 mảnh mâu thuẫn, mảnh để nhầm nhóm, nhiều vụn nên đúc thành 1 nguyên tắc.

**Triết lý:** *Máy QUÉT + ĐỀ XUẤT — người DUYỆT — mới GHI.* Việc vô hại máy tự làm; việc mất ngữ cảnh (gộp ý, xử mâu thuẫn, xoá) thì khựng lại chờ người. Một quyết định bị xoá nhầm đắt hơn nhiều so với 2 phút bấm duyệt.

`$ARGUMENTS` (tuỳ chọn): nêu 1 nhóm → chỉ dọn nhóm đó; "nhanh" → ít trợ lý, bỏ phần đúc nguyên tắc; "kỹ" → thêm trợ lý + pass xuyên nhóm. Để trống = dọn cả tủ, mức vừa.

## Cách chạy (BẮT BUỘC theo quy trình này)

### 1. AN TOÀN TRƯỚC — snapshot + dọn cơ học
- Chạy `tools/snapshot.sh` (chụp bản sao ra ngoài cây bộ nhớ). **Không bao giờ động vào tủ khi chưa snapshot.**
- Chạy `node tools/memory-doctor.mjs --fix` để vá phần CƠ HỌC trước (INDEX lệch, link gãy, nhãn) — để pass theo nghĩa không bị nhiễu. Báo gọn doctor thấy gì.

### 2. QUÉT THEO NGHĨA — tung trợ lý song song (CHỈ ĐỌC, không sửa)
Gửi tất cả trong **1 lượt**. **Mỗi nhóm lớn trong `Memories/` = 1 trợ lý** (nhóm rất lớn tách 2). Thêm:
- **1 trợ lý XUYÊN NHÓM:** đọc `Memories/MEMORY.md` + mọi `INDEX.md` để bắt **trùng/mâu thuẫn nằm ở 2 nhóm khác nhau** — thứ trợ lý từng-nhóm không thấy.
- **1 trợ lý FILE GỐC:** soi `HANDBOOK.md` (sổ tay Tầng 0) xem có vụn ở `Memories/` đáng **đúc lên** thành nguyên tắc gốc không.

**Mỗi trợ lý trả về danh sách phát hiện**, mỗi cái: `đường/dẫn` (các mảnh liên quan) · **loại** · mô tả 1–2 câu · **đề xuất xử lý cụ thể** (gộp vào đâu / chuyển nhóm nào / cái nào mới-cũ). 4 loại:
- 🔁 **TRÙNG/CHỒNG** — ≥2 mảnh nói gần như cùng việc (dù chữ khác). Đề xuất gộp vào mảnh nào.
- ⚔️ **MÂU THUẪN** — 2 mảnh nói trái nhau (vd 2 ngày chốt khác nhau cho cùng quyết định). Nêu cái nào có vẻ mới hơn — KHÔNG tự quyết.
- 📂 **NHẦM NHÓM** — mảnh để sai dự án / sai nơi.
- 🧊 **VỤN NÊN ĐÚC** — nhiều mảnh nhỏ cùng hướng nên gom thành 1 mảnh tổng (hoặc đúc thành nguyên tắc ở `HANDBOOK.md`).

### 3. GOM + PHÂN LOẠI RỦI RO 🟢🟡🔴 (theo độ khó-đảo-ngược)
| Mức | Là gì | Máy được làm gì |
|---|---|---|
| 🟢 **Tự làm (an toàn)** | Trùng HỆT (bản sao y) · dòng trỏ INDEX/MEMORY thừa/chết · lỗi cơ học còn sót | Sửa luôn, chỉ **báo lại** (không hỏi từng cái) |
| 🟡 **Đề xuất (chờ gật)** | Gộp ý 2 mảnh khác chữ · đúc vụn thành nguyên tắc · chuyển nhầm nhóm | **CHỜ DUYỆT** |
| 🔴 **Cảnh báo (chỉ nêu)** | 2 mảnh **MÂU THUẪN** nội dung · bất cứ thứ gì cần XOÁ một quyết định | **Không bao giờ tự làm** — người chủ quyết |

🔴 còn ngờ → tung 1 trợ lý PHẢN BIỆN đọc kỹ 2 mảnh xác nhận đúng là mâu thuẫn (không phải hiểu nhầm) trước khi trình.

### 4. TRÌNH NGƯỜI CHỦ — tờ trình gọn (non-tech)
- 🟢 **Đã tự dọn:** 1 dòng/cái.
- 🟡 **Đề xuất — chờ gật:** mỗi cái 1 dòng dễ hiểu: *"Gộp A + B → 1 (vì cùng nói về X). Đồng ý?"* Đánh số để chọn nhanh ("làm 1,3,4").
- 🔴 **Mâu thuẫn — người chủ quyết:** nêu rõ 2 mảnh khác nhau ra sao, cái nào có vẻ mới, hỏi giữ cái nào.
- Khen phần tủ đang gọn. **KHÔNG tự làm 🟡🔴 khi chưa gật.**

### 5. SAU KHI DUYỆT — sửa & đóng sổ (quy tắc GIỮ VẾT)
- Trùng HỆT → xoá bản thừa (git mirror đã giữ lịch sử).
- Quyết định **bị thay** → KHÔNG xoá mảnh cũ; đánh dấu "↪️ đã thay bằng [[mảnh-mới]] ngày DD/MM".
- Gộp → đúc vào 1 mảnh chuẩn; mảnh kia trỏ tới rồi xoá (hoặc `archived` nếu có lịch sử đáng giữ).
- Chạy `node tools/build-index.mjs --all --write` in lại mọi INDEX cho khớp.
- **Reset đồng hồ nhắc:** cập `.cleanup-state.json` → `count` = số mảnh thật hiện tại, `date` = hôm nay, ghi tóm tắt 1 dòng đã dọn gì (quên bước này → lần sau bị nhắc oan).

## 🔀 CHẾ ĐỘ HỌC CHÉO (`/don-tu --hoc-cheo`)
Cùng KHUNG 5 bước, nhưng **ĐỔI TRỤC quét:** thay vì bắt mảnh trùng, **đối chiếu các BẢN cùng 1 NĂNG LỰC giữa các dự án để chọn/cập BẢN CHUẨN** (backstop cho hệ Học Chéo — xem `docs/hoc-cheo-tu-bao-tri.md`).

**Bước 2 đổi thành:** đọc `Memories/SO-NANG-LUC.md` + `tools/nang-luc-registry.json`. Mỗi trợ lý nhận 1 cụm năng lực, đối chiếu các bản (mảnh có `capability:`/`cach-chay:`) + soi dự án CHƯA gắn nhãn, trả về:
- 🥇 **BẢN CHUẨN đúng chưa** — headline có thật tốt nhất? `do-tin` khớp thực tế (đã chạy prod=`cao`; mới phác=`thap`)? con trỏ có trỏ mảnh chết/đổi tên?
- ➕ **MẢNH CHƯA GẮN** — dự án vừa làm 1 năng lực mà mảnh chưa có `capability:` → đề xuất gắn (slug + do-tin).
- 🆙 **NÊN NÂNG CẤP** — dự án Y đang xài bản cũ trong khi đã có bản chuẩn tốt hơn → nên chuyển.
- 🌱 **NĂNG LỰC MỚI** — loại việc lặp được chưa có trong registry → đề xuất thêm slug + từ-khoá.

**Bước 5 đổi thành:** sửa frontmatter `capability:`/`do-tin:`/`cach-chay:` đã duyệt + thêm năng lực mới vào `nang-luc-registry.json` → `node tools/so-nang-luc.mjs --write` in lại Sổ.

## Ghi chú
- Dọn **đọc-hiểu theo nghĩa** (không phải vector thật) → mảnh dùng từ hoàn toàn khác vẫn có thể sót; pass xuyên-nhóm + đi theo `[[wikilink]]` là lưới bù. Muốn đo độ sót → `docs/do-recall-thu-thu.md`.
- Mảnh nhạy cảm (số liệu KD/cá nhân): khi trình tờ trình, chỉ nói "có mảnh nhạy cảm tại đường/dẫn", **không bê nội dung ra**.
