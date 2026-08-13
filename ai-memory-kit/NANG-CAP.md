# Nâng cấp tủ bộ nhớ đã cài lên bản MỚI

> Dành cho người **đã cài kit từ trước (v1/v2…)** và muốn lên bản mới mà **KHÔNG mất** sổ tay + mảnh ký ức đã điền. Bản kit chỉ cập nhật phần KHUNG (công cụ, mẫu, tài liệu, nguyên tắc) — dữ liệu của bạn giữ nguyên.

## Cách nhận biết bạn đang ở bản nào
Mở file `VERSION` trong thư mục bộ nhớ (vd `~/MyMemory/VERSION`). Không có file đó = bản cũ (v1/v2). Bản mới nhất xem ở `CHANGELOG.md`.

---

## Cách 1 — Nhờ trợ lý AI làm hộ (dễ nhất, không cần gõ lệnh)
Tải kit mới về, đưa cả 2 thư mục cho AI (vd Claude Code) rồi nói:
```
"Đây là kit MỚI và đây là thư mục bộ nhớ CŨ của tôi (~/MyMemory).
Đọc NANG-CAP.md rồi nâng cấp giúp tôi: chạy tools/nang-cap.mjs,
nối 2 hook mới, và báo tôi còn việc gì cần làm tay."
```

## Cách 2 — Tự chạy 1 lệnh (an toàn, tự sao lưu)
Trong **thư mục kit MỚI** vừa tải về, mở Terminal và gõ (thay đường dẫn tủ của bạn):
```bash
node tools/nang-cap.mjs ~/MyMemory
```
Lệnh này sẽ:
1. 💾 **Tự sao lưu** cả tủ của bạn sang `~/MyMemory-backup-<ngày-giờ>` (không xoá gì).
2. ✅ **Ghi đè** phần KHUNG: `tools/` (engine + hook), `docs/`, `templates/`, `PRINCIPLES.md`, `README.md`, `CHANGELOG.md`, `HUONG-DAN.html`, `HANDBOOK.template.md`, `VERSION`.
3. 🛟 **Giữ cấu hình của bạn:** `tools/nang-luc-registry.json`, `tools/moi-so-nang-luc.mjs`.
4. 🔒 **KHÔNG đụng:** `HANDBOOK.md` (sổ tay bạn điền) · `Memories/` (mảnh của bạn) · file trạng thái.

## Cách 3 — Nếu bạn cài bằng `git clone`
```bash
cd ~/MyMemory
git stash        # cất tạm chỉnh sửa cục bộ (nếu có)
git pull         # kéo bản mới
git stash pop    # trả lại chỉnh sửa (xử lý xung đột nếu có)
```
> `git pull` chỉ hợp nếu bạn KHÔNG sửa file khung. Có sửa nhiều → dùng **Cách 2** cho chắc.

---

## Sau khi nâng cấp — 2 việc tay (nếu lên từ v1/v2)
1. **Nối 2 hook MỚI** vào `settings.json` của trợ lý AI:
   | Khi nào | Chạy gì | Để làm |
   |---|---|---|
   | UserPromptSubmit | `node <gốc>/tools/pre-work-nudge.mjs` | Nhắc tra Sổ Năng Lực trước việc lặp (học chéo) |
   | Stop | `node <gốc>/tools/memory-autofix.mjs` | Tự khám + vá tủ cuối mỗi lượt |
   (2 hook cũ — SessionStart→cleanup-nudge, PreToolUse→handbook-gate — giữ nguyên.)
2. **(Tuỳ chọn)** Mở `PRINCIPLES.md` mục **29–31** (học chéo · tiêm phòng · SSOT máy-in) — chép vào `HANDBOOK.md` nếu thấy đúng.

## Kiểm tra cuối
```bash
cd ~/MyMemory && node tools/memory-doctor.mjs --fix
```
Thấy **🟢 TỦ BỘ NHỚ KHOẺ** + có thêm `Memories/TIEN-DO.md` và `Memories/SO-NANG-LUC.md` = nâng cấp xong. Yên tâm rồi thì xoá thư mục `…-backup-…`.

> 💡 Lần sau nâng cấp tiếp cũng chạy đúng `tools/nang-cap.mjs` như vậy — nó luôn giữ dữ liệu của bạn.
