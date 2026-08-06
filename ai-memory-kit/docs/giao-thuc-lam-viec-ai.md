# Giao thức làm việc với AI (v3.2)

> 4 giao thức "con người ↔ AI" đúc từ thực chiến — làm cho tủ ký ức không chỉ NHỚ mà còn **học đúng, làm chắc, không tin mù**. Generic, bê thẳng được. Bổ sung cho `PRINCIPLES.md` mục **32–34**.

---

## 1) HỌC TỪ VIỆC LÀM — đừng bắt người chủ "khai báo"

**Vấn đề:** bắt người chủ ngồi mô tả hết "tôi là ai, nguyên tắc gì, thích gì" = khai mãi không xong, mà vẫn thiếu. Người chủ non-tech càng ngại.

**Cách giải:** AI **học thụ động trong lúc làm việc thật** — nhặt mọi quyết định / lời khen / lời sửa / lời bác của người chủ → tự ghi vào mảnh đúng NGAY (giả định phiên có thể đứt).
- **Hỏi kiểu CHỌN-SẴN, không hỏi mở:** gặp ngã rẽ chưa rõ ý → đưa **2–4 đáp án + 1 khuyến nghị**, người chủ bấm 1 phát (đừng bắt họ tự nghĩ ra phương án). Càng ít gõ càng tốt.
- **Mỗi lần người chủ sửa/bác** một việc AI làm → đó là 1 **bài học**: ghi `tình huống → AI làm gì → người chủ muốn gì → quy tắc rút ra` vào file `Lessons.md` (KHÔNG chốt thẳng lên Tầng 0).
- **Định kỳ ~10–15 bài học → reflection:** chắt quy tắc bền lên sổ tay Tầng 0, gộp mục trùng. **GIỮ bản gốc `Lessons.md`** trước khi cắt (cô đọng là LOSSY).

---

## 2) CHỐT THIẾT KẾ TRƯỚC KHI CODE + rà phản biện độc lập (việc LỚN)

**Vấn đề:** đâm đầu code khi chưa đủ dữ kiện / chưa chốt kiến trúc → 2 tuần sau "lại lủng", đập đi làm lại.

**Cách giải (chỉ cho việc lớn/khó đảo — việc nhỏ bỏ qua):**
1. **Đủ dữ liệu thật → THIẾT KẾ → CHỐT với người chủ → MỚI code.** Tách bạch "vẽ đường" (trình lộ trình) với "đi" (thực thi).
2. Thiết kế **ĐỦ để bắt đầu, KHÔNG cầu toàn upfront** — nâng cấp dần khi làm.
3. **Chốt xong → rà PHẢN BIỆN:** tung 1–2 sub-agent ĐỘC LẬP đi tìm mâu thuẫn + lỗ hổng (logic/an toàn/khả thi/hiệu năng) — nhiệm vụ là **PHẢN BÁC, không phải đồng ý** → vá → rồi mới triển khai. Rẻ hơn nhiều so với phát hiện lỗ sau khi đã code.

> Mở rộng `PRINCIPLES.md` #7 (rà phản biện) — thêm vế "chốt thiết kế với người TRƯỚC khi code".

---

## 3) KIỂM SOÁT KẾT QUẢ AGENT + tự-verify bằng CHỨNG trước khi sửa hàng loạt

**Vấn đề:** giao sub-agent rồi tin ngay kết quả → agent đọc trích đoạn hay **báo NHẦM** (vd "83% file sót INDEX" mà thực ra sai), sửa hàng loạt theo đó = hỏng hàng loạt.

**Cách giải:**
- Giao agent rõ **mục tiêu + tiêu chí đạt + định dạng kết quả**; **theo dõi trạng thái** (agent chết/trả rỗng phải bắt, đừng bỏ lặng).
- **Kết quả agent = ĐẦU VÀO ĐỂ KIỂM, không phải kết luận.** Trước khi sửa hàng loạt theo phát hiện của agent → **tự viết 1 script kiểm chứng** (đếm/đối chiếu bằng số trên dữ liệu thật), xác nhận con số ĐÚNG rồi mới sửa.
- **"Xong" = đã-kiểm-và-đạt**, không phải "agent đã chạy". AI điều phối **chịu trách nhiệm cuối**. Tốc độ (bung nhiều agent) KHÔNG đánh đổi đúng-mục-tiêu.

