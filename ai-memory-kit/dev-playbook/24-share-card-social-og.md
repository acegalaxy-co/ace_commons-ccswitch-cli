# 24 — Thẻ share social (OG + story 9:16) render SERVER, 0 thư viện thêm

🎯 **Bài này giải quyết gì:** muốn khách khoe kết quả/thành tích lên mạng xã hội bằng một **ảnh đẹp đúng brand** để kéo người mới — không phải screenshot xấu. Cần sinh 2 dạng ảnh (**OG** 1200×630 hiện khi paste link · **Story 9:16** 1080×1920 để đăng story) render **ở server**, không thêm thư viện vẽ ảnh, và né mấy cái bẫy khiến route ảnh crash 500.

## ✅ Cách dựng (0 thư viện thêm — dùng `ImageResponse` có sẵn của framework)

Framework SSR hiện đại đã kèm `ImageResponse` (engine `satori` bên dưới) → không cần cài lib vẽ ảnh.

- **OG động (convention):** file `app/.../opengraph-image.tsx` export `Image()` trả `ImageResponse` + `size` / `alt` / `contentType`. Framework tự gắn meta `og:image` cho route đó.
- **Thẻ tải-về (story / tùy chọn):** route handler riêng `app/.../the/route.tsx` → `export async function GET(req)` trả `ImageResponse` 1080×1920. Data truyền qua **query string** (`?level=&score=&badge=`) — vì dữ liệu client (ví dụ ở localStorage) **server không biết** → phải truyền vào qua query.
- **`runtime = 'nodejs'`** khi cần fetch font (ví dụ font web) → fetch CSS font → trích URL `.woff` → `arrayBuffer` → `fonts: [{ name, data, weight, style }]`.
- **Chữ non-Latin an toàn:** nếu tải được font non-Latin → dùng; nếu **fetch font FAIL → fallback nhãn tiếng Anh (Latin)** để KHÔNG bao giờ ra ô vuông tofu/vỡ chữ.

## 🐛 GOTCHAS (đắt tiền — mỗi cái mất cả buổi dò)

### (a) Import named-export từ file `'use client'` VÀO route server → crash undefined
Import một named export (ví dụ `LEVELS` / `BADGES`) từ một file có `'use client'` **vào route server** (`route.tsx`, `opengraph-image.tsx`) → framework coi module đó là **biên client**, giá trị của nó **không có ở server** → thành client-ref = `undefined` → crash kiểu `Cannot read properties of undefined`.
- **Cách xử:** (a) **inline** dữ liệu cần vào route server (nếu nhỏ + ít đổi, kèm comment "đồng bộ thủ công với nguồn"); HOẶC (b) **tách data thuần ra file KHÔNG `'use client'`** rồi cả client lẫn server cùng import từ đó.

### (b) Engine satori khó tính
- Mọi `<div>` có **>1 con** phải đặt `display: 'flex'` (không tự động flex).
- **KHÔNG gradient-text** (không ăn) → dùng màu thường.
- **KHÔNG emoji** (satori cần emoji-font riêng) → thay bằng màu nhấn / hình khối.
- Font **non-Latin phải nhúng** (fetch woff, đưa vào `fonts`), không dựa font hệ thống.
- `gap` / `border` / `letterSpacing` thì OK.

### (c) Verify = CHỤP PNG SOI MẮT, KHÔNG tin HTTP 200
Route trả 200 vẫn có thể ra ảnh vỡ/trắng/tofu. **Render nhiều ca** (nhãn dài/ngắn, mức thấp nhất → cao nhất) rồi **mở PNG nhìn bằng mắt**.

### (d) Test bằng UA browser (anti-bot chặn curl)
Nếu app sau CDN/WAF/anti-bot, UA `curl` hay bị chặn (403 bad-bot) → **test bằng UA trình duyệt** (Mozilla/Googlebot), đừng kết luận "route hỏng" khi thật ra bị anti-bot chặn.

## Nút phía client (mobile share thẳng story)
```ts
const res = await fetch(`/.../the?level=${level}&score=${score}&badge=${badge}`);
const file = new File([await res.blob()], 'share.png', { type: 'image/png' });
if (navigator.canShare?.({ files: [file] }) && navigator.share) {
  await navigator.share({ files: [file], /* ... */ }); // Web Share API L2 → story mạng xã hội
} else {
  /* fallback: <a download> tải về */
}
```
→ Kèm spinner ("Đang tạo ảnh…") vì render server có độ trễ (mọi click phải có phản hồi).

## 📋 Checklist
- [ ] OG qua convention `opengraph-image.tsx`; story qua route handler ảnh tải-về
- [ ] Data client truyền vào route server qua query (server không đọc localStorage)
- [ ] Không import named-export từ file `'use client'` vào route server
- [ ] div >1 con = `display:flex`; không gradient-text; không emoji; font non-Latin nhúng
- [ ] Verify bằng CHỤP PNG soi mắt (nhiều ca), không tin HTTP 200
- [ ] Test route bằng UA browser nếu có anti-bot

## ⚠️ Cạm bẫy
- Tin HTTP 200 = ảnh đẹp → thực ra vỡ/trắng. Phải soi PNG.
- Import data từ module `'use client'` vào server → undefined crash. Inline / tách file data thuần.
- Dùng emoji hoặc gradient-text trong ImageResponse → vỡ render. Tránh.

> Áp: mọi app có phần viral/marketing. Rửa: tên dự án, tên route/gu cụ thể, tên font/brand, tên CDN/anti-bot cụ thể.
