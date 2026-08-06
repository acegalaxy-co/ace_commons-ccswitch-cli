# 29 — RBAC chuẩn (memberships · roles · role_permissions)

🎯 **Vấn đề:** app có nhiều vai (chủ hệ thống/nhân viên/khách...) cần phân quyền THẬT (không phải chỉ ẩn nút ở giao diện) — hardcode tên vai vào logic (`if (role === 'admin')`) khiến thêm vai mới phải sửa code khắp nơi, còn quên seed bảng quyền có thể tự khoá luôn cả chủ hệ thống.

Bài này giải quyết gì: khuôn 3 bảng RBAC tái dùng (mục A), biến thể phạm-vi-theo-bản-ghi khi 1 vai chỉ được xem 1 phần dữ liệu (mục B), 2 bẫy nặng hay dính khi vận hành thật (mục C), và gotcha FE khi tự viết menu điều hướng (mục D).

---

## A. Lõi 3 bảng — quyền = code-catalog, không hardcode vai

```sql
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,      -- 'owner' | 'staff' | 'viewer'...
  name text not null
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_code text not null,  -- danh mục mã quyền tĩnh: 'users:manage', 'money:approve'...
  primary key (role_id, permission_code)
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role_id uuid not null references roles(id),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
```

- Quyền là **danh mục mã quyền tĩnh** (permission code catalog), guard đối chiếu theo code — KHÔNG hardcode tên vai vào logic nghiệp vụ. Thêm vai mới = thêm dữ liệu, không sửa code.
- Guard/middleware đọc quyền của user (theo tenant) **1 lần rồi cache**, chặn ở tầng app. Có màn quản-lý-người-dùng cho admin gán vai + xem ma trận quyền.
- Đa-tenant: mọi truy vấn khoá theo `tenant_id`; RLS deny-default ở DB là lưới cuối (khi kết nối bằng key có quyền cao thì RBAC tầng app là hàng rào chính, RLS chỉ là backstop).

## B. Biến thể: phạm vi theo bản ghi (khi vai cần "chỉ xem 1 phần")

Dùng khi ngoài vai còn cần giới hạn theo bản ghi cụ thể (không chỉ theo tenant) — ví dụ cộng tác viên ngoài chỉ xem vài khách hàng được giao, nhân sự giới hạn chỉ xem vài phòng ban.

- Phạm vi nằm ở **bảng RIÊNG**, không nhét vào `memberships`: ví dụ `member_scope` (cờ `full_access` **TƯỜNG MINH**, mặc định `false` = **fail-closed** → thu hồi quyền bằng bỏ-tick-hết, KHÔNG hoá ra mở-toang) + bảng phụ liệt kê id bản ghi được phép xem theo từng chiều dữ liệu cần giới hạn. Guard suy ra "access context" (toàn quyền vs danh sách id cụ thể) rồi lớp truy vấn tự chèn `WHERE id = ANY(...)`.
- Scope phụ-thuộc nên **suy RA từ dữ liệu gốc**, đừng bắt đồng bộ tay giữa 2 bảng (dễ lệch → user thấy 0 dòng vì quên gán ở bảng phụ).
- Test đúng điểm dễ sai: mặc định của vai A (không-scope = toàn quyền) khác mặc định vai B (không-scope = 0 quyền) — viết test riêng cho từng nhánh, luôn fail-closed khi không chắc.

## C. 2 cạm bẫy NẶNG khi vận hành

**1. `role_permissions` PHẢI được seed TRƯỚC KHI DÙNG.** Guard kiểu `requirePermission` thường JOIN `memberships ⨝ role_permissions` — bảng `role_permissions` RỖNG ⇒ trả `false` cho **MỌI vai, kể cả chủ hệ thống** (tự khoá luôn admin). Seed phải **idempotent**, chạy trong bước khởi tạo/migrate:

```ts
// scripts/seed-rbac.ts
const CATALOG: Record<string, string[]> = {
  owner: ['users:manage', 'money:approve', 'settings:write'],
  staff: ['users:read', 'money:read'],
  viewer: ['users:read'],
};

async function seedRbac(db: Db) {
  for (const [code, perms] of Object.entries(CATALOG)) {
    const role = await db.upsertRole({ code, name: code });
    for (const permission_code of perms) {
      await db.query(
        `insert into role_permissions (role_id, permission_code)
         values ($1, $2) on conflict do nothing`,
        [role.id, permission_code],
      );
    }
  }
}
```

