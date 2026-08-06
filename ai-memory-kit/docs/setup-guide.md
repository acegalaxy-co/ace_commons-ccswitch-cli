# Hướng dẫn dựng tủ bộ nhớ của riêng bạn

## Yêu cầu
- Node.js (cho `*.mjs`), `git`, `rsync` (có sẵn trên macOS/Linux).
- Một trợ lý AI đọc được file dự án (vd Claude Code đọc `CLAUDE.md` + bộ nhớ).

## Bước 1 — Đặt thư mục bộ nhớ
Copy nguyên kit này thành thư mục bộ nhớ của bạn, vd `~/MyMemory/`. Cấu trúc:
```
MyMemory/
  HANDBOOK.md           ← đổi tên từ HANDBOOK.template.md, điền của bạn (Tầng 0)
  Memories/
    MEMORY.md           ← mục lục tổng (Tầng 0)
    _Common/INDEX.md
    <DựÁn>/INDEX.md + các mảnh .md
  tools/                ← 4 script engine (giữ trong tools/, là CHA = thư mục bộ nhớ)
  .cleanup-state.json
```
> `tools/` mặc định coi **thư mục CHA của nó** là gốc bộ nhớ. Muốn khác → đặt biến `MEMORY_ROOT`.

## Bước 2 — Điền sổ tay
- Đổi `HANDBOOK.template.md` → `HANDBOOK.md`. Điền các mục ⚙️: bạn là ai, lằn ranh đỏ, nguyên tắc, quyền tự quyết, cách giao tiếp.
- 💡 Lười viết nguyên tắc từ đầu? Mở `PRINCIPLES.md` (thư viện nguyên tắc-vàng mẫu, đã rửa sạch) → chép mục nào thấy đúng vào `HANDBOOK.md`.
- Sửa `Memories/MEMORY.md` cho khớp nhóm của bạn. Xoá `SampleProject` khi bắt đầu thật.

## Bước 3 — Tạo dự án/mảnh
- Nhóm mới = thư mục trong `Memories/` + 1 `INDEX.md` (theo `templates/GROUP-INDEX.template.md`).
- ✍️ Mảnh mới = chạy **`node tools/ghi-manh.mjs <Nhóm> <slug> "<mô tả>" [status] [type]`** — tự sinh frontmatter ĐỦ + tự thêm vào INDEX (chống thiếu-status/mồ côi tận gốc). (Hoặc chép tay từ `templates/piece.template.md`; 1 mảnh = 1 ý, `name` = tên file.)
- Mỗi nhóm nên có 1 `tien-do.md` (bảng tiến độ ✅/🔄/⏳ + nhật ký) theo `templates/tien-do.template.md` — mở lại biết ngay đã tới đâu.
- Repo có code? Thêm `CLAUDE.md` gọn theo `templates/CLAUDE.template.md`.
- ⚠️ Tên file TRÙNG ở nhiều nhóm (vd `INDEX`, `tien-do`) → link phải ghi rõ `[[Nhóm/tên]]`, không để `[[tên]]` trần.

## Bước 4 — Chạy engine
```bash
node tools/build-index.mjs --all --write     # in lại mọi INDEX tự-sinh từ frontmatter
node tools/memory-doctor.mjs --fix           # khám + vá + chụp git mirror + IN LẠI 2 bảng (tiến độ + sổ năng lực)
node tools/tien-do.mjs --write               # (chạy riêng nếu muốn) bảng tiến độ toàn hệ
node tools/so-nang-luc.mjs --write           # (chạy riêng nếu muốn) sổ năng lực học chéo
bash tools/snapshot.sh manual                # snapshot tay (tuỳ chọn)
```

## Bước 4b — Bật HỌC CHÉO (tuỳ chọn nhưng nên)
- Sửa `tools/nang-luc-registry.json` cho khớp các năng lực lặp-lại của bạn (đổi `tu-khoa` sang tiếng của bạn để hook ngửi đúng).
- Gắn `capability: <slug>` + `do-tin: cao|vua|thap` vào frontmatter các mảnh "bản tốt nhất". Mồi nhanh: sửa `MAP` trong `tools/moi-so-nang-luc.mjs` rồi `node tools/moi-so-nang-luc.mjs --write`.
- Chi tiết: [`hoc-cheo-tu-bao-tri.md`](hoc-cheo-tu-bao-tri.md).

