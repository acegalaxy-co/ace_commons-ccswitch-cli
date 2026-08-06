# 03 — Feature-flag 2 đầu (bật/tắt tính năng từ Admin)

## 🎯 Vấn đề
Cần bật/tắt từng tính năng để chọn lúc ra mắt hoặc tắt khẩn cấp — **mà không phải deploy lại**. Cờ rải rác trong code ≠ một hệ tắt/bật tập trung; gắn cờ SAU khi xây xong thì vá khắp nơi.

## ✅ Cách làm (bọc cờ NGAY TỪ ĐẦU, cả 2 đầu)
1. **Registry tĩnh** — khai báo mọi tính năng 1 chỗ (key · nhãn · phạm vi `server|client|both` · mặc định).
2. **DB `feature_flags`** — bảng `key → enabled` (admin sửa runtime). Có cache ngắn để khỏi query mỗi request.
3. **Phía SERVER:** guard chặn logic khi cờ tắt (decorator/middleware `isOn(key)` → 403/ẩn).
4. **Phía APP/FE:** gọi `GET /api/features` → ẩn nút/màn khi tắt (không cần rebuild).
5. **Admin UI:** trang bật/tắt (`PUT /api/features/:key`), có audit ai-đổi-gì-lúc-nào.

## 📋 Checklist
- [ ] Tính năng mới = thêm 1 dòng registry TRƯỚC khi code
- [ ] Cờ kiểm ở CẢ server (guard) LẪN app (ẩn UI)
- [ ] Admin đổi được runtime (không deploy lại)
- [ ] Mặc định an toàn (tính năng nhạy cảm = tắt sẵn)

## 💻 Code mẫu
`snippets/feature-flag.ts` — registry + `FeatureService.isOn()` + guard + endpoint phác.

## ⚠️ Cạm bẫy
- Chỉ ẩn UI mà server không chặn = vẫn gọi được API (lỗ hổng).
- Quên cache → query DB mỗi request (chậm); cache quá lâu → tắt khẩn không kịp ăn.
