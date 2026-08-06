# 20 — Chống trùng đúng-mức + xóa có dây chuyền

Bài này giải quyết gì: app vận hành có "thực thể trung tâm" (khách / đơn / hồ sơ) mà người non-tech nhập tay → dễ đẻ bản ghi trùng, và khi cần dọn thì xóa 1 bản ghi lại bỏ sót cả loạt bảng tham chiếu. Cần bộ đôi: chặn-bẩn (chống trùng) + dọn-sạch (xóa có dây chuyền), làm đúng-mức chứ không cứng nhắc.

## A) Chống trùng — đúng mức, đừng chặn cứng

### Phân 2 mức
- **Trùng CHÍNH XÁC** (cùng tên **+** cùng SĐT, gần như chắc chắn 1 người) → **CHẶN, bắt tick "vẫn tạo"** mới cho lưu.
- **Trùng 1 phần** (chỉ trùng tên HOẶC chỉ trùng SĐT) → chỉ **NHẮC** (hộp vàng), vẫn lưu bình thường.

### ⚠️ KHÔNG chặn cứng theo SĐT
Người thân trong gia đình **dùng chung 1 số điện thoại** rất phổ biến (thực tế có hàng nghìn ca chung SĐT trong một hệ). Chặn cứng theo SĐT = không tạo được hồ sơ thật. Vì vậy điều kiện "chắc chắn trùng" phải là **tên + SĐT**, không phải SĐT một mình.

### 2 lớp bắt buộc: client tick + server backstop
- **(a) Client** bắt tick + hộp đỏ (UX rõ ràng cho người nhập).
- **(b) Server backstop** — trong action `createX`, re-check exact-match khi `allowDuplicate != true` → chống lách qua API/script.

Đừng chỉ làm client: test / lỡ tay / đường vào khác vẫn đẻ trùng. **Cảnh báo MỀM một mình KHÔNG đủ** — chỉ nhắc thì người dùng bấm Lưu qua luôn; mức "bắt xác nhận" mới thật sự chặn lỡ tay.

```ts
async function createXImpl(input, opts: { allowDuplicate?: boolean }) {
  if (!opts.allowDuplicate) {
    // server backstop: exact-match = tên + SĐT, khóa tenant, loại soft-deleted
    const dup = await db.select({ id: records.id }).from(records).where(and(
      eq(records.tenantId, input.tenantId),
      isNull(records.deletedAt),
      eq(records.name, input.name),
      eq(records.phone, input.phone),
    )).limit(1);
    if (dup.length) throw new DuplicateError("Đã có bản ghi trùng tên + SĐT");
  }
  return db.insert(records).values(input).returning();
}
```

> Mẹo form: submit **client-handled (`onSubmit`) → bắt lỗi server rồi hiện toast thật**, đừng để `<form action={serverAction}>` ném lỗi trần (một số framework ở production sẽ nuốt thành câu báo lỗi generic).

## B) Xóa có dây chuyền — "không dây chuyền = nhìn phát biết test"

### Nút xóa ở trang chi tiết + XEM TRƯỚC dây chuyền
- Người non-tech thích **xóa tay trong app + thấy hệ quả**, không thích chạy script bulk. Cho **nút xóa ở trang chi tiết** của thực thể (deliberate, đỡ lỡ tay hơn xóa-từ-list).
- **Xem trước dây chuyền:** bấm xóa → đếm dữ liệu liên quan ở **mọi bảng tham chiếu**. **Trống hết → "bản ghi TRỐNG = nhiều khả năng là data test, xóa an toàn" (xanh); có data → cảnh báo ĐỎ + liệt kê từng loại + số lượng** ("có thể là dữ liệu thật"). Đây là **heuristic phân biệt test vs thật rẻ nhất** — không cần đoán theo tên/ngày.

```ts
// đếm dây chuyền để xem trước
async function previewDeletion(tenantId: string, entityId: string) {
  const rows = await Promise.all(
    REL_TABLES.map(async (t) => ({
      table: t,
      count: await countRefs(tenantId, t, entityId),
    })),
  );
  const withData = rows.filter((r) => r.count > 0);
  return {
    safe: withData.length === 0,   // trống hết = xanh "an toàn"
    breakdown: withData,           // có data = đỏ, liệt kê
  };
}
```

### Xóa MỀM cả dây trong 1 transaction, khóa tenant, ghi nhật ký
Xóa MỀM (`deleted_at`) cả thực thể + toàn bộ dây chuyền, **trong 1 transaction**, **khóa tenant**, **ghi nhật ký kèm breakdown** → đảo được (xem `12-audit-log-undo-confirm.md`).

### 🔑 Dò cột `deleted_at` LÚC CHẠY, đừng grep text schema
Nhiều bảng được dựng bằng **spread một base chung** (ví dụ `...base()`) nên chữ `deleted_at` KHÔNG xuất hiện trong block định nghĩa bảng → grep text ra "HARD delete" sai hàng loạt. **Hỏi `information_schema` lúc chạy** để biết bảng nào thật sự có cột:

```ts
// bảng có cột deleted_at → xóa mềm; bảng join/lá không có → xóa cứng
async function hasSoftDelete(table: string): Promise<boolean> {
  const [row] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = 'deleted_at' LIMIT 1
  `);
  return !!row;
}
```

- Tên bảng lấy từ **allowlist + tiền tố (prefix) trong env** (an toàn injection); identifier động thì bọc qua `sql.raw('"' + name + '"')`.
- **Quét MỌI bảng có khóa ngoại trỏ về thực thể trung tâm** — liệt kê đủ kẻo sót dây (ví dụ bảng giao dịch còn tham chiếu → vẫn tính doanh thu dù thực thể đã ẩn).

## 📋 Checklist
- [ ] Trùng chính xác (tên + SĐT) → CHẶN, bắt tick "vẫn tạo"
- [ ] Trùng 1 phần → chỉ NHẮC (hộp vàng), vẫn lưu
- [ ] KHÔNG chặn cứng theo SĐT (người thân dùng chung số)
- [ ] 2 lớp: client tick + server backstop re-check
- [ ] Nút xóa ở trang chi tiết + XEM TRƯỚC dây chuyền (đếm mọi bảng tham chiếu)
- [ ] Xóa MỀM cả dây trong 1 transaction, khóa tenant, ghi nhật ký
- [ ] Dò `deleted_at` lúc chạy qua `information_schema` (không grep text schema)

## ⚠️ Cạm bẫy
- Chặn cứng theo SĐT → không tạo được hồ sơ người thân chung số.
- Chỉ client, không server backstop → API/script/test vẫn đẻ trùng.
- Cảnh báo mềm một mình → người dùng bấm qua, trùng vẫn sinh.
- Grep text schema để dò soft/hard → bảng dựng bằng spread bị đọc nhầm "HARD" hàng loạt.
- Sót một bảng tham chiếu → dây chuyền không xóa hết, số liệu vẫn dính thực thể đã ẩn.

## Liên quan
- `12-audit-log-undo-confirm.md` — xác nhận 2 bước + nhật ký + hoàn tác (xóa mềm đảo được).
- `19-canh-bao-bat-thuong-va-doi-soat.md` — trung tâm cảnh báo rule-based (loại soft-deleted trong count).
