# 02 — Liên kết luồng: nối các màn rời thành quy trình liền mạch

🎯 **Vấn đề:** sản phẩm có nhiều màn/tính năng rời (đặt lịch · thực hiện · thu tiền · báo cáo) nhưng người dùng phải tự nhớ "làm gì tiếp" + nhập lại — rời rạc, dễ sót. Cần nối thành **quy trình** mà **không vội đổi schema**.

## ✅ Cách làm — 4 lớp

### Lớp 1 — State machine SUY từ data (read-only)
Đừng tạo cột `status` mới nếu suy được từ dữ liệu sẵn có:
```ts
function deriveStatus(r: { appointmentAt?; completedAt?; paidAt? }) {
  if (r.paidAt) return 'done';
  if (r.completedAt) return 'awaiting_payment';
  if (r.appointmentAt) return 'in_progress';
  return 'scheduled';
}
```
Chỉ lưu cột `status` khi không suy được hoặc cần lịch sử chuyển trạng thái.

### Lớp 2 — Tự đẩy bước (cùng transaction)
```ts
await db.transaction(async (tx) => {
  await tx.update(stepA).set({ completedAt: new Date() }).where(eq(stepA.id, id));
  await tx.update(stepB).set({ status: 'ready' }).where(eq(stepB.refId, id));
});
```

### Lớp 3 — Gate cảnh báo MỀM (nhắc, KHÔNG chặn)
```ts
function checkGates(r): { key: string; message: string }[] {
  const w = [];
  if (!r.consentSigned) w.push({ key:'consent', message:'Chưa ký đồng ý' });
  if (r.stock < r.required) w.push({ key:'stock', message:'Tồn kho không đủ' });
  return w; // UI hiện ⚠️, KHÔNG chặn submit — tin người dùng
}
```
Soi theo **lô** (1 query/loại gate cho cả danh sách) để tránh N+1.

### Lớp 4 — Worklist + AI gợi bước tiếp
Mỗi vai có trang "Việc cần làm hôm nay" (query suy trực tiếp từ trạng thái). Nút "AI gợi bước tiếp" gọi rail AI nội bộ với context **đã khử PII** (chỉ id/trạng thái/cảnh báo, không tên/SĐT).

## 2 nguyên tắc gốc (dễ làm sai)
**A. Thiếu cột nối 2 màn → LUỒN ID qua UI, đừng vội đổi schema.** UI giữ `planItemId` từ màn A, gửi xuống màn B; action UPDATE chỉ khi id hợp lệ + **cùng tenant** (idempotent). Nhẹ, tương thích ngược, 0 migration.

**B. Không có đường nối nào → best-effort + caveat RÕ + ghi backlog.** UI hiện `⚠️ Dự kiến (có thể chưa chính xác)`; ghi backlog "thêm cột `entity_id` để nối chính xác". **Đừng giả-chính-xác.**

**Khi nâng best-effort → chính xác:** thêm cột nullable trên bảng trung tâm (không tạo bảng pivot); giữ 2 tầng song song (`🟢 Chính xác` cho dòng đã nối / `🟡 Dự kiến` cho dòng chưa) — nâng dần, không phá luồng cũ. Thêm loại AI mới = thêm `kind` vào worker AI sẵn có (0 migration).

## 📋 Checklist
- [ ] Trạng thái suy từ data trước khi nghĩ tới cột mới
- [ ] Hành động ở bước trước tự đẩy bước sau (cùng transaction)
- [ ] Gate là cảnh báo mềm, soi theo lô
- [ ] Worklist theo vai + gợi-bước khử PII
- [ ] Thiếu cột nối → luồn ID qua UI (idempotent, khóa tenant), không vội migration

## ⚠️ Cạm bẫy
- Đổi schema sớm để "nối cho chuẩn" → chậm + rủi ro. Luồn ID qua UI trước.
- Gate chặn cứng → người dùng kẹt, làm chui. Cảnh báo mềm.
- Gợi-bước gửi cả tên/SĐT cho AI → rò PII. Chỉ gửi id/trạng thái.
- Drizzle: FK trỏ bảng định nghĩa SAU trong file → forward-ref lỗi load. Né: khai cột uuid + index (không `foreignKey`), giữ toàn vẹn tenant ở code.

> Áp: build-to-sell hệ vận hành (phòng khám, dịch vụ, bán hàng…). Rửa: tên bảng/dịch vụ, tên dự án.
