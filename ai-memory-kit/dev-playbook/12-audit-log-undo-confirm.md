# 12 — Audit log + Hoàn tác + Xác nhận (app cho người non-tech sửa data thật)

🎯 **Vấn đề:** app cho người non-tech sửa **data tài chính / nhiều người sửa chung** → lỡ tay 1 nút là lệch số, mất dấu, không biết ai sửa, không undo được. Cần **3 lớp** quanh mọi thao tác đổi/xóa/đảo-trạng-thái.

## ✅ Cách làm — 3 lớp

### Lớp 1 — Xác nhận chống lỡ tay (KHÔNG "1 bấm đổi ngay")
Toggle/Xóa → trạng thái `armed`: bấm lần 1 hiện `[Xác nhận]/[Hủy]`; bấm lần 2 mới chạy. `key={giá-trị}` để remount reset khi giá trị đổi từ ngoài.
```tsx
function ConfirmToggle({ value, onConfirm }) {
  const [armed, setArmed] = useState(false);
  return armed
    ? (<><button onClick={onConfirm}>Xác nhận</button><button onClick={() => setArmed(false)}>Hủy</button></>)
    : <button onClick={() => setArmed(true)}>{value ? "Đang bật" : "Đang tắt"}</button>;
}
// <ConfirmToggle key={row.status} value={row.active} onConfirm={...} />
```

### Lớp 2 — Audit log (nhật ký ai·gì·lúc·giá-trị-trước)
```sql
CREATE TABLE audit_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   text,
  user_name text,
  action    text NOT NULL,   -- 'toggle_status' | 'delete' | 'create' | 'update'
  target    text NOT NULL,   -- '<table>/<id>'
  tx_id     text,            -- id bản ghi bị ảnh hưởng
  detail    jsonb,           -- { before:{...}, after:{...} } | full row khi xóa
  undone    boolean NOT NULL DEFAULT false
);
-- RLS deny-default; chỉ admin đọc.
```
Helper ghi log trong MỌI server action đổi data. `detail` phải đủ để đảo ngược: toggle → `{before:oldStatus}`, xóa → **full row**, thêm → `{id}`.

### Lớp 3 — Hoàn tác (undo từ log)
```ts
async function undoAudit(logId) {
  const e = await getAudit(logId);
  if (e.undone) throw new Error('Đã hoàn tác rồi');
  switch (e.action) {
    case 'delete':        await db.insert(target).values(e.detail.row); break;
    case 'create':        await db.delete(target).where(eq(id, e.tx_id)); break;
    case 'toggle_status': await db.update(target).set({ status: e.detail.before }).where(eq(id, e.tx_id)); break;
    case 'update':        await db.update(target).set(e.detail.before).where(eq(id, e.tx_id)); break;
  }
  await db.update(auditLog).set({ undone: true }).where(eq(auditLog.id, logId));
}
```
Hiện tab **"Lịch sử"** trong trang quản lý; mỗi dòng có nút "Hoàn tác" (ẩn nếu `undone=true`).

## 📋 Checklist
- [ ] Mọi thao tác đổi/xóa/đảo trạng thái đi qua xác nhận 2 bước
- [ ] Mọi thao tác đó ghi `audit_log` với `detail` đủ để khôi phục
- [ ] Có nút hoàn tác đọc từ log + đánh dấu `undone`
- [ ] `audit_log` bật RLS deny-default, chỉ admin đọc

## ⚠️ Cạm bẫy
- **Dựa nguồn NGOÀI để dò ngược** (mã kế toán bên thứ ba, file Excel gốc) → khi mất nguồn là tịt. Lưu đủ `before` trong `detail` = nguồn chân lý DUY NHẤT.
- Xóa mà chỉ lưu `{id}` → không undo được. Xóa phải lưu **full row**.
- Quên `key={}` ở ConfirmToggle → state armed dính khi list re-render.

> Áp cho: app tài chính / đa-người / non-tech. Rửa: tên bảng có prefix, tên người, tên màn.
