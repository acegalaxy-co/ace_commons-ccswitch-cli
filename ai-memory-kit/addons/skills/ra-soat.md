---
description: RÀ SOÁT toàn hệ bằng nhiều trợ lý song song (bảo mật · logic · UX · hiệu năng · độ bền · giao diện) → gom + ưu tiên + đề xuất sửa. Cặp với /kiem-thu (chạy thử thật).
argument-hint: "[để trống = rà đủ] | hoặc nêu góc/khu cần rà, vd: bảo mật, trang thanh toán…"
---

# /ra-soat — Rà soát toàn hệ bằng nhiều trợ lý song song (đọc-soi tĩnh)

Gọi lệnh này khi: **xong 1 dự án**, hoặc **sau nhiều thay đổi**, để giữ hệ luôn ở trạng thái tốt nhất.
Cặp đôi: **`/ra-soat` = đọc-soi tĩnh** (đọc code, suy luận tìm lỗi tiềm ẩn) · **`/kiem-thu` = chạy-thử động** (thật sự chạy luồng với data thật). Rà xong nên kiểm thử để xác nhận.

`$ARGUMENTS` (tuỳ chọn): nêu góc cụ thể (vd "bảo mật") hoặc khu cụ thể (vd "trang thanh toán") → THU HẸP đúng phần đó; để trống = rà đủ.

## Cách chạy (BẮT BUỘC theo quy trình này)

1. **Xác định phạm vi + chọn góc.** Liếc nhanh cấu trúc dự án (ngôn ngữ, có UI không, có DB/auth không, có engine/cron không) để chọn góc phù hợp — đừng rà góc không liên quan (backend thuần thì bỏ góc Giao diện).

2. **Tung TRỢ LÝ SONG SONG, mỗi góc 1 trợ lý** (sub-agent CHỈ ĐỌC, không sửa), gửi tất cả trong **1 lượt** để chạy đồng thời. Mặc định 6 góc (bỏ bớt nếu không hợp; codebase lớn → 1 góc tách 2–3 trợ lý theo khu):
   - 🔒 **Bảo mật & quyền** — auth, phân quyền/RLS, secret/credential lộ, API/endpoint ai gọi được, injection, rò thông tin, rate-limit.
   - 🐛 **Logic & lỗi tiềm ẩn** — bug, edge-case, xử lý lỗi thiếu (await không bắt lỗi), máy trạng thái, nhất quán dữ liệu, đua/đồng thời (double-run, claim).
   - 🙂 **Trải nghiệm người dùng** (đặc biệt non-tech) — bối rối, thiếu hướng dẫn/phản hồi, thuật ngữ kỹ thuật lộ ra, onboarding, thiếu tiện ích giá trị cao (báo, lọc, xác nhận thao tác nguy hiểm).
   - ⚡ **Hiệu năng & chi phí** — query chậm/N+1, tải nặng, gọi lặp/lãng phí (token AI, request thừa), bundle, thắt cổ chai.
   - 🛡️ **Độ bền & vận hành** — phục hồi khi lỗi/retry, an toàn deploy (đẩy nhầm production), sao lưu, giám sát, điểm-chết-đơn, timeout/treo.
   - 🎨 **Giao diện & responsive** (chỉ khi có UI) — vỡ bố cục, mobile/màn nhỏ, vùng chạm đủ lớn, nhất quán style, a11y. (Tham chiếu chuẩn UI của bạn nếu có.)

   **Mỗi trợ lý trả về:** danh sách phát hiện, mỗi cái gồm `file:dòng` · mức (🔴 nghiêm trọng · 🟡 nên vá · 🟢 nhỏ) · mô tả ngắn + khi nào xảy ra · **cách sửa cụ thể** · ước lượng công sức. Phân biệt rõ **"lỗ thật"** vs **"đã an toàn"**. 🔴 lên đầu. Ngắn gọn, là dữ liệu để quyết.

3. **Gom + lọc trùng + ưu tiên.** Hợp nhất phát hiện trùng; xếp theo mức 🔴/🟡/🟢 và **tác động cao / công sức thấp lên trước**. 🔴 nào còn ngờ → tung 1 trợ lý PHẢN BIỆN xác minh trước khi kết luận.

4. **GHI BỘ NHỚ ngay:** tạo/cập 1 mảnh trong nhóm bộ nhớ của dự án (vd `Memories/<DựÁn>/ra-soat-<ngày>.md`) chứa toàn bộ phát hiện + cách sửa + trạng thái ⬜/✅, kèm phần "✅ đã an toàn". Thêm 1 dòng trỏ ở INDEX nhóm.

5. **Trình bày cho người chủ** (ngắn, non-tech): tóm tắt 🔴 trước (mỗi cái 1 dòng + hậu quả), rồi 🟡, gộp 🟢. Khen phần đã chắc. **KHÔNG tự sửa hàng loạt** — đề xuất chia ĐỢT (an toàn gấp → cốt lõi → hoàn thiện) và hỏi làm đợt nào trước. Việc XÓA/đổi DB/đụng production theo lằn ranh đỏ: đưa SQL để người chủ chạy, hỏi trước khi deploy. Cuối cùng gợi ý **`/kiem-thu`** để xác nhận luồng chạy thật.

## Ghi chú
- Đây là rà **đọc-hiểu + suy luận** (không chạy pen-test/benchmark thật) → nói thật giới hạn đó; muốn chắc thực tế thì `/kiem-thu`.
- Quy mô tuỳ yêu cầu: "rà nhanh" → ít trợ lý, 1 vote; "rà kỹ" → nhiều trợ lý + phản biện 🔴.
- Có thể thêm góc mới khi hợp (🧪 kiểm thử, 📚 tài liệu/nhất quán tên, ⚖️ tuân thủ/pháp lý). Khối nhạy cảm (PII/tiền) → thêm red-team (`../ai-patterns/03-red-team-agent.md`).