> Mở rộng `PRINCIPLES.md` #13 — thêm vế "verify bằng script TRƯỚC khi sửa hàng loạt".

---

## 4) GHI NHỚ: khi nào ghi ngay vs gom + vòng chắt

(Bổ sung cho `methodology.md` § "Ghi gì / bỏ gì".)
- **Ghi NGAY** (giả định phiên đứt): quyết định + lý do · yêu cầu/mục tiêu mới · kết quả xác nhận xong việc · bài học khi bị sửa/bác. Đừng đợi cuối phiên.
- **Gom rồi mới chắt:** các bài học vụn → tích ở `Lessons.md`, định kỳ reflection mới chắt lên nguyên tắc (xem mục 1).
- **Mốc thời gian:** mỗi sự thật ghi "đúng từ [ngày]"; bị thay → đánh dấu cũ "đã thay [ngày]", KHÔNG xoá (giữ truy vết). Đây là lý do `updated:` có trong mọi mảnh.
- **Phân loại khi ghi:** 🧱 sự thật bền (semantic) → mảnh thường · 📔 số-liệu/sự-kiện theo thời gian (episodic) → file `nhat-ky.md` · 📐 cách-làm-chuẩn (procedural) → `_Common/` · ⚡ việc trong phiên (working) → KHÔNG lưu.

---

## 5) TỰ GHI BỘ NHỚ mỗi checkpoint + QUÉT-SÓT trước khi /clear (v3.6)

**Vấn đề:** AI hay đợi người chủ nhắc "ghi bộ nhớ" mới ghi → nhưng người chủ thường gõ `/clear` (hoặc phiên bị nén/đứt) ngay khi thấy "xong", mà `/clear` **xoá ngữ cảnh tức thì** — không còn khoảng để AI chèn bước ghi sau. Kết quả: mất quyết định/bài học của cả cụm việc.

**Cách giải (AI tự làm, KHÔNG đợi nhắc):**
- "Ghi bộ nhớ" = **2 phần, cả 2 phải tự làm:**
  - **(a) Mốc phiên** — mạch việc đang tới đâu (file `_Sessions/<slug>.md` của bạn), để clear/đổi-máy không mất ngữ cảnh.
  - **(b) Kiến thức dài hạn** (dễ sót nhất) — quét phiên tìm **quyết định / bài học / tiến độ đổi** CHƯA lưu → ghi vào mảnh đúng + chắt nguyên tắc bền lên Tầng 0.
- Sau **mỗi cụm việc xong** (nhất là khi context đã cao) → chủ động làm (a)+(b) NGAY. Ưu tiên ghi **incremental** ngay khi phát sinh (giả định phiên có thể đứt); quét cuối chỉ là lưới an toàn.
- ⚠️ **Đổi tiến độ → bump `status:` frontmatter CÙNG cú edit** với thân mảnh (kẻo `TIEN-DO.md` báo nhầm — SSOT, #31).
- 🚨 **TRƯỚC khi gợi ý `/clear`** (hoặc trước nén tự động): bắt buộc chạy **QUÉT-SÓT** toàn phiên — "còn quyết định/bài học/đổi-tiến-độ nào chưa vào mảnh?" → ghi hết RỒI mới báo **"an toàn /clear"**.
- (Tuỳ chọn) hook `PreCompact` đảm bảo có mốc phiên trước khi máy tự nén — nhưng hook shell KHÔNG thay được bước tóm tắt theo NGHĨA, phải là AI tự làm.

> Mở rộng `methodology.md` § "Ghi gì / bỏ gì" (mục 4 ở trên) — thêm vế **checkpoint định kỳ + cổng-chặn-trước-clear**.

---

> 🔁 5 giao thức này khép vòng với hệ học chéo + tiêm phòng (`hoc-cheo-tu-bao-tri.md`): **học đúng** (mục 1) → **làm chắc** (mục 2) → **không tin mù** (mục 3) → **nhớ bền** (mục 4) → **không-mất-khi-clear** (mục 5) → tái dùng (Sổ Năng Lực).
