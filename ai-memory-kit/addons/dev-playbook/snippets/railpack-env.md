# Railpack — cấu hình deploy (monorepo + Node version)

> Railpack (builder mặc định của một số PaaS như Railway) tự dò build. Monorepo nhiều app → phải chỉ rõ, kẻo "No start command detected" (log rỗng, dễ tưởng lỗi builder).

## Monorepo — mỗi service set 2 biến
```
RAILPACK_BUILD_CMD       = npm run build:<app>      # lệnh build đúng app
RAILPACK_SPA_OUTPUT_DIR  = apps/<app>/dist          # thư mục output tĩnh
```
- Mỗi app = 1 service riêng, cùng repo, khác 2 biến trên.
- Backend (không phải SPA) thì set start command thay vì SPA_OUTPUT_DIR.

## Node version (tránh "thiếu API native")
`package.json`:
```json
{ "engines": { "node": "22.x" } }
```
+ file `.nvmrc`:
```
22
```
+ biến môi trường hạ tầng (nếu cần): `NODE_VERSION=22`.

## Lockfile phải KHỚP
Builder chạy `npm ci` → `package-lock.json` lệch `package.json` = fail (vd thiếu dependency phụ). Sau khi đổi deps: chạy `npm install` để cập lockfile rồi commit cả hai.

## Verify sau deploy
- `/health` = 200 + logs mới (đừng tin "Deploy complete").
- FE: `curl` index → `grep` marker/route MỚI (200 có thể là bản cũ).
