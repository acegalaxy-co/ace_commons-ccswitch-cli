---
name: doctor-memory
description: Health-check + auto-fix auto-memory system — quét mọi memory dir (global tới project hiện tại), tự sửa case chắc chắn (broken link, orphan, naming lệch, nội dung dài nhét thẳng MEMORY.md), liệt kê + hỏi confirm trước khi xoá file thừa/trùng/stale. Chạy /doctor-memory, hoặc khi user hỏi "dọn memory", "memory nào thừa", "health check memory", "chuyển memory sang load động".
user-invocable: true
---

# doctor-memory — health-check + auto-fix auto-memory system

Cross-project: memory dir nằm ở `~/.claude/projects/<cwd-slug>/memory`, khoá theo path cwd chính xác. Mỗi dir có `MEMORY.md` (index, nạp TĨNH mọi session) + N file `user_*/feedback_*/project_*/reference_*.md` (nạp ĐỘNG, chỉ khi Claude Read/recall). Mục tiêu: MEMORY.md càng gọn càng tốt (chỉ 1 dòng/entry trỏ file), nội dung thật nằm trong file riêng.

Memory dir KHÔNG phải git repo — xoá không khôi phục được. Fix cấu trúc (broken link, rename, tách file) auto làm luôn. Xoá nội dung (file thừa/trùng/stale) BẮT BUỘC liệt kê + hỏi `[a]ll/[s]elect/[n]one` trước, không tự xoá.

## Bước 1 — Tìm memory dir liên quan

```bash
p="$PWD"; chain=()
while true; do
  slug="$(echo "$p" | sed 's/[\/_]/-/g')"
  d="$HOME/.claude/projects/$slug/memory"
  [ -d "$d" ] && chain+=("$d")
  [ "$p" = "$HOME" ] && break
  p="$(dirname "$p")"
done
printf '%s\n' "${chain[@]}"
```

Audit từng dir tìm được (thường 2: global `$HOME` + project hiện tại). Có thể nhiều hơn nếu Claude Code từng chạy ở thư mục trung gian.

## Bước 2 — Quét từng memory dir

Với mỗi dir, đọc `MEMORY.md` + `ls *.md` (trừ MEMORY.md), rồi phân loại:

1. **Broken link** — MEMORY.md trỏ file không tồn tại.
2. **Orphan file** — file tồn tại, không dòng nào trong MEMORY.md trỏ tới.
3. **Naming lệch** — filename ≠ `<name:>` trong frontmatter, hoặc prefix không khớp `metadata.type` (user_/feedback_/project_/reference_).
4. **Nội dung nhét thẳng MEMORY.md** — dòng index không phải format `- [Title](file.md) — hook` (vd nguyên đoạn văn bản, block dài) → đây là case "tĩnh nên chuyển động".
5. **Thừa/trùng** — 2+ file `description` overlap rõ cùng chủ đề.
6. **Stale** — nội dung có claim kiểm chứng được (path/file/hành vi) nhưng không còn đúng ở codebase hiện tại (verify bằng Read/grep thực tế, không đoán).
7. **Not-memory-worthy** — nội dung lẽ ra nên nằm trong CLAUDE.md/rule chứ không phải memory (code convention, kiến trúc suy ra được từ code).

## Bước 3 — Auto-fix (không hỏi) vs liệt kê-hỏi (destructive)

**Auto-fix ngay, không cần hỏi từng cái** (thuần cấu trúc, không mất nội dung):

- Broken link → sửa lại path hoặc xoá dòng index (nếu file thật sự mất).
- Orphan file có giá trị → thêm dòng index trỏ tới.
- Naming lệch → rename file khớp `name:` frontmatter + sync lại link trong MEMORY.md. KHÔNG đổi nội dung body.
- Nội dung nhét thẳng MEMORY.md → tách ra file riêng đúng type prefix (`user_/feedback_/project_/reference_`) với frontmatter chuẩn, rút MEMORY.md còn 1 dòng link. Đây chính là "chuyển tĩnh → động".

**Liệt kê + hỏi confirm trước khi xoá** (mất nội dung, không undo được):

- Orphan file không còn giá trị.
- Thừa/trùng — đề xuất giữ file nào, xoá file nào.
- Stale — đã verify claim sai/lỗi thời.
- Not-memory-worthy — đề xuất xoá khỏi memory (và nói rõ nên add vào CLAUDE.md/rule thay vì memory nếu còn giá trị).

Format hỏi: liệt kê từng file kèm lý do 1 dòng, rồi hỏi `[a]ll xoá hết / [s]elect chọn từng cái / [n]one giữ nguyên`.

## Bước 4 — Thống kê tĩnh vs động

Cho mỗi memory dir:

- **Nạp tĩnh (mọi session)**: số dòng + ước lượng token của MEMORY.md sau khi đã gọn.
- **Nạp động (chỉ khi recall)**: tổng số file còn lại, kích thước từng file.
- So sánh trước/sau fix — bao nhiêu token tĩnh tiết kiệm được nhờ tách nội dung ra file riêng.

## Report

- Bảng: memory dir → tồn tại → số file → số vấn đề theo loại.
- Mỗi vấn đề: loại → file liên quan → hành động (ĐÃ SỬA tự động / ĐÃ XOÁ sau confirm / FLAG chờ user).
- Thống kê Bước 4 trước/sau.
- Nếu có xoá/rename: liệt kê rõ + xác nhận MEMORY.md đã sync.
