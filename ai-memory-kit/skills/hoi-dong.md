---
description: HỘI ĐỒNG CHUYÊN GIA — Chủ tịch (thẩm định Business) chọn hội đồng ĐỘNG rồi tung chuyên gia theo lĩnh vực (tài chính, giao diện, AI, tự động hóa, bảo mật, tăng trưởng…) phản biện + đề xuất NÂNG CẤP theo MỤC TIÊU → tổng hợp thành lộ trình ưu tiên.
argument-hint: "[mục tiêu + (tùy chọn) chọn/bớt chuyên gia], vd: 'nhân lực nhỏ nhất – quy mô lớn nhất' | 'để bán được'"
---

# /hoi-dong — Hội đồng chuyên gia phản biện & đề xuất nâng cấp (có Chủ tịch điều phối)

Gọi lệnh này khi muốn **góc nhìn CHIẾN LƯỢC theo lĩnh vực** để cải thiện/nâng cấp một dự án theo một MỤC TIÊU — không phải săn bug, mà là "chuyên gia ngành chỉ ra hệ còn yếu/thiếu gì và nên nâng cấp thế nào".

**Bộ ba chất lượng (phân vai rõ):**
- **`/ra-soat`** = đọc-soi tĩnh, săn **lỗi/lỗ hổng kỹ thuật**.
- **`/kiem-thu`** = chạy thử THẬT luồng xương sống (✅/❌).
- **`/hoi-dong`** = **chuyên gia LĨNH VỰC phản biện + đề xuất NÂNG CẤP theo mục tiêu** → lộ trình ưu tiên.

`$ARGUMENTS`: nêu **MỤC TIÊU** (vd "nhân lực ít nhất – quy mô lớn nhất", "để bán được") và/hoặc can thiệp hội đồng (vd "thêm pháp lý"). Để trống → Chủ tịch tự suy mục tiêu + tự chọn hội đồng.

## Cách chạy

1. **Chốt MỤC TIÊU.** Có trong args → dùng. Mơ hồ + ảnh hưởng lớn → hỏi 1 câu ngắn ("rà để BÁN, để VẬN HÀNH ít người, hay TRẢI NGHIỆM tốt hơn?"). Mục tiêu lái toàn bộ tiêu chí.

2. **CHỦ TỊCH HỘI ĐỒNG — chuyên gia THẨM ĐỊNH BUSINESS (chạy TRƯỚC, điều phối).** Tung 1 agent đóng vai chuyên gia thẩm định business/đầu tư (định giá, go-to-market, ROI, unit-economics):
   - **Thẩm định nhanh** dự án theo MỤC TIÊU: cơ hội/rủi ro lớn nhất, "ăn tiền" nằm đâu, table-stakes để đạt mục tiêu.
   - **CHỌN HỘI ĐỒNG ĐỘNG:** từ ROSTER, đề xuất **gọi thêm** chuyên gia phù hợp & **bỏ bớt** chuyên gia chưa cần (vd web giới thiệu → bỏ Tài chính, thêm SEO/Thương hiệu; fintech B2B → thêm Pháp lý/Bảo mật). Nêu LÝ DO + góc trọng tâm từng người.
   - Chủ tịch cũng là 1 lăng kính thường trực (📊 Business) tham gia tổng hợp cuối.
   - Đọc nhanh repo/bối cảnh + bộ nhớ dự án trước khi quyết. *(Người chủ có thể ghi đè qua `$ARGUMENTS`.)*

   **ROSTER (Chủ tịch chọn 3–6 cho hợp — đừng tung chuyên gia không liên quan):**
   - 📊 **Business / Thẩm định** (CHỦ TỊCH, thường trực) — thương mại hóa, định giá/gói, go-to-market, đường tới doanh thu.
   - 💰 **Tài chính / Kế toán** — tính đúng nghiệp vụ, chỉ tiêu quản trị, chuẩn ngành, niềm tin số liệu.
   - 🎨 **Giao diện / UX** — hệ thiết kế, phân cấp thông tin, a11y/mobile, microcopy, gu thiết kế của chủ.
   - 🤖 **AI / LLM** — độ chính xác bóc tách/phân loại, confidence + human-in-the-loop, RAG, EVAL/LLMOps, kinh tế model.
   - ⚙️ **Tự động hóa / Vận hành** — straight-through, scheduler, đầu-vào-tự-chảy, quản-trị-theo-ngoại-lệ, giám sát.
   - 🔒 **Bảo mật & tuân thủ** — auth/RLS/rò dữ liệu, secret, audit, pháp lý ngành.
   - 📈 **Tăng trưởng / Marketing** — định vị, kênh, phễu, giữ chân.
   - 🏗️ **Kiến trúc / Mở rộng** — chịu tải, đa-tenant, điểm-chết-đơn, nợ kỹ thuật.
   - ⚡ **Hiệu năng & chi phí hạ tầng** — query, token AI, bundle, đơn-vị-chi-phí khi scale.
   - ⚖️ **Pháp lý / Compliance** — hợp đồng, dữ liệu cá nhân, ngành nhạy cảm.
   - ➕ **Chuyên gia NGÀNH** theo dự án (theo đúng lĩnh vực sản phẩm của bạn).

