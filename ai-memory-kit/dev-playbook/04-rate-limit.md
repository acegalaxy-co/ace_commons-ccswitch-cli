# 04 — Rate-limit cổng API (token-bucket)

## 🎯 Vấn đề
Cổng API công khai (vd nhận webhook/ingest server-to-server, gửi OTP, form) bị spam hoặc dò khoá. Cần hãm mà không cần dịch vụ ngoài cho hệ nhỏ.

## ✅ Cách làm
- **Token-bucket trong RAM:** mỗi "khoá hãm" giữ `tokens` + `refillPerSec`; mỗi request tốn 1 token, hết → `429` + header `Retry-After`.
- **Hãm 2 lớp:** theo **IP trước** (chặn spam thô), rồi theo **khoá/định danh** (chặn dò khoá). Lấy IP thật từ `x-forwarded-for` (sau proxy/CDN).
- **Tham số hoá:** `capacity` (đỉnh) + `refillPerSec` (tốc hồi) theo từng cổng.

## 📋 Checklist
- [ ] Cổng công khai nào cũng có rate-limit (ít nhất theo IP)
- [ ] Trả `429` + `Retry-After`, không phải lỗi 500
- [ ] IP lấy đúng từ `x-forwarded-for` (không phải IP proxy)
- [ ] Tham số capacity/refill hợp với lưu lượng thật

## 💻 Code mẫu
`snippets/rate-limit.ts` — token-bucket generic (1 file, không phụ thuộc lib).

## ⚠️ Cạm bẫy
- **RAM-only = mỗi instance một bộ đếm.** Chạy nhiều instance/scale ngang → phải chuyển sang **Redis** (chia sẻ trạng thái), kẻo hãm hụt.
- Đừng hãm nhầm cron/webhook hợp lệ của chính mình → cho phép theo allowlist IP/khoá nội bộ.
