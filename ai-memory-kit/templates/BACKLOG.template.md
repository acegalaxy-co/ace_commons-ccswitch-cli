# _Backlog — việc đang chờ / đang làm (nguồn sự thật điều phối đa-phiên)

> Chỉ cần khi chạy NHIỀU phiên AI song song. Xem luật: `docs/multi-session.md`.
> Mỗi việc 1 dòng. Cập nhật NGAY khi nhận/xong việc, đừng đợi cuối phiên.

| Trạng thái | Việc | Phiên/Nhánh | Repo + vùng-file giữ | Bắt đầu (giờ) | Chặn-bởi | PR | Mảnh nhớ |
|---|---|---|---|---|---|---|---|
| đang-làm | (ví dụ) Thêm màn hình đăng nhập | phiên-A / `feat/login` | app · `src/auth/*` | 2026-01-01 09:00 | — | — | [[auth-design]] |
| chờ | (ví dụ) Nối API thanh toán | — | — | — | chặn-bởi: login | — | [[payment-plan]] |
| done | (ví dụ) Dựng khung dự án | phiên-B / `chore/init` | app · root | 2026-01-01 08:00 | — | #12 | [[project-setup]] |

**Trạng thái dùng:** `chờ` · `đang-làm` · `chặn` · `done`.
**Quy tắc nhanh:** nhận việc = đổi `chờ`→`đang-làm` + điền phiên/nhánh/vùng/giờ TRƯỚC khi code · xong = `done` + PR + cập nhật mảnh nhớ + backlink · WIP tối đa 1 dòng `đang-làm`/phiên · lease quá hạn (vd >3h) coi như phiên chết, được giành lại.
