# 02 — Supabase an toàn: 3-DB · RLS · SQL idempotent · migration

## 🎯 Vấn đề
Supabase **tự phơi REST API với anon key công khai** → quên bật RLS = lộ/ghi sạch dữ liệu. SQL chạy lại hay lỗi (không idempotent). Migration kiểu "move-and-delete" dễ mất dữ liệu.

## ✅ Cách làm

### a) Mô hình 3 project (tách vai)
- `<nội-bộ>` (web/tool nhà mình) · `<public>` (khách ngoài) · `<dev>` (thử nghiệm). Mỗi dự án trỏ đúng project; chọn **region gần người dùng** (vd Singapore cho VN).
- 🌏 **Region app PHẢI KHỚP region DB — "gần nhau" là chưa đủ.** App deploy ở 1 region (vd US) mà DB Supabase ở region khác (vd Singapore) → mỗi round-trip mạng cộng thêm hàng trăm ms; 1 trang gọi vài query **TUẦN TỰ** thì độ trễ **NHÂN LÊN** theo số query (không phải cộng 1 lần) → cảm giác "trang treo mỗi thao tác" dù code không hề chậm, dễ mất giờ debug nhầm sang hướng khác.
  - **Gotcha cấu hình multi-region của hạ tầng:** một số PaaS có field "region" đơn lẻ trông như đổi được nhưng **KHÔNG áp thật** (đổi xong service vẫn chạy ở region cũ) — phải tìm đúng field cấu hình dạng **multi-region** (thường là object/map theo region) rồi **deploy lại (bản MỚI)**; **redeploy ảnh CŨ KHÔNG dời region**.
  - **Verify:** đo lại thời gian tải 1 trang có nhiều query tuần tự sau khi dời region — phải tụt rõ; đừng chỉ tin trạng thái region hiển thị trên UI hạ tầng.

### b) RLS BẮT BUỘC trên MỌI bảng public
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
-- deny-default: không policy = không ai đọc/ghi qua anon key
-- app server dùng service_role (bypass RLS) cho thao tác hệ thống.
```
- Audit nhanh bảng nào CHƯA bật:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND NOT rowsecurity;
```

### c) SQL phải an toàn
- **Idempotent:** `DROP POLICY IF EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
- **Cả file 1 transaction:** 1 lỗi → rollback hết (không để DB nửa vời).
- **Reload schema sau DDL:** PostgREST cache → `NOTIFY pgrst, 'reload schema';` (hoặc reload trong dashboard).

### d) Migration giữa project: COPY → KIỂM → CUTOVER → XOÁ (không xoá trước)
1. Tạo schema + bucket ở đích (idempotent). 2. Copy data + storage (Management API/REST nếu không có `pg_dump`). 3. **Rewrite URL tuyệt đối** trỏ ref cũ trong các cột. 4. Đối chiếu **bằng SỐ** (đếm dòng/đối tượng khớp 100%). 5. Đổi biến môi trường + redeploy → verify live. 6. Backup → **rồi mới** xoá nguồn cũ.

## 📋 Checklist
- [ ] Mọi bảng public đã `ENABLE ROW LEVEL SECURITY` (chạy query audit = rỗng)
- [ ] App dùng `service_role` cho thao tác hệ thống (không nhét anon key vào server)
- [ ] SQL idempotent + 1 transaction + `NOTIFY pgrst` sau DDL
- [ ] Migration: copy → đối chiếu số → cutover → backup → mới xoá
- [ ] Secret DB (service_role/connection string) ở két, KHÔNG vào git/bộ nhớ

## 💻 Code mẫu
`snippets/rls-checklist.sql` (bật RLS + audit) · `snippets/sql-idempotent.sql` (khung idempotent + reload).

## ⚠️ Cạm bẫy
- Bảng mới tạo quên RLS = lỗ hổng im lặng (REST vẫn phơi).
- `service_role` BYPASS RLS → tuyệt đối không để lộ ra client.
- Sau `ALTER`/`CREATE` mà API báo "column does not exist" → chưa reload schema.

## Backup FILE trong object-storage (backup-DB không cứu file)
**Backup-DB CHỈ lưu phần CHỮ (metadata) — KHÔNG tải FILE trong bucket.** Nếu bucket hỏng/mất thì ảnh/tài liệu mất luôn dù DB còn nguyên. → Cần **job backup FILE riêng**. Áp mọi dự án có object-storage (ảnh, tài liệu, file nhạy cảm).

- **Liệt kê ĐỆ QUY mọi file trong bucket:** `.list` theo từng prefix + **phân trang** (entry `id===null` = thư mục → đệ quy vào). Cần key quyền cao (service_role) để đọc hết.
- **Mirror TĂNG DẦN:** file đã có ở đích + **đúng cỡ** → bỏ qua; chỉ tải file mới/khác cỡ. Ghi `_manifest.json` để **đối soát** (đếm/so số lượng, kích thước).
- **Lịch định kỳ** (vd hằng tuần) qua scheduler local (cron / dịch vụ nền) hoặc scheduler cloud; **chạy bù** khi máy vừa mở.
- **Cảnh báo best-effort** khi lỗi (bọc try/catch, thiếu env thì chỉ log — KHÔNG re-throw kẻo hỏng job).
- **Theo 3-2-1:** object-storage = bản 1 · mirror local = bản 2 · **cloud khác** = bản 3.
- ⚠️ **Thư mục backup CẤM nằm trong repo/Git/cây bộ nhớ** (nhất là file nhạy cảm/PII) — script nên tự chặn. Trỏ ổ ngoài / cloud khác.
- ⚠️ Engine local chỉ chạy trên **máy đã bấm cài lịch** → muốn chắc, cài trên **máy 24/7**.
- Khôi phục: tải file từ mirror lên lại storage (đối soát qua `_manifest.json`).

💻 Code mẫu: `snippets/backup-storage.mjs` — mirror bucket tăng-dần (generic).
