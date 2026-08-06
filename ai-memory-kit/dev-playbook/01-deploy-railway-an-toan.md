# 01 — Deploy Railway an toàn + kiểm site sống

## 🎯 Vấn đề
"Deploy complete" KHÔNG có nghĩa là bản mới đã sống. Hay gặp: front-end vẫn bản cũ, migration treo êm ("relation does not exist"), hoặc `railway up` GHI ĐÈ mất code phiên khác. Monorepo thì build fail "No start command detected".

## ✅ Cách làm
1. **Trước khi deploy:** so cái sắp đẩy với bản gốc (`git fetch` → đo trên `origin/main`, KHÔNG tin checkout local cũ). `railway up` ghi đè service → nếu nghi container có code lạ, SSH vào kiểm trước.
2. **Migration phải chạy THẬT:** viết idempotent (`CREATE TABLE IF NOT EXISTS`…) và để **CI chạy migrate** như một job riêng — "bấm lệnh" ≠ migrate thành công.
3. **Monorepo (nhiều app/1 repo):** mỗi service set 2 biến Railpack: `RAILPACK_BUILD_CMD` (vd `npm run build:<app>`) + `RAILPACK_SPA_OUTPUT_DIR` (vd `apps/<app>/dist`). Thiếu → log rỗng, "No start command detected".
4. **Node version:** Railpack chạy `npm ci` → **lockfile phải khớp**; ghim `"engines":{"node":"22.x"}` + `.nvmrc` + biến `NODE_VERSION`. (Node <22 thiếu vài API native.)
5. **Graceful shutdown (SIGTERM) — tránh báo "crashed" GIẢ:** app Node chạy qua `npm start` là chạy qua **shell trung gian** (npm → sh → node), tiến trình node con **KHÔNG phải PID1**. Lúc nền tảng đổi bản (swap-deploy), nó gửi `SIGTERM` cho container cũ để dừng êm — nhưng `npm start` **không forward tín hiệu xuống node** → node bị kill thẳng bằng tín hiệu → npm coi đó là **thoát MÃ LỖI** (`npm error signal SIGTERM`) dù app đang chạy khỏe → nền tảng gửi email "crashed" **GIẢ**. Vá đủ **CẢ 2 bước** (thiếu 1 bước vẫn còn lỗi):
   - **Bước 1:** chạy **`node server.js` TRỰC TIẾP**, không qua `npm start` — để node là PID1, nhận tín hiệu trực tiếp (vd set thẳng start-command của hạ tầng, đừng dựa vào `npm start`).
   - **Bước 2:** trong code, bắt `SIGTERM`/`SIGINT` → đóng server (`server.close()`) → `process.exit(0)`, kèm timeout ép thoát kẻo treo. Xem `snippets/graceful-shutdown.ts`.
   - **Chẩn đoán trước khi hoảng:** soi metrics/logs của bản deploy đó — RAM phẳng, khởi động sạch, log dừng có `Stopping Container` + `npm error signal SIGTERM` ngay sau dòng chạy-bình-thường, và giờ báo crash **trùng khít giờ deploy** (không rải đều) → đúng bệnh thiếu graceful shutdown, không phải app lỗi thật.
   - Framework tự lo tín hiệu thì KHÔNG cần vá (vd `next start` của Next.js, NestJS) — chỉ đụng khi có bằng chứng email crash giả thật.
