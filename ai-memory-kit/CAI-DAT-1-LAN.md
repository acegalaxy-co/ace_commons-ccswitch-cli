# Cài 1 lần, dùng mãi

Không cần biết kỹ thuật. Làm đúng 3 bước sau, xong thì **mọi project** trên máy bạn, Claude Code tự biết vault này.

## Bước 1 — Cài Google Drive desktop
Tải tại [drive.google.com/drive/download](https://www.google.com/drive/download/), đăng nhập, mở được thư mục vault này trên máy (không cần tải về — Drive tự sync).

## Bước 2 — Cài Node.js
Tải bản **LTS** tại [nodejs.org](https://nodejs.org), cài xong không cần chỉnh gì thêm.

## Bước 3 — Kéo-thả `cai-dat.sh` vào Terminal
1. Mở app **Terminal** (macOS: Spotlight gõ "Terminal").
2. Gõ `bash ` (có dấu cách sau, chưa Enter).
3. **Kéo file `cai-dat.sh`** (nằm trong thư mục vault này) từ Finder **thả vào cửa sổ Terminal** — Terminal tự điền đúng đường dẫn kể cả khi tên thư mục có dấu cách (khỏi phải tự gõ path).
4. Nhấn Enter.

Xong. Từ giờ Claude Code ở **bất kỳ project nào** trên máy bạn tự đọc business rules từ vault này — không cần làm lại bước nào.

## Kiểm tra
Muốn chắc chắn cài đúng: `bash "<đường-dẫn-vault>/cai-dat.sh" --self-check` (dùng cách kéo-thả ở Bước 3 để lấy path). In `PASS` hết từng mục là ổn.

## Gỡ cài đặt
Không dùng nữa: `bash "<đường-dẫn-vault>/cai-dat.sh" --go-remove` — gỡ sạch hook + pointer khỏi máy, không đụng dữ liệu trong vault.
