# Skills — bộ slash-command rà soát / kiểm thử / hội đồng / dọn tủ

> 4 "skill" (slash-command cho trợ lý AI dạng Claude Code) đúc từ thực chiến, **đã rửa sạch danh tính**. Cài vào là có ngay "đội rà soát + kiểm thử + hội đồng chuyên gia + dọn tủ bộ nhớ".

## Cách cài
Mỗi file `.md` ở đây = 1 slash-command. Chép vào thư mục lệnh của trợ lý AI của bạn (vd Claude Code: `~/.claude/commands/`), rồi gọi `/<tên>` trong phiên. (Cũng dùng được như tài liệu quy trình nếu trợ lý của bạn không có slash-command.)

```bash
cp addons/skills/*.md ~/.claude/commands/      # ví dụ với Claude Code
```

## Có gì
| Lệnh | Làm gì | Cặp với |
|---|---|---|
| [`/ra-soat`](ra-soat.md) | Rà CODE bằng nhiều trợ lý song song (bảo mật·logic·UX·hiệu năng·độ bền·giao diện) → gom + ưu tiên | `/kiem-thu` |
| [`/kiem-thu`](kiem-thu.md) | CHẠY THỬ luồng xương sống với data thật (cô lập) → ✅/❌ từng bước | `/ra-soat` |
| [`/hoi-dong`](hoi-dong.md) | HỘI ĐỒNG chuyên gia LĨNH VỰC phản biện + đề xuất nâng cấp theo mục tiêu | bộ ba chất lượng |
| [`/don-tu`](don-tu.md) | DỌN TỦ bộ nhớ theo NGHĨA (trùng/mâu thuẫn/nhầm nhóm/vụn-nên-đúc) → tờ trình duyệt | MemoryOS |

## Phân vai — đừng nhầm
- `/ra-soat` = đọc-soi tĩnh, săn **lỗi/lỗ hổng kỹ thuật** trong CODE.
- `/kiem-thu` = chạy thử THẬT luồng (✅/❌).
- `/hoi-dong` = chuyên gia LĨNH VỰC phản biện + lộ trình NÂNG CẤP theo mục tiêu.
- `/don-tu` = dọn lỗi **THEO NGHĨA** trong TỦ BỘ NHỚ (khác `tools/memory-doctor.mjs` lo lỗi cơ học).
- 🔒 Bảo mật khối nhạy cảm trước go-live → xem `../ai-patterns/03-red-team-agent.md`.

> ⚙️ **Khi cài:** các lệnh tham chiếu "thư mục bộ nhớ của bạn", `tools/memory-doctor.mjs`, `Memories/...` theo cấu trúc MemoryOS kit — đổi đường dẫn nếu tủ của bạn đặt chỗ khác. Rửa thêm gu/chuẩn riêng của bạn vào nếu muốn.
