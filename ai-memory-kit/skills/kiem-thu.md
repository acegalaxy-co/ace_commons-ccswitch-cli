---
description: KIỂM THỬ — chạy thử các luồng xương sống với dữ liệu thật (cô lập) để xem hệ THÔNG hay GÃY, báo ✅/❌ từng bước. Cặp với /ra-soat (đọc-soi tĩnh).
argument-hint: "[để trống = chạy kịch bản của dự án] | hoặc nêu luồng cần thử, vd: luồng duyệt việc"
---

# /kiem-thu — Chạy thử luồng thật (động)

Gọi lệnh này khi: **xong dự án** hoặc **sau nhiều thay đổi**, để xác nhận các luồng xương sống **chạy thật có thông không** — bổ trợ `/ra-soat` (đọc-soi tĩnh): rà soát tìm lỗi tiềm ẩn, kiểm thử xác nhận thực tế.

`$ARGUMENTS` (tuỳ chọn): nêu luồng/khu cụ thể → chỉ thử phần đó.

## LẰN RANH AN TOÀN (BẮT BUỘC — không được phá)
- **KHÔNG đụng dữ liệu/khách thật.** Chỉ chạy trên **dự án/không-gian TEST riêng** + **tài khoản test** đã khai trong kịch bản.
- Công bố/đẩy code chỉ vào **nhánh dev/preview**, KHÔNG production. Email chỉ gửi **hộp thư test**.
- **Dọn sạch** dữ liệu test phát sinh sau khi chạy (giữ tài khoản/dự án test cố định để lần sau khỏi tạo).
- Tạo tài khoản/dự án test = ghi dữ liệu → lần đầu phải **HỎI người chủ duyệt** trước khi tạo.

## Cách chạy
1. **Tìm kịch bản kiểm thử của dự án** (vd `scripts/kiem-thu.plan.*` hoặc khai trong README). Chưa có → đề xuất tạo (xem "Khung dùng chung") rồi hỏi người chủ duyệt thiết lập.
2. **Chạy KHUNG kiểm thử dùng chung** với kịch bản đó. Khung lo phần lặp: đăng nhập theo từng vai (qua đúng tầng phân quyền/RLS — token thật, KHÔNG giả lập), chạy từng bước, so kết quả mong đợi, in ✅/❌, dọn dẹp.
3. **2 lớp** (mặc định chỉ Lớp 1 — nhanh/rẻ/an toàn; Lớp 2 chỉ khi người chủ yêu cầu "thử cả dây"):
   - **Lớp 1 — Logic & Quyền:** tạo bản ghi mỗi loại → trạng thái đúng? · đúng vai làm được / **sai vai bị CHẶN** (test thật RLS) · người chưa-duyệt không đọc lén · chuyển trạng thái hợp lệ · xoá → cascade đúng. KHÔNG gọi engine/AI.
   - **Lớp 2 — Đầu–cuối:** 1 bản ghi thật cho engine/luồng nền chạy → công bố nhánh **preview** → email **hộp thư test** → verify cả dây. Tốn thời gian/chi phí.
4. **Báo cáo** (gọn, non-tech): bảng ✅/❌ từng bước; chỗ ❌ chỉ rõ **bước nào, mong đợi gì, thực tế ra gì, nghi do đâu**. Phát hiện lỗi thật → đề xuất sửa theo ĐỢT (như `/ra-soat`), production/DB vẫn hỏi.
5. **Ghi bộ nhớ** kết quả lần kiểm thử (mảnh `kiem-thu-<ngày>` trong nhóm dự án) nếu có phát hiện đáng lưu.

## Khung dùng chung (quy chuẩn mọi dự án)
- **Module khung** đặt trong kit backend dùng chung của bạn: lo đăng-nhập-theo-vai · chạy bước · assert · báo cáo · dọn dẹp. Viết 1 lần, mọi app (DB + RLS) xài lại.
- **Mỗi app chỉ khai 1 KỊCH BẢN ngắn** (`kiem-thu.plan`): danh sách bước xương sống của riêng nó + tài khoản/dự án test. Không code lại khung.
- App mới = thêm kịch bản (vài dòng) → có ngay kiểm thử. (Đi cùng chuẩn docs + hướng dẫn-trong-app.)

## Ghi chú
- Không kỳ vọng test "100% mọi thứ" — phủ **các luồng xương sống** (đủ bắt phần lớn lỗi gãy thật). Nói thật giới hạn này.
- Đây là kiểm thử cô lập, KHÔNG phải load-test / security-pentest thật.
