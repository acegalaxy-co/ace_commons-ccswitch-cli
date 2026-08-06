# 11 — Đảm bảo chất lượng đa-lớp (defense-in-depth: 4 lưới)

🎯 **Vấn đề:** không lưới nào bắt hết lỗi. Chỉ test thủ công / chỉ CI / chỉ "đọc lại code" đều lọt. Cần **nhiều lưới chồng nhau** (mô hình "phô-mai Thụy Sĩ"): lỗi lọt lưới này thì lưới sau chặn — và mỗi lưới **chạy tự động**, không dựa trí nhớ.

## ✅ Cách làm — 4 lưới

### Lưới 1 — CI + quét secret (chặn TRƯỚC khi vào repo)
Cổng CI cứng: `tsc --noEmit` + lint + test + quét secret (gitleaks). `tsc` = cổng cứng (fail thì chặn merge). Lint + gitleaks để `continue-on-error: true` khi repo còn bẩn, **đổi thành `false` sau khi dọn sạch**.
```yaml
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsc --noEmit            # cổng CỨNG
      - run: npx eslint .                 # continue-on-error tới khi sạch
        continue-on-error: true
      - uses: gitleaks/gitleaks-action@v2 # quét secret
        continue-on-error: true
```
- 🐞 **Gotcha — thiếu `permissions: pull-requests: read` = gitleaks "sạch" GIẢ:** trên trigger `pull_request`, `gitleaks-action` gọi API liệt kê commit của PR → cần quyền `pull-requests: read`. Thiếu quyền này, action trả lỗi **403** ("Resource not accessible by integration") — nếu bước đó còn `continue-on-error: true` thì lỗi 403 bị **NUỐT LẶNG**, CI vẫn xanh, trông như "đã quét sạch" nhưng **thực ra chưa quét được lần nào**. Thêm vào workflow:
  ```yaml
  permissions:
    contents: read
    pull-requests: read   # thiếu → 403 bị continue-on-error nuốt, "sạch" giả
  ```
- 🐞 **Gotcha — gitleaks quét CẢ lịch sử commit của PR, không chỉ diff cuối:** nếu 1 commit CŨ trong PR từng thêm chuỗi giống secret (vd khoá giả trong fixture test), inline-allow hay sửa ở commit SAU **KHÔNG xoá được finding của commit cũ** — cổng vẫn đỏ. Xử theo thứ tự hẹp→rộng: (a) file `.gitleaksignore` ghi đúng vân tay (`commit:file:rule:line`, copy từ log gitleaks dòng `Fingerprint:`) — bỏ đúng 1 finding, không đụng cấu hình chung; (b) allowlist path/regex riêng trong cấu hình gitleaks; (c) squash-merge để gộp về 1 commit sạch (có inline-allow) khi merge vào main.

### Lưới 2 — Zod validate tại cửa API (chặn data bẩn vào DB)
Mọi route validate input bằng Zod TRƯỚC khi đụng DB. Ưu tiên áp nơi validate yếu/thiếu; nơi đã chắc thì giữ — đừng phá luồng đang chạy.
```ts
const schema = z.object({
  email: z.string({ error: 'Email không hợp lệ' }).email(),
  amount: z.number().nonnegative(),
});
const r = schema.safeParse(body);
if (!r.success) return Response.json({ error: r.error.issues[0].message }, { status: 400 });
```
> Zod v4: dùng `z.string({ error: 'msg' })` (không phải `{ message }`). Chuỗi bắt buộc: `z.preprocess(v => String(v).trim(), z.string({ error: 'Bắt buộc' }).min(1))`.

### Lưới 3 — Error tracking runtime (bắt lỗi ĐANG chạy)
Cắm Sentry (hoặc tương đương), DSN từ biến môi trường, **bật có điều kiện**:
```ts
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
const dsn = process.env.SENTRY_DSN;
Sentry.init({ dsn, enabled: !!dsn, tracesSampleRate: 0.1, sourcemaps: { disable: true } });
```
`enabled: !!dsn` → chưa có DSN thì SDK im hoàn toàn (không cần token lúc build). Không bật session-replay (nặng bundle). Nối alert về Telegram/email qua webhook.

### Lưới 4 — Typed DB + backup + DIỄN TẬP restore
- **Typed DB:** sinh kiểu từ DB **đang chạy thật** (không từ DB dev dùng chung — hay lệch schema): vd `supabase gen types typescript --project-id <prod-id> > database.types.ts` → `createClient<Database>`. Lệch schema = lỗi biên dịch, không chờ tới runtime.
- **Backup** (script JS thuần, không cần `pg_dump`): đọc bảng qua lib → xuất JSON + `_manifest.json` (số dòng/bảng/timestamp) → lưu **ngoài DB & ngoài cloud-sync**.
- **Verify** ngay sau backup (không cần DB): đủ file + JSON đọc được + đếm dòng khớp manifest.
- **Diễn tập restore:** nạp vào schema nháp `drill_<stamp>` trên DB **non-prod** → đối chiếu số dòng → tự DROP. Chốt chặn nhầm prod: `if (DB_URL.includes('prod')) throw new Error('ABORT')`.

> ⚠️ **Backup chưa diễn tập restore = CHƯA chắc an toàn.** Rất nhiều backup hỏng âm thầm, chỉ lộ khi cần restore thật.

## 📋 Checklist
- [ ] CI có `tsc --noEmit` cổng cứng + lint + test + quét secret
- [ ] Route quan trọng có Zod validate trước khi đụng DB
- [ ] Error tracking bật theo env (im khi thiếu DSN)
- [ ] Kiểu DB sinh từ schema PROD, không từ dev
- [ ] Backup định kỳ + verify + **đã chạy thử restore ít nhất 1 lần**

## ⚠️ Cạm bẫy
- Lint/gitleaks để `continue-on-error` mãi → thành cảnh báo bị phớt. Dọn sạch rồi siết `false`.
- Thiếu khối `permissions: pull-requests: read` cho `gitleaks-action` → 403 bị `continue-on-error` nuốt lặng = "sạch" GIẢ, chưa hề quét PR lần nào.
- Sinh type từ DB dev dùng chung → type "đúng" mà prod vỡ.
- Backup vào chính cloud-sync/Git của bộ nhớ → nhân rủi ro, không phải dự phòng.

## Liên quan
- Đổi cách import/alias (vd `@/`) phải chạy thử ĐÚNG TẦNG test-runner, đừng chỉ tin CI xanh — xem bài `15-gotchas-thuong-gap.md`.

> Rửa: `<prod-id>`, tên bảng, tên repo, `<token>` → để placeholder/biến môi trường.
