# AI Patterns — mẫu xây TÍNH NĂNG có AI (tái dùng)

> Gói **mẫu thiết kế cho tính năng dùng AI** đúc từ thực chiến (đã rửa sạch danh tính). Khác `dev-playbook/` (hạ tầng/code chung) và khác MemoryOS gốc (trí nhớ của trợ lý AI): đây là **cách XÂY tính năng AI cho sản phẩm** sao cho chính xác dần, an toàn, không "tin mù".

## Mục lục
| # | Mẫu | Dùng khi |
|---|---|---|
| 01 | [Vòng học liên tục (human-in-the-loop)](01-vong-hoc-lien-tuc.md) | Mọi flow AI ĐỀ-XUẤT (định khoản, bóc field, phân loại, gợi ý, duyệt) |
| 02 | [Liên kết luồng — nối màn rời thành quy trình](02-lien-ket-luong.md) | Có nhiều màn/tính năng rời, muốn thành 1 quy trình liền mạch |
| 03 | [Red-team agent — soi bảo mật trước go-live](03-red-team-agent.md) | Sắp mở tính năng có PII / dòng tiền |
| 04 | [Connector MCP phủ trọn nghiệp vụ 1 app](04-connector-mcp-toan-nghiep-vu.md) 🆕 | Muốn team thao tác app qua trợ lý AI (đọc+ghi+tiền), gate bật-dần |
| 05 | [Chọn nơi chạy tự-động-hóa (theo có-gọi-AI-không)](05-noi-chay-tu-dong-hoa.md) 🆕 | Dựng cron/automation, phân vân đặt ở máy nhà / cloud / VPS |
| 06 | [Điểm-cắm thêm kênh tích hợp ngoài (SMS/email/push)](06-diem-cam-tich-hop-ngoai.md) 🆕 | Cần cắm nhiều kênh gửi/tích hợp mà không vỡ luồng nghiệp vụ |
| 07 | [Kiểm soát kết quả sub-agent](07-kiem-soat-ket-qua-agent.md) 🆕 | Điều phối tung nhiều sub-agent song song — giao rõ + theo dõi + nghiệm thu bằng chứng |
| 08 | [Chống tiêm lệnh qua sub-agent](08-chong-tiem-lenh-subagent.md) 🆕 | Sub-agent đọc nguồn ngoài (web/tài liệu/repo lạ) — chặn chỉ thị nhúng trong kết quả |

## 3 nguyên tắc xuyên suốt
1. **Người ở vòng (human-in-the-loop):** AI đề xuất → người duyệt → hệ NHỚ → tự tốt dần → đủ tin mới tự duyệt. Không nhảy thẳng "AI tự quyết".
2. **PII/data khách KHÔNG gộp não chung** giữa các tenant. Học **local mỗi tenant**; chỉ chia sẻ tri thức phi-nhạy-cảm (mapping ngành, từ điển chung).
3. **Kết quả AI = đầu-vào-để-KIỂM, không phải kết luận** (xem PRINCIPLES #34). Đo bằng eval có held-out set, đừng để hệ tự chấm chính nó.

> Quy ước rửa khi đóng góp/bê đi: như `../dev-playbook/README.md`. Đóng góp ngược: `../CONTRIBUTING.md`.
