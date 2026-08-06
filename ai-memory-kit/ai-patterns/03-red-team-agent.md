# 03 — Red-team agent: soi bảo mật bằng "tư duy kẻ tấn công" trước go-live

🎯 **Vấn đề:** tính năng có **PII** (y tế, định danh) hoặc **dòng tiền** mà chỉ rà code kiểu dev (`/ra-soat`) thì dễ bỏ lọt đường khai thác thật. Cần một agent **chủ động tấn công** (white-hat) tìm lỗ TRƯỚC khi kẻ xấu tìm.

## ✅ Cách làm

### Cơ chế
Dựng subagent chuyên biệt với system prompt theo tư duy **kẻ tấn công mũ trắng**:
- Liệt kê **bề mặt tấn công** (endpoint, quyền, flow tiền/PII).
- Thử chuỗi khai thác: leo thang quyền → vượt RLS/RBAC qua tầng app → truy vấn ẩn → tham số bị inject.
- **Chain nhiều lỗ nhỏ** thành 1 kịch bản khai thác thực tế.
- Output: lỗ hổng + đường khai thác + cách vá + mức (`🔴 nghiêm trọng / 🟡 trung bình / 🟢 thấp`).

Chạy **song song** với rà tĩnh: rà tĩnh soi "dev viết sai gì", red-team soi "kẻ tấn công vào bằng đường nào".

### Phạm vi an toàn (BẮT BUỘC)
- Chỉ chạy trên **DEV / bản sao vứt-đi** (scratch/preview), **KHÔNG** đụng data prod/khách thật.
- Không tự nới quyền, không khai thác thật ngoài phạm vi được ủy quyền.
- Đọc DB prod (dù read-only) → **xác nhận rõ với người chủ trước** (cổng duyệt).

### Gắn vào cổng go-live
Dự án có PII hoặc dòng tiền → red-team là **cổng bắt buộc** trước khi mở cho người dùng thật.

### Checklist tấn công tối thiểu (OWASP + mô hình RLS/RBAC)
1. Anon key/khóa công khai có đọc được data tenant khác không?
2. API lấy `tenantId` từ **session** hay từ **input** (giả mạo được)?
3. Leo thang quyền qua URL/param? (vd `?userId=admin`, `?role=owner`)
4. Endpoint nền (cron/webhook) có **fail-closed** khi thiếu secret không?
5. Upload: kiểm **MIME thật** (không chỉ đuôi file)?
6. Với PII: có endpoint nào trả list **không phân trang / không lọc tenant** không?
7. Lỗi có rò chi tiết hệ thống (stack/SQL) ra client không?

## 📋 Checklist
- [ ] Có agent red-team với prompt "tư duy kẻ tấn công"
- [ ] Chỉ chạy DEV/bản sao; đọc prod phải xin phép
- [ ] Là cổng bắt buộc trước go-live khối PII/tiền
- [ ] Chạy đủ checklist tối thiểu + chain lỗ nhỏ
- [ ] Output có mức nguy hiểm + cách vá

## 📊 Đo
Số lỗ bắt được trước go-live · thời gian phát hiện→vá · **số sự cố rò rỉ sau khi mở (mục tiêu: 0)**.

## ⚠️ Cạm bẫy
- Cho red-team chạy trên prod/data thật → tự gây sự cố. Luôn bản sao.
- Chỉ rà từng lỗ rời → bỏ lọt kịch bản chain. Bắt agent thử **ghép** lỗ.
- Coi red-team thay được pentester người khi ra khách thật — không. Đây là lưới ĐẦU, có khách thật thì thuê kiểm chéo.

> Áp: trước mỗi go-live khối nhạy cảm. Pairs với `skills/ra-soat` (rà tĩnh) + `skills/kiem-thu` (chạy thử).