Thêm vai mới → phải seed `roles` + `role_permissions` **TRƯỚC**, vì `memberships.role_id` có khoá ngoại tham chiếu tới `roles`.

**2. Bảng người dùng dùng CHUNG cho nhiều app** (1 hạ tầng auth phục vụ nhiều sản phẩm) → khi tạo/gỡ user:
- Email đã tồn tại (do dùng app khác) → **chỉ gắn thêm membership**, KHÔNG reset mật khẩu/metadata (chống chiếm tài khoản của app khác).
- "Gỡ" người dùng khỏi app = xoá `membership` + scope, **KHÔNG xoá user toàn cục** (`deleteUser`) — user đó có thể còn dùng app khác.
- Lấy email hiển thị bằng cách tra từng id, đừng liệt kê toàn bộ user rồi lọc (lộ thông tin user của app khác).

## D. Gotcha FE — sider/menu TỰ VIẾT phải tự lọc theo quyền

Nhiều framework quản trị (dashboard admin kit) chỉ tự lọc menu cho component sider **MẶC ĐỊNH** của chính framework đó — nếu team **tự viết sider riêng** (đọc danh sách menu rồi tự render), cơ chế lọc-theo-quyền có sẵn của framework **KHÔNG áp dụng**, mọi người dùng thấy full menu dù bấm vào bị chặn ở backend (403).

- Cách gọn: viết 1 hàm thuần `canViewMenuItem(item, permissions)` tái dùng đúng logic guard đã có (đừng viết lại), 1 hook đọc quyền hiện tại (có cache); trong sider lọc menu con theo quyền + ẩn luôn nhóm cha rỗng.
- Khi quyền đang tải (chưa có dữ liệu) → hiện tạm FULL menu để tránh nháy menu trống, quyền có cache nên chỉ xảy ra ở lần tải đầu.
- Đây chỉ là **gọn giao diện** — backend luôn là hàng rào thật (403), lọc FE chỉ để trải nghiệm sạch, không được thay guard.

## 📋 Checklist
- [ ] 3 bảng `memberships`/`roles`/`role_permissions`, quyền là code-catalog, không hardcode vai vào logic.
- [ ] `role_permissions` được seed idempotent TRƯỚC khi bật guard; test có ít nhất 1 vai qua được mọi permission cần.
- [ ] Guard đọc quyền 1 lần + cache theo request; màn quản-lý-người-dùng cho gán vai + xem ma trận quyền.
- [ ] Nếu cần phạm vi theo bản ghi: bảng scope riêng, mặc định fail-closed, scope suy ra từ dữ liệu gốc.
- [ ] Auth dùng chung nhiều app: gỡ user = xoá membership, không xoá user toàn cục; email trùng = chỉ gắn membership.
- [ ] Sider/menu tự viết tự lọc theo quyền (không dựa vào cơ chế mặc định của framework nếu đã tự viết component).

## ⚠️ Cạm bẫy
- `role_permissions` rỗng → mọi vai (kể cả chủ hệ thống) bị từ chối quyền — khoá luôn chính mình.
- 2 bảng scope đồng bộ tay → lệch dữ liệu, user thấy 0 dòng dù được giao việc.
- `deleteUser` toàn cục khi chỉ định gỡ khỏi 1 app → mất tài khoản ở app khác dùng chung hạ tầng auth.
- Liệt kê toàn bộ user để lọc email hiển thị → lộ thông tin user của app khác.
- Sider tự viết tưởng đã lọc-theo-quyền vì framework quảng cáo có `accessControlProvider` — thực ra cơ chế đó chỉ áp cho component mặc định.

## 🔗 Liên quan
- `28-cong-dang-nhap-chuan.md` — cổng đăng nhập đứng TRƯỚC lớp phân quyền này.
- `12-audit-log-undo-confirm.md` — ghi log khi admin đổi vai/quyền người khác.
- `18-che-pii-va-kyc.md` — mẫu quyền riêng (`<domain>:pii`) gate 1 hành động cụ thể, cùng khuôn code-catalog.
