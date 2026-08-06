# 06 — Thủ thuật clone web tĩnh

## 🎯 Vấn đề
Clone một site (vd WordPress/Flatsome) sang Express/Node tĩnh: ảnh bị chặn hotlink (403), widget JS động chết khi tách khỏi nền cũ, permalink nhiều tầng, ẩn 1 khối thì còn khoảng trống rỗng.

## ✅ Cách làm
1. **Ảnh bị chặn hotlink →** đẩy qua **image proxy** (vd dịch vụ resize công khai `https://<image-proxy>/?url=<host>/<path>&output=<ext>`) hoặc tự host lại asset.
2. **Widget JS động chết** (counter, tab, swiper) → gắn lại bằng script nhỏ: bắt sự kiện scroll/onload rồi `recount`/`init` theo `data-*`.
3. **Permalink nhiều tầng → slug phẳng:** map URL cũ → slug 1 cấp, set redirect 301 cho link cũ.
4. **Ẩn khối mà hết khoảng trống:** ngoài việc ẩn phần tử, phải dẹp **3 chỗ rỗng** hay sót — `gap` của layout, `padding` của section bọc, và container kế tiếp (vá CSS inline qua cheerio).

## 📋 Checklist
- [ ] Ảnh load được (không 403) — proxy hoặc self-host
- [ ] Widget động chạy lại sau khi tách
- [ ] URL cũ redirect 301 về slug mới
- [ ] Ẩn khối không để lại khoảng trắng

## 💻 Snippet (đặt trong bài)
```js
// proxy ảnh
const img = url => `https://<image-proxy>/?url=${encodeURIComponent(url)}&output=webp`;
// dẹp gap khi ẩn 1 section (cheerio)
$('#<section-id>').remove();
$('#<gap-id>').attr('style', 'padding-top:0;padding-bottom:0');
```

## ⚠️ Cạm bẫy
- Phụ thuộc image-proxy bên thứ 3 = rủi ro downtime → cân nhắc self-host asset cho bản chính thức.
- Đừng giữ class/id rác của nền cũ (Flatsome…) trong bản sạch — dễ rối về sau.
