# 17 — Toàn vẹn tiền (ghi sổ an toàn + vòng đời thanh toán online)

🎯 **Vấn đề:** app đụng tiền (ví/escrow · hoa hồng/lương · thu chi đơn hàng · coupon/quota) mà ghi sổ hớ hênh thì **2 phiên chạy sát nút = ghi trùng / double-settle**, đơn online bỏ-giữa-chừng vẫn bị tính tiền, cổng gọi callback nhiều lần = **cộng doanh thu nhiều lần**. Không lưới nào bắt hết — cần vừa **khóa đúng chỗ ghi** vừa **chốt side-effect đúng thời điểm**.

Bài này giải quyết gì: gom bộ luật ghi-sổ-tiền chống đua/trùng/double-settle (mục A) và vòng đời thanh toán online chốt-khi-PAID (mục B) thành 1 khung tái dùng cho mọi hệ có tiền.

---

## A. Ghi sổ an toàn — 5 luật (kiểm MỖI đường GHI tiền)

### Luật 1 — Đọc + tính TRONG cùng transaction với `FOR UPDATE`
KHÔNG đọc số dư/trạng thái ngoài txn rồi mới mở txn khác để ghi — cửa sổ ~ms đủ cho 2 phiên **cùng đọc → cùng ghi**.
- **SAI:** đọc đơn + Σ-đã-trả bằng pool thường, ghi ở txn riêng → 2 admin bấm = 2 payment.
- **ĐÚNG:** `SELECT ... FOR UPDATE` trong `BEGIN`, đọc-tính-ghi khép trong 1 giao dịch.

### Luật 2 — Khóa chống-trùng tự nhiên = mã DUY NHẤT
Mỗi giao dịch thật mang 1 mã duy nhất: mã chuyển khoản, `client_request_id`/nonce (app sinh), `idempotency_key` (ledger).
- **UNIQUE ở DB (partial `WHERE ... NOT NULL`) + app-check trong txn.** App-check báo lỗi đẹp; UNIQUE DB là **backstop** chống đua sát nút.
- Bắt buộc nonce ở DTO (đừng để nullable). Client sinh **1 UUID/phiếu**, giữ qua double-click/retry, đổi mã mới sau khi thu thành công.

### Luật 3 — Trạng thái terminal là BẤT BIẾN, chặn ở MỌI đường mutate
Đã chốt (`paid`/`canceled`/`settled`…) thì không ghi thêm — nhưng phải chặn ở **mọi** đường sửa status, không chỉ đường ghi-tiền.
- **Bẫy `willTransition`:** `willTransition = from !== to`; khi `from === to` (đã terminal) mà guard chỉ chạy lúc willTransition → INSERT vẫn chạy. Phải chặn `from terminal` **TRƯỚC** INSERT.
- **Bẫy sắc (đã dính lỗ 🔴 double-settle):** action ghi-tiền chặn đúng khi `from terminal`, NHƯNG một action sửa-trạng-thái RỜI chỉ chặn *set TỚI* terminal mà **không chặn kéo NGƯỢC RA khỏi terminal**. UI/kẻ xấu kéo ca đã đóng về mở → gọi lại action ghi-tiền (giờ `from` không-terminal) → **ghi tiền + nợ 2 lần**.
- **Luật:** dùng `notInArray(status, [terminal])` trong `WHERE` của mọi update status. **UI ẩn nút ≠ server chặn.**

### Luật 4 — Đếm-có-ngưỡng phải ATOMIC
`UPDATE ... SET n = n+1 WHERE n < limit RETURNING ...` — 0 dòng trả về = hết hạn → ném lỗi, rollback.
- KHÔNG đọc-rồi-tăng (đọc `used_count` ngoài txn → race vượt limit).
- Áp: giới hạn dùng coupon, quota, số lượt.

### Luật 5 — Idempotent job/event tạo-tiền
Worker/consumer/relay restart hay chạy lần 2 → dedup theo **khóa nghiệp vụ** (vd 1 gói ↦ 1 vận đơn: check tồn tại trong txn / unique `..._ref`), kẻo gọi **bên ngoài** (hãng vận chuyển / cổng thanh toán) 2 lần = tốn tiền thật.

### Biến thể không-txn (khi client DB không cho `FOR UPDATE`)
Nhiều SDK (client PaaS/REST) không mở transaction được → thay bằng:
- **UNIQUE INDEX backstop + nuốt lỗi 23505 = idempotent.** Pre-check theo key → return phiếu cũ (fast-path); insert KÈM key; `catch (23505)` → load + return phiếu cũ (cùng hình dạng kết quả, bắt cả đua qua-được-pre-check).
- ⚠️ Chỉ báo "duplicated" khi **LOOKUP thấy dòng cũ** — tránh nuốt nhầm 23505 của index khác.
- **Lock atomic không cần txn:** biến `UPDATE ... WHERE status <> 'cancelled' RETURNING id` thành khóa — 0 dòng = phiên thua, thoát an toàn.
- Số chứng từ dùng **SEQUENCE DB** qua RPC (KHÔNG grant vai ẩn danh → chống spam lỗ số) + unique số hóa đơn.

---

## B. Vòng đời thanh toán online (chốt khi PAID, không phải lúc tạo đơn)

### Lỗi kinh điển
Ghi **doanh thu + CRM + tích điểm + email NGAY lúc TẠO đơn** cho MỌI phương thức → đơn **online bỏ-giữa-chừng / fail** vẫn bị tính tiền + điểm + email = **sổ tiền sai**.
(COD / chuyển khoản chốt-lúc-tạo chấp nhận được vì không có bước "trả tiền online".)

