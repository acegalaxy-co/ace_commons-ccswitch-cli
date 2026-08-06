# 22 — Template email / tài liệu xuất cho non-tech tự chủ (tách 3 tầng + luôn xem-trước)

Bài này giải quyết gì: khi app cần email giao dịch hoặc tài liệu xuất (mời, xác nhận, hoá đơn, PDF…) mà **team non-tech phải tự vận hành**, đừng đóng thành 1 cục "template" khó đụng — chia quyền sửa theo 3 tầng để team tự chủ phần chữ mà không đụng vào phần dễ vỡ.

## 🎯 Vấn đề
Non-tech muốn tự sửa nội dung email/tài liệu nhưng: sửa tay HTML thì vỡ layout; hardcode nội dung thì mỗi lần đổi phải nhờ dev; "khung tự ghép" mà không cho soi thì họ KHÔNG tin ("chả thấy nhập vào thì sao ra"). Cần tách rạch ròi: cái gì team tự sửa, cái gì giữ trong code.

## ✅ Cách làm — chia quyền sửa theo 3 tầng

| Tầng | Là gì | Ai sửa · cách |
|---|---|---|
| **1. Nội dung PER-ITEM** | data riêng mỗi lần gửi: tên/ngày/giờ/địa điểm, ảnh, số tiền… | Team tự điền ở form nghiệp vụ (đơn/sự kiện). Hệ **ghép động** vào khung, KHÔNG hardcode |
| **2. CÂU CHỮ chung** | lời văn cố định: tiêu đề, lời chào/cảm ơn, nhãn nút, dòng thương hiệu | Team tự sửa qua **1 mục Cài đặt** (lưu `settings.<key>.texts`) — **để trống = câu mặc định**. Không cần code |
| **3. BỐ CỤC / KHUNG / MÀU** | dàn cột, vị trí ảnh, màu nền, HTML email | **Giữ trong code** (HTML email rất dễ vỡ nếu sửa tay). Đổi qua dev/AI |

## 2 luật bắt buộc
1. 🔍 **LUÔN kèm nút "Xem trước" (không gửi thật).** Khung tự-ghép mà không cho soi → non-tech không tin, không biết ra sao. Preview phải render **CHÍNH hàm gửi thật** (không vẽ lại một bản khác — kẻo preview đúng mà mail sai) + nhận **bản nháp CHƯA lưu** để xem tức thì khi đang gõ. Phần động (mã QR/ảnh sinh runtime) = dữ liệu mẫu, ghi chú rõ.
2. 🧩 **KHUNG sinh từ ASSET gốc qua generator, tham-số-hoá đúng chỗ** (đừng gõ tay HTML minified). Bê "y nguyên" bản thiết kế của designer → chỉ khoét biến `${...}` cho phần động; default của biến = giá trị bản gốc để **không đổi diện mạo bản đang chạy**. Sửa thiết kế → sửa asset → chạy lại generator; KHÔNG sửa file đã sinh.

## Ranh giới — cái gì KHÔNG nhét vào "sửa chữ email"
**Thông tin BRAND dùng nhiều nơi** (hotline, địa chỉ, link, logo, màu) → là **1 cài đặt brand CHUNG**, KHÔNG để mỗi template sửa riêng (sẽ lệch giữa mail-mời / mail-xác-nhận / footer-web / trang FAQ). Muốn cho sửa → wire về **1 nguồn dùng chung** cho mọi nơi.

## 📋 Checklist
- [ ] Nội dung per-item ghép động từ form nghiệp vụ (không hardcode)
- [ ] Câu chữ chung sửa qua 1 mục Cài đặt, để trống = mặc định
- [ ] Bố cục/màu/HTML giữ trong code, sinh từ asset qua generator
- [ ] Có nút "Xem trước" render đúng hàm gửi thật + nhận bản nháp chưa lưu
- [ ] Brand dùng-nhiều-nơi = 1 cài đặt chung, không rải mỗi template

## ⚠️ Cạm bẫy
- **File "default" hoá ra là bản SAO asset của 1 item cụ thể** (cùng SHA) → dùng làm hero mặc định sẽ **lộ nội dung item đó** cho item khác. Kiểm SHA; tạo asset fallback TRUNG TÍNH riêng.
- Nút bật/tắt (`<feature>_enabled`) và câu chữ (`texts`) **cùng 1 settings key** → mọi write phải **read-modify-write** kẻo ghi đè mất phần kia.
- Import file `'use client'` vào route SERVER = exports undefined → crash (gotcha chung).

## Liên quan
- Gotcha server-action / client-server boundary: `15-gotchas-thuong-gap.md`.
- Chuẩn tài liệu + hướng dẫn trong app cho non-tech: `08-chuan-tai-lieu.md`.
