# 23 — Kiểm site/service sống-chết ĐÁNG TIN (chống báo giả)

Bài này giải quyết gì: khi làm trang theo dõi / status page / hộp lỗi / giám sát nền "site còn sống không", rất dễ báo SAI theo cả 2 hướng — báo "sống" giả (ping trình duyệt trả opaque) hoặc báo "chết" giả (mạng phía mình rớt). Bài này gom 4 quy tắc để lưới giám sát đáng tin.

## 🎯 Vấn đề
- `fetch(mode:'no-cors')` ở trình duyệt trả **opaque** → resolve cả khi server 401/403/500 → đèn "sống" GIẢ.
- Anti-bot chặn User-Agent trần của `curl`/`fetch` → **403 oan** dù site vẫn sống.
- Không phân biệt "service không chạy" với "404 thật".
- Giám sát nền: máy nhà ngủ / wifi rớt → mọi `fetch` timeout → code coi MỌI lỗi = "chết" → **spam báo đỏ giả → lưới rách** (mất tin, lúc chết thật lại bỏ qua).

## ✅ Cách làm — 4 quy tắc

1. **Ping TỪ MÁY CHỦ, đừng ping ở trình duyệt.** Đặt endpoint `/status` ở server; server tự gọi site rồi trả **mã HTTP + ms thật**. Trình duyệt không đọc được mã của cross-origin no-cors nên không thể phân biệt sống/chết.
2. **Gửi User-Agent BROWSER khi ping.** Không thì lớp anti-bot (WAF/CDN) chặn UA lạ → **403 oan** dù site sống. Dùng UA của trình duyệt thật (vd `Mozilla/5.0 ...`).
3. **Đọc header hạ tầng để phân biệt "service không chạy" vs "404 thật".** Nhiều PaaS trả **header fallback riêng** khi domain không có deployment nào chạy (vd một header dạng `x-<paas>-fallback: true`) — đó là service chết, khác trang 404 do sai đường dẫn. Đặt `redirect: 'manual'` để **3xx = sống** (chuyển hướng tới `/login` chẳng hạn), không đi theo redirect làm sai mã.
4. **Giám sát NỀN phải có CỔNG-MẠNG chống báo giả.** Phân biệt lỗi-phía-mình với server thật chết TRƯỚC khi báo:
   - **Phân biệt nguồn lỗi:** `netErr` (timeout/connect lỗi PHÍA MÌNH) ≠ `HTTP 5xx` / header-fallback-PaaS (đã connect tới server = site THẬT chết). HTTP/fallback → **báo ngay** (không gate). netErr → cần gate.
   - **Cổng-mạng:** trước khi báo, nếu gặp `netErr` thì ping **một mốc tin cậy ≠ site mình** (một endpoint `generate_204` hoặc IP DNS công cộng, HEAD ~5s; 1 cái thông = mình đang online). **Máy offline → IM HẲN** (đừng spam). Online mà site vẫn lỗi = chết thật → báo.
   - **Retry:** mỗi site thử ~2 lần cách vài giây — lỗi mạng tức thời tự khỏi.
   - **Bản tin định kỳ cũng retry khi gửi:** máy vừa thức, wifi chưa lên → gửi tin lỗi. Bọc retry (vd 10 lần, cách 30s) để không mất bản tin.

## 📊 Phân loại mã → trạng thái

| Mã | Nghĩa |
|---|---|
| 2xx · 3xx | 🟢 Sống (3xx = chuyển hướng, vẫn sống) |
| 401 | 🔵 Cần đăng nhập (vẫn sống) |
| 403 | 🟠 Bị chặn (nếu đã gửi UA browser mà vẫn 403 = chặn thật) |
| 404 + header-fallback-PaaS | 🔴 Service không chạy |
| 404 (không fallback) | 🟠 Sai đường dẫn |
| 5xx · timeout · không phản hồi | 🔴 Lỗi / chết |

## 📋 Checklist
- [ ] `/status` ping SERVER-SIDE, trả mã HTTP + ms thật
- [ ] Gửi User-Agent browser để né anti-bot 403 oan
- [ ] Đọc header-fallback hạ tầng + `redirect:'manual'` (3xx = sống)
- [ ] Giám sát nền: phân biệt netErr ≠ 5xx; cổng-mạng ping mốc-tin-cậy trước khi báo
- [ ] Offline → IM (không spam); retry lỗi mạng tức thời + retry khi gửi bản tin

## ⚠️ Cạm bẫy
- Tin ping `no-cors` ở trình duyệt → "sống" giả cả khi server 500.
- Coi mọi lỗi `fetch` = site chết → spam báo giả khi máy mình rớt mạng → **lưới mất uy tín**.
- Đi theo redirect → mã cuối khác mã đầu → phân loại sai.

> **Nguyên tắc gốc:** lưới giám sát phải ĐÁNG TIN — **thà IM khi không chắc còn hơn báo giả**. Một lần báo giả là người vận hành bắt đầu bỏ qua cảnh báo.

## Liên quan
- Kiểm site sống sau deploy (endpoint `/health` + script poll): `snippets/health-check.ts`.
- Giám sát job nền / cron 4 lớp + alert best-effort: `14-giam-sat-job-nen.md`.
