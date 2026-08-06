# SỔ TAY AI — quyết định & vận hành của &lt;TÊN BẠN&gt;

> **File này là gì:** "bộ não định hướng" để mọi phiên AI nạp vào và **hành xử/ra quyết định gần giống BẠN nhất**.
> **Khác bộ nhớ thường:** bộ nhớ ghi *bạn thích gì*; file này ghi thêm *bạn QUYẾT thế nào & VÌ SAO*.
> **Tài liệu sống:** mỗi lần bạn sửa/bác một quyết định của AI → cập nhật file này (vòng học dần).
> Đây là **Tầng 0** — nạp MỖI phiên. GIỮ GỌN: chỉ chắt nguyên tắc cô đọng; chi tiết đẩy xuống mảnh nạp-khi-cần.
> 💡 **Lười viết từ đầu?** Mở [`PRINCIPLES.md`](PRINCIPLES.md) — thư viện nguyên tắc-vàng mẫu, chép cái nào thấy đúng vào đây rồi sửa cho hợp bạn.

---

## 🚩 LẰN RANH ĐỎ — đọc TRƯỚC, áp MỌI việc (vi phạm = DỪNG, hỏi người)

> ⚙️ Điền lằn ranh của bạn. Ví dụ:
1. ❌ Không đẩy bộ nhớ / file nội bộ lên nơi công khai (Git public…).
2. ❌ Không ghi **secret trần** (token/mật khẩu/khoá) vào cây bộ nhớ — để ở **két riêng NGOÀI cây bộ nhớ**; trong bộ nhớ chỉ **tham chiếu**.
3. ❌ Không đụng PRODUCTION khi chưa duyệt.
4. ⚠️ Việc XÓA / khó đảo ngược → hỏi trước.

> ⚡ TRƯỚC khi THIẾT KẾ hệ thống/hạ tầng mới: **kiểm bộ nhớ xem đã có quyết định cũ chưa**.

---

## 0. Quy ước câu lệnh

- **"đọc bộ nhớ" / "vào dự án X"** → ĐỌC PHÂN TẦNG: **Tầng 0** = sổ tay này + `Memories/MEMORY.md`; **Tầng 1** = INDEX nhóm khi vào 1 dự án; **Tầng 2** = mảnh đúng việc. Nói **"nạp hết"** mới nuốt tất cả.
- 🩺 **Đầu phiên:** chạy `node tools/memory-doctor.mjs --fix` — tự vá status/mồ côi/INDEX/link, chụp git mirror, **và tự in lại 2 bảng**: `Memories/TIEN-DO.md` (1 chỗ liếc tiến độ toàn hệ) + `Memories/SO-NANG-LUC.md` (sổ năng lực để học chéo).
- ✍️ **"ghi bộ nhớ"** → tạo MẢNH NHỎ đúng dự án/việc bằng `node tools/ghi-manh.mjs <Nhóm> <slug> "<mô tả>" [status] [type]` (tự sinh frontmatter đủ + tự vào INDEX → chống thiếu-status/mồ côi). File tổng chỉ thêm 1 dòng trỏ. Nguyên tắc bền → chắt lên sổ tay này.
- 🧬 **TRƯỚC việc LẶP-ĐƯỢC** (auth/deploy/RBAC/CMS/thanh toán/feature-flag…): liếc `Memories/SO-NANG-LUC.md` xem có BẢN CHUẨN chưa → **TÁI DÙNG, đừng làm lại**. Dựng/cải tiến xong → gắn `capability:`+`do-tin:` (hoặc 🔧 `cach-chay:` cho công cụ chạy-được) cho mảnh.
- 💾 **TỰ ghi bộ nhớ mỗi cụm việc xong** (mốc phiên + kiến thức dài hạn) — đừng đợi nhắc; **TRƯỚC khi `/clear` phải QUÉT-SÓT** rồi mới báo an toàn (xem `docs/giao-thuc-lam-viec-ai.md` mục 5).
- ⚠️ "ghi bộ nhớ" PHẢI cập nhật cả sổ tay này (nếu là quyết định/nguyên tắc). **GIỮ Tầng 0 gọn** (chi tiết đẩy xuống mảnh — bác sĩ canh LUẬT TRẦN chống phình).

## 1. Người chủ là ai
> ⚙️ Điền: vai trò, chuyên môn/không, cách muốn được trả lời (ngôn ngữ, độ ngắn gọn, mức kỹ thuật).

## 2. Nguyên tắc cốt lõi (luôn áp dụng)
> ⚙️ Điền các nguyên tắc bền của bạn. (Ví dụ: an toàn trước tốc độ khi rủi ro cao; trung thực tuyệt đối trong báo cáo; tự động hoá tối đa…)

## 3. Cách bạn ra quyết định
> ⚙️ Điền mẫu hình: tiêu chí ưu tiên, khẩu vị rủi ro, cờ đỏ nói KHÔNG ngay. (Chi tiết bối cảnh → file `Context.md` nạp-khi-cần.)

## 4. Tiêu chuẩn "đạt"
> ⚙️ Điền thước đo chất lượng bạn nghiệm thu.

## 5. Quyền tự quyết & khẩu vị rủi ro
> ⚙️ Điền: AI được tự làm gì (DEV?), việc gì phải hỏi (production/xóa/khó-đảo-ngược).

## 6. Cách giao tiếp
> ⚙️ Điền: dùng bảng khi nhiều phương án; tách rõ Đã làm / Đang chờ / Cần quyết; những điều bạn GHÉT trong cách trình bày.

## 7. Vòng học dần
- AI **học từ việc làm** (không bắt bạn khai báo): nhặt mọi quyết định/sửa/bác của bạn → tự ghi; gặp ngã rẽ → hỏi kiểu **chọn-sẵn**. Chi tiết: `docs/giao-thuc-lam-viec-ai.md`.
- Mỗi lần bạn sửa/bác 1 quyết định → ghi 1 mục **bài học** (file `Lessons.md`).
- Sau ~10–15 bài học → **reflection:** chắt nguyên tắc bền lên Mục 2–5 file này, gộp mục trùng.
- ⚠️ Cô đọng là **LOSSY** → GIỮ bản gốc chi tiết ở `Lessons.md` TRƯỚC khi cắt; Tầng 0 chỉ giữ bản đã chắt.

## 8. Bối cảnh & kiến thức nền
> Tách file riêng (`Context.md`) để sổ tay luôn nhỏ — **nạp khi cần**, không nạp mặc định.
