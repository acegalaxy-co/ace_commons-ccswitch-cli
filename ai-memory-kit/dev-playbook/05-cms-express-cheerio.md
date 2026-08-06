# 05 — Khuôn CMS Express + Cheerio + i18n

## 🎯 Vấn đề
Cần web giới thiệu/landing **giữ y chang giao diện gốc** nhưng nội dung sửa được qua admin + đa ngôn ngữ — mà không kéo cả CMS nặng (WordPress…).

## ✅ Cách làm
1. **Render = tiêm DB vào HTML gốc bằng cheerio:** giữ nguyên template HTML thiết kế, server load nội dung từ DB rồi `cheerio` thay text/ảnh theo selector. Giao diện không đổi, chữ thì động.
2. **Fallback defaults:** DB rỗng → đổ nội dung gốc (`defaults`) để trang không bao giờ trắng.
3. **Admin màn-ĐÔI (preview):** sửa bên trái, xem trước bên phải; **preview KHÔNG ghi đè** bản live tới khi bấm lưu.
4. **i18n N-ngôn-ngữ:** lưu bản dịch bằng **key suffix** (`field__vi`, `field__ja`) hoặc cột `jsonb i18n`; 1 ngôn ngữ mặc định + nút chọn ngôn ngữ. Tổng quát cho N thứ tiếng (đừng hardcode 3).
5. **Cấu trúc:** `lib/defaults.js` (nội dung gốc) · `lib/render.js` (cheerio inject) · `lib/store.js` (gộp DB + defaults theo `lang`) · `scripts/seed.mjs` (nạp data) · bảng chuẩn: `content`, `collections`, `admins`, `audit_log`.

## 📋 Checklist
- [ ] Template gốc giữ nguyên; nội dung tách ra DB
- [ ] Có `defaults` fallback (không trắng trang khi DB rỗng)
- [ ] Admin preview không ghi đè live
- [ ] i18n tổng quát N ngôn ngữ (không hardcode)
- [ ] Mọi bảng bật RLS (xem bài 02)

## 💻 Code mẫu
`snippets/cms-render.js` — render cheerio inject + gộp defaults + i18n suffix (rút gọn).

## ⚠️ Cạm bẫy
- Selector cheerio dựa cấu trúc HTML → đổi template phải rà lại selector.
- Đa ngôn ngữ: nhớ field nào dịch / field nào dùng chung (ảnh, số) để khỏi nhân bản thừa.
