# Học chéo + Tiêm phòng + Tự-bảo-trì (v3)

> 3 tầng "tự chủ" mà bản v3 thêm vào kit. Mục tiêu: tủ ký ức **tự khoẻ + tự dạy lại chính nó**, người chỉ lo phần NGHĨA. Tất cả vẫn là markdown + vài engine Node, không vector, không dịch vụ ngoài.

---

## 1) HỌC CHÉO — "đã từng làm chưa? bản tốt nhất đâu?" → TÁI DÙNG

**Vấn đề:** một tổ chức làm đi làm lại các việc LẶP-ĐƯỢC (đăng nhập, deploy, phân quyền, CMS, thanh toán, feature-flag, upload, gửi email…). Mỗi lần dựng lại từ đầu = tốn công + chất lượng không đều.

**Cách giải (3 bộ phận):**
| Bộ phận | File | Vai trò |
|---|---|---|
| **Sổ Năng Lực** | `Memories/SO-NANG-LUC.md` (máy in) | Bảng "năng lực → BẢN CHUẨN ở đâu, độ tin bao nhiêu, mấy bản". TỰ IN từ `capability:`+`do-tin:` của mọi mảnh — không gõ tay, không lệch. |
| **Danh mục năng lực** | `tools/nang-luc-registry.json` | Liệt kê các năng lực + từ-khoá. Sửa file này để hợp lĩnh vực của bạn. |
| **Hook nhắc** | `tools/pre-work-nudge.mjs` (UserPromptSubmit) | Ngửi "mùi việc lặp" trong câu lệnh → nhắc liếc Sổ TRƯỚC khi làm. |

**Cách dùng:**
1. Gắn `capability: <slug>` + `do-tin: cao|vua|thap` vào **frontmatter** mảnh là "bản tốt nhất" của một năng lực. (`da-dung-o:` ghi đã dùng thật ở đâu — tuỳ chọn.)
2. Chạy `node tools/so-nang-luc.mjs --write` (hoặc cứ để `memory-doctor` đầu phiên tự in).
3. TRƯỚC khi dựng việc lặp → mở Sổ → thấy bản `do-tin: cao` còn sống thì **đọc & tái dùng**. Bản `do-tin: thap` (chưa kiểm) thì tái dùng phải **cảnh báo**.
4. **Mồi nhanh lúc khởi động:** sửa `MAP` trong `tools/moi-so-nang-luc.mjs` trỏ tới các mảnh sẵn có → `node tools/moi-so-nang-luc.mjs --write` (idempotent, chạy lại được).

> 🆚 Khác với "thủ thư" (tra tri thức "đã từng QUYẾT/NGHĨ gì về X"): Sổ Năng Lực trả lời "đã từng **LÀM** gì, bản nào TỐT NHẤT để **TÁI DÙNG**".

### 1b) 🔧 ĐỒ NGHỀ CHẠY ĐƯỢC — loại thứ 2 trong cùng 1 Sổ
Sổ Năng Lực gom **2 loại** (gộp 1 catalog, đừng dựng hệ riêng):

| Loại | Tag frontmatter | Trả lời câu hỏi | Ví dụ |
|---|---|---|---|
| **Năng lực** | `capability: <slug>` | "CÁCH dựng tính năng này — bản chuẩn ở đâu?" | pattern auth, cách deploy an toàn, RBAC… |
| 🔧 **Đồ nghề** | `cach-chay: <lệnh/đường-dẫn>` | "có CÔNG CỤ chạy NGAY không?" | trình quét site, script đối soát, nút bấm `.command`… |

- **3 điều kiện vào tủ đồ nghề:** ① tái-dùng-được ở dự án khác · ② có lệnh chạy độc lập rõ ràng · ③ `do-tin:` ≥ vừa. Script chạy-một-lần cho 1 repo thì KHÔNG đủ tư cách.
- Nhiều script nhỏ hay dùng cùng nhau → gom **1 mảnh hub**, đừng tách lẻ (khó quản).
- Dựng/cải tiến xong 1 công cụ tái-dùng-được → gắn `cach-chay:` cho mảnh **NGAY** (kẻo Sổ trễ → tra ra bản cũ, tệ hơn không có).
- `so-nang-luc.mjs` in bảng **"🔧 Đồ nghề chạy được"** riêng (tự gom từ `cach-chay:`), xếp theo `do-tin:` cao trước.