## Bước 5 — Nối hook vào trợ lý AI (Claude Code ví dụ)
> ⚡ **TỰ ĐỘNG:** `bash tools/install-memory.sh <đường-dẫn-project>` (hoặc chạy tại root project, không arg) làm HẾT bước này — wire 4 hook vào `.claude/settings.local.json` + tạo CLAUDE.md pointer + tạo nhóm bộ nhớ. Idempotent (chạy lại không nhân đôi). Kiểm: `bash tools/install-memory.sh --self-check`. Phần dưới là làm TAY (fallback / để hiểu hook nào đi đâu).

Trong `settings.json` của trợ lý (mọi hook đều fail-open / không chặn việc khi lỗi):
- **SessionStart** → `node <gốc>/tools/cleanup-nudge.mjs` (nhắc dọn + nhắc đúc-kết khi tới hẹn).
- **PreToolUse (Edit|Write)** → `node <gốc>/tools/handbook-gate.mjs` (chặn sửa bộ nhớ khi chưa đọc Tầng 0; đã vá để KHÔNG chặn nhầm sub-agent). Đặt `HANDBOOK_NAME=HANDBOOK.md` + `MEMORY_DIR_MARKER=/Memories/` nếu khác mặc định.
- **UserPromptSubmit** → `node <gốc>/tools/pre-work-nudge.mjs` (ngửi "mùi việc lặp" → nhắc tra Sổ Năng Lực trước khi làm).
- **Stop** → `node <gốc>/tools/memory-autofix.mjs` (tự khám + vá cuối mỗi lượt, van 90s, im khi sạch).

## Bước 6 — Biến môi trường (tuỳ chọn)
| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `MEMORY_ROOT` | thư mục bộ nhớ | cha của tools/ |
| `MEMORY_BACKUP_DIR` | nơi snapshot FIFO | `~/MemoryBackups` |
| `MEMORY_GIT_MIRROR` | git mirror lịch sử (NGOÀI cây bộ nhớ) | `~/MemoryGitMirror` |
| `MEMORY_MIN_FILES` | sàn an toàn (ít hơn thì không mirror) | 10 |
| `HANDBOOK_NAME` | tên file sổ tay Tầng 0 | `HANDBOOK.md` |

## Bước 7 — Nhiều phiên AI song song? (tùy chọn)
Nếu bạn mở nhiều cửa sổ/agent cùng làm trên 1 kho → đọc `docs/multi-session.md` + tạo `Memories/_Backlog.md` theo `templates/BACKLOG.template.md`. Cốt lõi: đồng-bộ-trước-khi-làm · 1 việc=1 nhánh · nhận-việc-trước-khi-làm · xong-báo-3-thứ · WIP=1.

## Bước 8 — Xem bằng Obsidian (tùy chọn)
Cây bộ nhớ này đã là Obsidian vault chuẩn (có sẵn `.obsidian/`). Muốn *nhìn* mạng lưới ký ức: cài [Obsidian](https://obsidian.md) (miễn phí) → **Open folder as vault** → trỏ vào thư mục bộ nhớ → bật **Graph view**. Chỉ để con người xem; AI vẫn đọc kho theo phân tầng.

## Lằn ranh an toàn (đọc kỹ)
- ❗ **KHÔNG để secret trần** trong cây bộ nhớ — để ở **két riêng NGOÀI** cây (git mirror sẽ DỪNG nếu thấy secret).
- ❗ Két riêng KHÔNG nằm trong thư mục bộ nhớ (kẻo backup hút secret ra git/cloud).
- ❗ Đụng key/URL/biến môi trường → đối chiếu `.env` của đúng dự án rồi cập nhật bộ nhớ ngay; **đừng tin tham chiếu cũ** trong bộ nhớ (cấu hình hay trôi). Bộ nhớ chỉ ghi TÊN biến + nơi để.
- ❗ Nếu đặt bộ nhớ trên cloud sync (iCloud/Drive): đừng để code/.git trong đó (gây hỏng); chỉ để markdown.
