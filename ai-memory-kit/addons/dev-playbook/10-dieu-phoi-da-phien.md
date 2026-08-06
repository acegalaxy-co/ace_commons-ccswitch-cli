# 10 — Điều phối đa-phiên (11 luật) — trỏ chéo MemoryOS

## 🎯 Vấn đề
Nhiều người/agent cùng làm trên 1 hệ → giẫm chân, mất code, merge đè.

> 📎 **Phần này đã có đầy đủ trong MemoryOS kit:** xem `../docs/multi-session.md` (11 luật + mẫu `_Backlog.md`). Bài này chỉ tóm tắt góc **dev/git** để khỏi lặp.

## ✅ 11 luật (tóm tắt)
1. Off `origin/main` mới `fetch`; làm trên bản mới nhất.
2. **1 việc = 1 nhánh/worktree.**
3. **NHẬN việc trước khi làm** (ghi `đang-làm` vào `_Backlog.md`), né vùng phiên khác giữ.
4. Lease có **TTL** (vd 3h) — quá hạn coi như nhả.
5. **WIP = 1** (mỗi phiên 1 việc đang dở).
6. **Merge tuần tự** (không merge song song lên main khi đang có PR mở).
7. XONG → báo **3 thứ:** đổi backlog `done`+PR · ghi mảnh nhớ · đẩy phần-còn-lại thành việc mới.
8. **Claim bằng git** (commit `_Backlog.md`) để phiên khác thấy.
9. Vùng file nóng dùng-chung → cờ báo trước khi đụng.
10. Cập nhật **NGAY khi phát sinh** (giả định phiên có thể đứt).
11. Backlog **tách theo dự án** khi nhiều dự án (1 file/cty) + 1 bảng tổng mỏng.

## 📋 Checklist
- [ ] Đã `fetch` + off `origin/main`
- [ ] Đã nhận việc trong `_Backlog.md` trước khi code
- [ ] 1 nhánh/việc · WIP=1 · merge tuần tự
- [ ] Xong báo 3 thứ + cập nhật ngay

## ⚠️ Cạm bẫy
- Không nhận việc trước → 2 phiên sửa cùng file = xung đột/mất code.
- Worktree/scratch để bừa ở Home → rác mồ côi; đặt đúng chỗ + dọn sau khi xong.