3. **Tung HỘI ĐỒNG theo đề xuất Chủ tịch — SONG SONG** (sub-agent CHỈ ĐỌC), gửi 1 lượt. Mỗi chuyên gia là NHÂN VẬT có nghề. Prompt mỗi người PHẢI gồm:
   - **Bối cảnh + MỤC TIÊU + ghi chú Chủ tịch** (góc trọng tâm).
   - **Đường dẫn repo + file then chốt** để đọc.
   - **Kết quả các vòng/chuyên gia TRƯỚC** (gồm thẩm định Chủ tịch) — "XÂY TIẾP, đừng lặp".
   - **Định dạng bắt buộc:** Tóm tắt điều hành (5–8 gạch) → Phát hiện theo trục (hiện trạng → đề xuất → vì sao quan trọng cho MỤC TIÊU → phác lộ trình, kèm `file:dòng`) → **Bảng ưu tiên** | P0/P1/P2 | Hạng mục | Nỗ lực | Tác động | → nêu cả điểm **đang LÀM TỐT**.
   - Codebase lớn → 1 lăng kính tách 2–3 chuyên gia theo khu.

4. **TỔNG HỢP (bước giá trị nhất — đừng dán rời):**
   - **Hội tụ:** việc ≥2 chuyên gia ĐỘC LẬP cùng chỉ → tín hiệu mạnh nhất → ưu tiên cao nhất.
   - **Mâu thuẫn:** nêu rõ + cách dung hòa.
   - **Chủ tịch chốt góc Business:** dịch lộ trình kỹ thuật sang thương mại (cái gì mở khóa doanh thu / là table-stakes).
   - Gom cụm theo ĐỢT, đòn-bẩy-cao/nỗ-lực-thấp + bám MỤC TIÊU lên trước. P0 còn ngờ → tung 1 chuyên gia phản biện.

5. **GHI BỘ NHỚ ngay:** mảnh `Memories/<DựÁn>/hoi-dong-<ngày>.md` — mục tiêu + hội đồng (ai gọi/bỏ + lý do) + hội tụ + lộ trình theo đợt + trạng thái ⬜/✅. Thêm dòng trỏ INDEX. Việc dựng sau từ lộ trình → backlink chống-sót.

6. **Trình bày** (ngắn, non-tech): **điểm hội tụ + đòn bẩy lớn nhất trước**, rồi lộ trình theo đợt. Khen phần đang chắc. **KHÔNG tự làm hàng loạt** — chia ĐỢT, hỏi làm đợt nào trước (production/DB/xóa theo lằn ranh đỏ). Gợi ý `/ra-soat` + `/kiem-thu` để chốt chất lượng phần sẽ dựng.

## Ghi chú
- Phản biện **chiến lược theo lĩnh vực** (không chạy benchmark/pen-test thật) — nói thật giới hạn đó.
- Quy mô tùy yêu cầu: "hỏi nhanh 1 chuyên gia" → 1 agent; "hội đồng đầy đủ" → Chủ tịch + 4–6 + tổng hợp + phản biện P0. Dự án rất lớn → cân nhắc chạy bằng orchestration (workflow).