---

## 2) TIÊM PHÒNG — chặn lỗi NGAY LÚC TẠO, đừng đợi đi vá

Thứ tự ưu tiên: **chặn-lúc-tạo > tự-vá > khám-đầu-phiên**.

- **Chặn-lúc-tạo:** dùng `node tools/ghi-manh.mjs <Nhóm> <slug> "<mô tả>" [status] [type]` để tạo mảnh — tự sinh frontmatter ĐỦ (name/description/status/updated/type) + tự thêm vào INDEX nhóm. Không còn cảnh "gõ tay file rồi quên status / quên thêm vào mục lục → mảnh mồ côi".
- **Tự-vá:** `memory-doctor.mjs --fix` tự gắn `status`/`updated` còn thiếu (đoán theo loại mảnh) + tự thêm mảnh mồ côi vào cuối INDEX + in lại INDEX lệch. Lỗi cơ học không dồn lại.
- **Tự-khám cuối lượt:** hook `tools/memory-autofix.mjs` (Stop) chạy bác sĩ `--fix --no-snapshot` sau mỗi lượt trả lời (van tiết lưu 90s, im khi sạch) → lỗi không tích quá 1 lượt.

**Ranh giới:** máy chỉ tự-vá lỗi CƠ HỌC vô hại (nhãn/mồ côi/index). Việc THEO NGHĨA (gộp/xoá/sửa nội dung) luôn chờ người duyệt.

---

## 3) TỰ-BẢO-TRÌ — 2 bảng tự in + dọn theo nghĩa

`memory-doctor.mjs` đầu phiên giờ làm thêm 2 việc (ngoài khám ①–⑥ + chụp git mirror):

- **⑦ `Memories/TIEN-DO.md`** — "1 chỗ liếc toàn cảnh": việc nào đang làm / bị chặn / để lâu (mảnh `wip|blocked` quá 3 ngày chưa đụng được gắn ⚠️) + cảnh báo **giẫm chân** (2 mảnh nóng cùng `area:`). Tự gom `status:`/`updated:`/`area:` mọi mảnh.
- **⑧ `Memories/SO-NANG-LUC.md`** — Sổ Năng Lực ở mục (1).

Cả 2 là **báo cáo MÁY in** (giữa 2 marker) — đừng sửa tay. Chạy riêng được: `node tools/tien-do.mjs --write`, `node tools/so-nang-luc.mjs --write`.

**Dọn theo NGHĨA** (con người ở cổng): khi tủ tích nhiều mảnh, `cleanup-nudge.mjs` nhắc 2 thứ — (a) dọn trùng/mâu thuẫn/nhầm nhóm; (b) **đúc kết** (reflection): nhóm nào tích ≥6 mảnh mới gần đây → gợi ý đúc vụn thành 1–2 nguyên tắc tái dùng. Máy chỉ NHẮC; gộp/xoá là người quyết.

---

## Tóm tắt engine v3 (trong `tools/`)
| Engine | Loại | Việc |
|---|---|---|
| `tien-do.mjs` | máy in | Bảng tiến độ toàn hệ (TIEN-DO.md) |
| `so-nang-luc.mjs` | máy in | Sổ năng lực học chéo (SO-NANG-LUC.md) |
| `moi-so-nang-luc.mjs` | 1 lần | Mồi `capability:` hàng loạt từ MAP (chống cold-start) |
| `ghi-manh.mjs` | lệnh | Tạo mảnh 1 bước, đúng chuẩn từ đầu |
| `memory-autofix.mjs` | hook Stop | Tự khám cuối mỗi lượt (van 90s) |
| `pre-work-nudge.mjs` | hook UserPromptSubmit | Nhắc tra Sổ trước việc lặp |
| `nang-luc-registry.json` | cấu hình | Danh mục năng lực + từ-khoá (sửa cho hợp bạn) |
| `md-to-pdf.mjs` | tiện ích | Markdown → HTML đẹp (in PDF qua Chrome) |

> Các nguyên tắc tương ứng đã thêm vào `PRINCIPLES.md` mục **29–31** (học chéo · tiêm phòng · SSOT máy-in).