### 4 nguyên tắc
1. **Tách thời điểm theo phương thức.** COD/CK → chốt side-effect lúc tạo. **Online → DỜI side-effect sang đúng lúc cổng xác nhận `paid` THẬT** (return/IPN/callback), KHÔNG phải lúc tạo đơn.
2. **Latch chuyển-trạng-thái chạy ĐÚNG-1-LẦN.** Ở route callback dùng `UPDATE ... SET paid WHERE id = ? AND payment_status <> 'paid' RETURNING ...`. CHỈ chạy side-effect khi update TRẢ VỀ 1 dòng (tức vừa thực sự chuyển) → cổng gọi lại return + IPN nhiều lần vẫn chạy 1 lần.
3. **Sổ tiền IDEMPOTENT theo số đơn** (lớp phòng thủ #2, vì `INSERT` thu/chi không idempotent). Trước khi ghi doanh thu, kiểm đã có bút toán `sale` cho đúng đơn chưa (`ref_type='order' + ref_id + category='sale'`) → có thì bỏ qua. (CRM/tích điểm thường đã idempotent theo số đơn — tận dụng.)
4. **Đảo (huỷ đơn) CÓ ĐIỀU KIỆN.** Chỉ ghi bút toán đảo nếu **đã từng ghi doanh thu** (`sale` tồn tại) và **chưa đảo** (`refund` chưa có). Nếu không → đơn online chưa-paid bị huỷ sẽ tạo **bút toán ÂM KHỐNG** làm tụt doanh thu giả.

### Bẫy / lưu ý
- **Trừ kho** nên giữ ở lúc TẠO (giữ chỗ tồn chống bán quá) + huỷ hoàn kho đối xứng — KHÁC với doanh thu. Đừng gộp chung "side-effect".
- Nguồn set `paid` phải **DUY NHẤT** ở route callback. Admin không được có nút sửa `payment_status` tay; nếu có cũng phải đi qua hàm finalize.
- Nếu sổ tiền đã có cột `ref_type/ref_id/category` thì **0 migration**.

---

## Nghiệm thu (KHÔNG test trên live)
- **Mô phỏng ≥5 kịch bản** trên sổ tiền giả (không đụng DB thật): online-paid-gọi-lại-x2 (không nhân đôi) · online bỏ-giữa-chừng + huỷ (= 0, không âm khống) · online paid + huỷ (= 0) · COD + huỷ (= 0) · huỷ-x2 (1 refund).
- Test guard theo **đường BỊ CHẶN**: thiếu field bắt buộc → 400 (chứng minh code chạy tới nơi mà KHÔNG tạo bản ghi); trạng thái terminal → 409; trùng mã → 409; `dryRun` → tính mà không ghi.
- **KHÔNG ghi tiền thật vào DB chung** để test double — không có nút undo sạch. Phủ bằng: test hàm thuần + unique-DB đã tạo (CI migrate thành công) + đường-bị-chặn chạy thật.
- Áp lên DB chung có sẵn data: chạy script kiểm-TRÙNG-TRƯỚC khi tạo unique (có trùng → in nhóm, bỏ qua, không hỏng). Thứ tự: áp DDL trước, merge sau.

## 📋 Checklist
- [ ] Mọi đường ghi tiền đọc-tính-ghi trong 1 txn với `FOR UPDATE` (hoặc backstop UNIQUE + nuốt 23505)
- [ ] Mỗi giao dịch có mã duy nhất + UNIQUE partial DB + app-check
- [ ] Terminal chặn ở MỌI đường mutate status (`notInArray`), không chỉ đường ghi-tiền
- [ ] Đếm-có-ngưỡng dùng `UPDATE ... WHERE n<limit RETURNING`
- [ ] Job/event tạo-tiền dedup theo khóa nghiệp vụ
- [ ] Side-effect online chốt khi `paid` thật qua latch chạy-1-lần
- [ ] Sổ tiền idempotent theo số đơn + đảo có điều kiện
- [ ] Nghiệm thu bằng mô phỏng ≥5 kịch bản, không test trên live

## ⚠️ Cạm bẫy
- Đọc số dư ngoài txn rồi mở txn ghi → race window ~ms đủ để double-settle.
- Guard terminal chỉ chạy khi `from !== to` → bỏ lọt lần bấm thứ 2 ở trạng thái đã chốt.
- Chặn terminal chỉ ở đường ghi-tiền → kéo-ngược-ra-khỏi-terminal mở lại cửa ghi 2 lần.
- Ghi side-effect lúc tạo đơn online → đơn fail vẫn tính tiền + điểm + email.
- Huỷ đơn ghi bút toán đảo vô điều kiện → âm khống khi đơn chưa từng paid.
- Nuốt 23505 bừa (không lookup) → giấu lỗi của index khác.

## 🔗 Liên quan
- `snippets/money-guard.sql` — partial-unique trên bảng soft-delete + latch + đếm-atomic.
- `snippets/payment-finalize-latch.ts` — hàm finalize idempotent theo latch trạng thái.
- `12-audit-log-undo-confirm.md` — nhật ký + hoàn tác quanh thao tác đổi/xóa tiền.
- `11-dam-bao-chat-luong-4-luoi.md` — nhiều lưới chồng nhau, mỗi lưới tự động.
- `snippets/sql-idempotent.sql` — khung SQL chạy-lại-không-lỗi.
