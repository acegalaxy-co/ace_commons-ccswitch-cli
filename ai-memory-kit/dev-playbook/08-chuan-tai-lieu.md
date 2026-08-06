# 08 — Chuẩn tài liệu hệ thống + hướng dẫn trong app

## 🎯 Vấn đề
Hệ làm xong nhưng người vận hành (nhất là non-tech) không biết dùng; người mới tiếp nhận không hiểu thiết kế. Tài liệu thiếu = chi phí ẩn lớn.

## ✅ Cách làm

### a) Mọi hệ phải có `docs/` đầy đủ (4 phần)
| File | Nội dung |
|---|---|
| `docs/01-thiet-ke.md` | Bài toán, kiến trúc, quyết định + vì sao |
| `docs/02-ky-thuat.md` | Stack, sơ đồ DB, API, biến môi trường, cách chạy |
| `docs/03-van-hanh.md` | Deploy, backup, xử lý sự cố, cron, giám sát |
| `docs/04-huong-dan-dung.md` | Hướng dẫn người dùng cuối (ảnh/bước) |
- Cập nhật `docs/` là một phần của "xong việc", không để sau.

### b) Hướng dẫn TRONG APP (cho non-tech)
- **Hộp Hướng dẫn** ở mỗi mục (1–2 câu "mục này để làm gì, làm sao").
- **Tour làm quen** lần đầu (lưu localStorage "đã xem").
- **Trang Trợ giúp** + nút **"?"** ở góc + **tooltip** chỗ rối.
- Văn phong **HÀNH ĐỘNG**, ngắn, ví dụ đời thường — đừng thuật ngữ.

## 📋 Checklist
- [ ] Có `docs/` đủ 4 phần, cập nhật cùng lúc với code
- [ ] App có hộp hướng dẫn + Tour + trang Trợ giúp + nút "?"
- [ ] Người non-tech đọc/đi theo được mà không cần hỏi

## ⚠️ Cạm bẫy
- Docs viết 1 lần rồi bỏ → lệch thực tế; gắn việc cập docs vào Definition of Done.
- Hướng dẫn trong app mà toàn thuật ngữ = vô dụng với người vận hành.
