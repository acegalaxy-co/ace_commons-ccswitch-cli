# 27 — Dựng để BÀN GIAO ngay từ đầu

🎯 **Vấn đề:** Một hệ thống dựng bằng AI, với người chủ dự án là người non-tech, rất dễ rơi vào 1 trong 2 bẫy: (a) hệ chỉ chạy được khi có AI ngồi cạnh dựng tiếp — không ai khác đọc hiểu/vận hành được, hoặc (b) mọi quyết định kỹ thuật dồn về đúng 1 người không có thời gian ngồi code hằng ngày. Cả hai đều khiến tổ chức nghẽn tại 1 điểm. Bài này gom mô hình bàn-giao-được ngay từ khi bắt đầu dựng, không phải sửa lại sau.

## Mô hình 3 vai
Người chủ (thường là người điều hành, non-tech, không có thời gian code/vận hành hằng ngày) chỉ nên đứng ở **giai đoạn nền móng** của mỗi hệ thống: khởi tạo, định hướng kiến trúc, chọn công nghệ, duyệt các quyết định lớn. Sau đó bàn giao:

| Vai | Nhận phần nào |
|---|---|
| **Người chủ** | Khởi tạo + định hướng + giữ CỔNG DUYỆT go-live/quyết định chiến lược. Không ngồi code/vận hành hằng ngày. |
| **Đội hạ tầng (IT)** | Tiếp quản vận hành hạ tầng: deploy, môi trường, secret, giám sát uptime. |
| **1 lập trình viên giỏi dùng AI** | Tiếp quản bug + tính năng mới sau giai đoạn nền móng — làm việc trực tiếp với trợ lý AI để duy trì/mở rộng hệ thống. |

## Vì sao mô hình này bắt buộc, không phải tuỳ chọn
Người đứng đầu 1 tổ chức không thể vừa điều hành chiến lược (bán hàng, gọi vốn, ra quyết định lớn) vừa ngồi review từng dòng code, từng lần deploy. Nếu vai trò kỹ thuật hằng ngày dồn hết về 1 người ở vị trí điều hành, tổ chức không mở rộng được — mọi việc chờ đúng 1 người rảnh. Vai trò đúng của người đó với công nghệ là **người khởi tạo + người giữ cổng duyệt**, không phải người vận hành.

## 4 quy tắc tái dùng (áp dụng cho MỌI hệ thống, không cần đợi ai nhắc)

### 1. Dựng để BÀN GIAO ĐƯỢC ngay từ đầu
Không phải "dựng xong rồi tính chuyện bàn giao sau" — thiết kế ngay từ lúc bắt đầu để người khác tiếp quản được: code sạch (đặt tên rõ, cấu trúc thường gặp, không mẹo lạ khó đọc), tài liệu bàn giao đủ (kiến trúc, cách chạy local, cách deploy, biến môi trường cần gì), repo chia sẻ được (không khoá quyền vào 1 tài khoản cá nhân). Một hệ dựng nhanh nhưng chỉ AI hiểu được cấu trúc, hoặc chỉ người dựng ra mới biết chạy thế nào, là nợ kỹ thuật ngay từ ngày đầu — không phải vấn đề "để sau".

### 2. Giảm TỐI ĐA việc tay của người chủ
Người chủ lý tưởng chỉ chạm **đúng 1 điểm**: cổng duyệt go-live (bấm duyệt/merge cho bước hệ trọng). Không nên bắt người chủ tự thực hiện các bước kỹ thuật (chạy lệnh, sửa file cấu hình, tra biến môi trường). Khi trợ lý AI vướng 1 rào cản kỹ thuật cần quyền hạn, cách đúng là AI tự tìm cách xử lý hoặc xin gỡ đúng rào cản đó — không phải đẩy thao tác kỹ thuật ngược lại cho người chủ chỉ vì "cần ai đó bấm nút này".

### 3. Vòng cộng tác chuẩn
```
AI viết code/hạ tầng
   ↓ mở Pull Request
Người tiếp quản (IT / dev) review kỹ thuật
   ↓
Người chủ duyệt (chỉ ở bước hệ trọng / go-live)
   ↓
Người tiếp quản chạy/áp dụng thật + giữ secret, state
```
Người chủ không nằm ở giữa vòng lặp kỹ thuật (review diff, chạy lệnh) — chỉ xuất hiện ở đúng bước cần quyết định có nên đi tiếp hay không.

### 4. Đây là bàn giao NỘI BỘ — khác bàn giao ra đội bên ngoài
Mô hình này giả định người tiếp quản (IT, dev giỏi-AI) là người **trong tổ chức**, được tin cậy, có quyền truy cập hệ thống thật. Trọng tâm là **quy trình + tài liệu** để người đó chạy tiếp trơn tru. Bàn giao ra một đội **bên ngoài tổ chức** là bài toán khác hẳn — cần thêm bước rửa dữ liệu nhạy cảm, tách quyền truy cập, và các ràng buộc pháp lý/bảo mật không nằm trong phạm vi bài này.

