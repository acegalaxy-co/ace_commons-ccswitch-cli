# 13 — Đối soát import / migration dữ liệu: 5 chiều (khớp tổng tiền CHƯA đủ)

🎯 **Vấn đề:** nạp/di trú dữ liệu xong, soát mỗi **tổng tiền** thấy khớp → tưởng xong. Nhưng **kẹp-ngày, gán nhãn sai, rớt dòng** đều KHÔNG làm đổi tổng tiền → "khớp giả". Lỗi lọt vào DB thật rồi mới lộ thì rất đắt.

## ✅ Cách làm — soát đủ 5 CHIỀU

| # | Chiều | Bắt lỗi gì |
|---|---|---|
| 1 | **Số dòng** nguồn vs đích | rớt dòng / nhân đôi |
| 2 | **Ngày**: min, max, phân bố theo tháng/kỳ | cắt cụt, **kẹp-ngày** (`min(28,day)` biến 29/30/31 → 28, lệch kỳ) |
| 3 | **Nhãn/danh mục**: phân bố giá trị | gán mặc định sai (null → "Danh mục X") |
| 4 | **Vài dòng MẪU đối tay** với nguồn gốc | sai ánh xạ cột; chọn dòng giá-trị-lớn + đầu/cuối kỳ |
| 5 | **Tổng tiền** | cần — nhưng KHÔNG đủ một mình |

```ts
const s = await db.select({
  count: count(), minDate: min(t.date), maxDate: max(t.date), total: sum(t.amount),
}).from(transactions);
// So với nguồn: count · minDate · maxDate · total phải khớp
// + GROUP BY category để kiểm phân bố nhãn
```

- **Trước khi nạp vào DB thật:** dựng **bản xem trước** (chạy parser → hiện bảng tổng hợp 5 chiều) cho người duyệt mắt. Chỉ commit DB sau khi xác nhận.
- **Khi người dùng báo sai:** soi ngay **mã nguồn parser** — lỗi gần như luôn ở bộ nạp, đừng cãi "tôi đọc đúng".

## 📋 Checklist
- [ ] Đếm số dòng nguồn == đích
- [ ] min/max ngày + phân bố tháng khớp (soi kẹp-ngày)
- [ ] Phân bố nhãn/danh mục hợp lý (không default sai)
- [ ] Đối tay ≥3 dòng (lớn nhất + đầu kỳ + cuối kỳ): ngày·nhãn·tiền·nội dung
- [ ] Tổng tiền khớp
- [ ] Có bản xem-trước cho người duyệt TRƯỚC khi commit DB

## ⚠️ Cạm bẫy
- Khớp tổng tiền = an tâm giả. 3 lỗi kinh điển (kẹp-ngày, nhãn sai, rớt dòng) đều giữ nguyên tổng.
- Nạp thẳng DB thật rồi mới soát → sửa cực. Luôn xem-trước trước.

> Áp: mọi import/migration/seed data thật. Rửa: tên dự án, tên mã kế toán/nhãn nội bộ, tên bảng prefix.
