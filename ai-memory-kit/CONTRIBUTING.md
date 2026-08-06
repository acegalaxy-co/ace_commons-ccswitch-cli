# Đóng góp ngược — vòng học 2 chiều

> Sau một thời gian dùng kit, bạn sẽ rút ra **cái hay** (nguyên tắc mới, engine cải tiến, mẫu/tài liệu tốt hơn). Gửi ngược về maintainer để **cả nhóm cùng học** — rồi mọi người `nang-cap` để nhận. Đây là cách kit **tiến hóa chung** thay vì mỗi người một bản.

## 📍 Gửi đóng góp vào ĐÂU
> **[Đích nội bộ — tổ chức khác chỉ cần đổi link này]**
>
> Bỏ thư mục/zip mà `dong-gop.mjs` tạo ra vào thư mục Google Drive chung:
>
> 📁 **MemoryOS - Đóng góp** → https://drive.google.com/drive/folders/1TgKP2jp2b505RZjS31JaoDM1f0X3ZAg0
>
> Maintainer (chủ kit) sẽ **duyệt + quét rò lại + merge** vào repo → ra bản mới cho mọi người `nang-cap`. Chưa "thêm được tệp" vào folder? → hỏi maintainer cấp quyền.

## Quy tắc VÀNG: chỉ góp KHUNG, không bao giờ góp DỮ LIỆU riêng
| 🟦 Góp được (KHUNG chung) | 🟥 KHÔNG bao giờ góp (riêng của bạn) |
|---|---|
| `tools/` (engine, hook) · `docs/` · `templates/` | `HANDBOOK.md` (sổ tay bạn điền) |
| `PRINCIPLES.md` · `HANDBOOK.template.md` | `Memories/` (mảnh ký ức của bạn) |
| `nang-luc-registry.json` (danh mục năng lực generic) | secret / `.env` / két riêng |
| nguyên tắc/bài học đã **rửa sạch** tên riêng | bối cảnh doanh nghiệp, số liệu, chiến lược riêng |

## 3 thứ đáng góp ngược
1. **Nguyên tắc/bài học hay** (generic) — bạn phát hiện cách làm tốt → thêm vào `PRINCIPLES.md`.
2. **Engine cải tiến / công cụ mới** trong `tools/`.
3. **Template / doc / danh mục năng lực** tốt hơn.

---

## Cách 1 — Gói "đề xuất" (ai cũng làm được, không cần git)
Trong thư mục bộ nhớ của bạn:
```bash
node tools/dong-gop.mjs "mô tả ngắn đề xuất của bạn" --block "TênCôngTy,tên-bạn"
```
Công cụ sẽ:
- Chỉ gom **phần KHUNG đã đổi** (có git) hoặc toàn bộ KHUNG (không git) — **không bao giờ** đụng `HANDBOOK.md`/`Memories/`.
- **TỰ QUÉT RÒ:** chặn nếu thấy secret; cảnh báo nếu thấy chữ trong `--block` (tên công ty/người của bạn).
- Tạo thư mục `…-dong-gop-<ngày-giờ>/` (kèm zip nếu máy có `zip`) gồm `DE-XUAT.md` + `proposal.patch` + bản sao file.

→ Điền `DE-XUAT.md` (đề xuất gì, vì sao) rồi **bỏ thư mục/zip đó vào Drive "MemoryOS - Đóng góp"** (xem mục 📍 ở trên). Đây là **kênh chính**.

## Cách 2 — Pull Request (tuỳ chọn, nếu bạn quen git)
```bash
git checkout -b de-xuat/<tên-ngắn>
# sửa file KHUNG (tools/ docs/ PRINCIPLES.md…)
git add <chỉ-file-khung-bạn-đổi>      # ĐỪNG add HANDBOOK.md / Memories/
git commit -m "đề xuất: ..."
git push -u origin de-xuat/<tên-ngắn>   # rồi mở Pull Request trên GitHub
```
> ⚠️ Trước khi push: tự rà chắc commit KHÔNG kèm `HANDBOOK.md`, `Memories/`, secret.

---

## Vai MAINTAINER (người gác cổng)
Mọi đóng góp **đi qua maintainer** (đừng để ai tự merge vào kit chung):
1. Nhận gói/PR → **quét rò lại** (tên riêng, secret, dữ liệu lọt).
2. **Duyệt** nội dung (đúng generic? hữu ích chung?). Cần thì rửa thêm.
3. Merge vào `main` → bump `VERSION` + ghi `CHANGELOG.md` → phát bản mới.
4. Báo mọi người: chạy `node tools/nang-cap.mjs <thư-mục-của-bạn>` để nhận.

## Vòng khép kín
```
Bạn dùng kit → học được cái hay → dong-gop.mjs (chỉ KHUNG + quét rò) → maintainer duyệt
   → bản mới → mọi người nang-cap.mjs nhận → lại dùng → lại học …
```
Chiều **xuống** = `nang-cap.mjs`; chiều **lên** = `dong-gop.mjs`. Cùng một luật: chỉ động KHUNG, giữ nguyên dữ liệu riêng.