6. **NestJS — thiếu `tsconfig.build.json` làm LỆCH đường dẫn `dist`:** không có file này, `nest build` rơi về `tsconfig.json` (không loại `test/`) → output dist có thể **lồng** (`dist/src/main.js`) ở máy này nhưng **phẳng** (`dist/main.js`) ở máy khác → deploy lên server thì boot crash `Cannot find module '/app/dist/src/main.js'` dù local chạy ngon. Tạo `tsconfig.build.json` (mẫu ở `snippets/tsconfig.build.example.json`) exclude `test`/`**/*.spec.ts`, chỉ biên dịch `src/` → output CỐ ĐỊNH `dist/main.js` mọi nơi; sửa `"start:prod": "node dist/main.js"`.
7. **`NEXT_PUBLIC_*` nhúng lúc BUILD, không đọc runtime:** biến `NEXT_PUBLIC_*` của Next.js bị nhúng CỨNG vào bundle **lúc build**, không đọc lại lúc chạy. Đổi giá trị trên dashboard hạ tầng mà không build lại → app vẫn chạy giá trị CŨ một cách im lặng (dễ tưởng "đã cập nhật"). Đổi `NEXT_PUBLIC_*` xong PHẢI **bump 1 commit (hoặc trigger redeploy thủ công) để ép build lại** — đừng tin cache.
8. **Sau deploy — VERIFY (đừng tin báo "complete"):**
   - Backend: poll `/health` = 200 + đọc logs mới (xem `snippets/health-check.ts`).
   - Front-end: `curl` trang index → `grep` 1 **marker/route MỚI** (vì "200" có thể là bản cũ cache).
   - Báo TÁCH TẦNG: "backend ✅ / FE ⏳" nếu chưa chắc.

## 📋 Checklist
- [ ] `git fetch` + đo trên `origin/main` trước khi đẩy
- [ ] Migration idempotent + job CI migrate chạy thật
- [ ] (Monorepo) đã set `RAILPACK_BUILD_CMD` + `RAILPACK_SPA_OUTPUT_DIR`
- [ ] `engines.node` + `.nvmrc` + lockfile khớp
- [ ] App Node chạy `node server.js` TRỰC TIẾP (không qua `npm start`) + có handler SIGTERM/SIGINT đóng server rồi `exit(0)`
- [ ] (NestJS) có `tsconfig.build.json` → `dist/main.js` cố định mọi môi trường
- [ ] Đổi `NEXT_PUBLIC_*` đã bump commit / trigger rebuild (không chỉ đổi biến trên dashboard)
- [ ] Sau deploy: `/health`=200, logs mới, curl marker FE mới
- [ ] `git status` sạch (đã push, không untracked) TRƯỚC khi báo xong

## 💻 Code mẫu
`snippets/health-check.ts` (endpoint health + script poll) · `snippets/railpack-env.md` (cấu hình monorepo) · `snippets/graceful-shutdown.ts` (bắt SIGTERM/SIGINT thoát sạch) · `snippets/tsconfig.build.example.json` (mẫu NestJS).

## ⚠️ Cạm bẫy
- "Deploy complete" / CI xanh ≠ chạy thật → luôn chạm-bảng-thật + curl marker.
- `railway up` GHI ĐÈ → mất code phiên khác nếu không so trước.
- `git commit -a` KHÔNG bắt file MỚI-toanh → phải `git add` tường minh (kẻo module chạy dev mà không lên git).
- Email/alert "crashed" ngay sau mỗi lần deploy, trùng giờ swap-deploy, mà metrics/logs vẫn sạch → nghi THIẾU graceful shutdown trước khi hoảng — đừng vội rollback hay nghi code lỗi.
- Đừng tin "chắc `npm start` tự forward tín hiệu xuống node" — thực tế KHÔNG; phải chạy `node` trực tiếp làm PID1.
- Kiểm site sống: xem bài 01b dưới.

---

## 01b — Kiểm site sống/chết đáng tin
Đừng ping kiểu trình duyệt `no-cors` (luôn "ok" giả). Ping **từ máy chủ** + **User-Agent giả trình duyệt** (né tường lửa chặn bot 403 oan) + đọc header hạ tầng (vd `x-railway-fallback` cho biết service chết vs 404 thật).
- `2xx/3xx` = 🟢 sống · `401` = 🔵 cần đăng nhập (vẫn sống) · `403` = 🟠 bị chặn (thử đổi UA) · `404`+fallback-header = 🔴 service chết.