## 💻 Ví dụ — mục lục tối thiểu của tài liệu bàn giao
Không cần tài liệu đồ sộ; cần ĐỦ để người tiếp quản tự chạy được mà không phải hỏi lại người dựng ban đầu. 1 file `docs/HANDOFF.md` với các mục sau là đủ cho phần lớn hệ thống vừa và nhỏ:

```markdown
# Bàn giao hệ thống <tên hệ thống>

## 1. Kiến trúc tổng quan
- Sơ đồ/ mô tả ngắn các thành phần chính (app, DB, job nền, dịch vụ ngoài đang dùng)
- Repo nằm ở đâu, ai có quyền truy cập

## 2. Chạy local
- Lệnh cài đặt + chạy (copy-paste chạy được ngay, không giả định môi trường sẵn có)
- File `.env.example` liệt kê đủ biến cần, kèm mô tả từng biến dùng để làm gì

## 3. Deploy / go-live
- Các bước từ merge → lên môi trường thật, ai bấm nút nào
- Cổng duyệt nào cần người chủ, cổng nào người tiếp quản tự quyết

## 4. Vận hành hằng ngày
- Xem log/lỗi ở đâu, việc gì cần làm định kỳ (backup, giám sát job nền...)
- Cách xử lý sự cố thường gặp + cách rollback

## 5. Đầu mối
- Ai giữ hạ tầng, ai giữ bug/tính năng, người chủ giữ phần gì
```

Tài liệu này nên được viết SONG SONG lúc dựng, không phải viết dồn lúc sắp bàn giao — vì lúc đó người dựng đã quên nhiều chi tiết nhỏ mà người tiếp quản lại cần nhất.

## 📋 Checklist "sẵn sàng bàn giao"
- [ ] Repo chia sẻ được, không khoá vào 1 tài khoản cá nhân duy nhất
- [ ] Có tài liệu: kiến trúc tổng quan, cách chạy local, cách deploy, danh sách biến môi trường cần cấu hình
- [ ] Code không có "mẹo lạ" chỉ người dựng hiểu — đặt tên rõ, cấu trúc quen thuộc với dev bên ngoài dự án
- [ ] Người chủ chỉ cần chạm cổng duyệt go-live, không cần chạy lệnh/sửa cấu hình tay
- [ ] Có luồng PR → review kỹ thuật → duyệt hệ trọng → áp dụng, tách rõ ai làm bước nào
- [ ] Secret/credential nằm ở nơi người tiếp quản truy cập được, không khoá trong máy cá nhân người chủ hoặc trong lịch sử chat AI
- [ ] Đã xác định rõ: hạ tầng do ai giữ, bug/tính năng do ai giữ, người chủ giữ đúng phần cổng duyệt/chiến lược

## ⚠️ Cạm bẫy
- Dựng nhanh cho kịp ra mắt, đặt tài liệu bàn giao là việc "làm sau" — thường không bao giờ có "sau" khi hệ đã chạy ổn, nợ kỹ thuật ở lại vĩnh viễn.
- Để trợ lý AI hoặc người dựng ban đầu là NÚT THẮT duy nhất hiểu hệ thống — một hệ thống "chỉ AI mới đọc hiểu nổi" cũng là dạng nút thắt, không khác gì "chỉ 1 người mới hiểu nổi".
- Đẩy các bước kỹ thuật vụn vặt (chạy lệnh, tra log, sửa cấu hình) về người chủ vì "cần ai đó xác nhận" — âm thầm biến người chủ thành người vận hành hằng ngày, đúng thứ mô hình này muốn tránh.
- Trộn lẫn quy trình bàn giao nội bộ với bàn giao ra ngoài tổ chức — bỏ sót bước rửa dữ liệu/tách quyền khi đối tượng tiếp nhận thực ra là bên ngoài.
- Không tách rõ ai giữ hạ tầng vs ai giữ bug/tính năng — 2 việc dồn về 1 người tiếp quản làm người đó quá tải, quay lại đúng vấn đề ban đầu.

## 🔗 Liên quan
- `08-chuan-tai-lieu.md` — chuẩn tài liệu hệ thống + hướng dẫn trong app, phần bắt buộc của "sẵn sàng bàn giao".
- `22-template-non-tech-3-tang.md` — mẫu chia quyền sửa cho người non-tech tự chủ, cùng tinh thần giảm việc tay.
- `25-golive-ra-cua-hau-bypass.md`, `26-robot-tu-va-self-heal.md` — 2 lưới an toàn cụ thể mà 1 hệ "sẵn sàng bàn giao" cần có, để người tiếp quản tin được ranh giới tự động.
