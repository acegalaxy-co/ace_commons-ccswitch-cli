-- money-guard.sql — khung SQL chống ghi-trùng/double-settle cho Postgres.
-- Nguyên tắc: idempotent (chạy lại không lỗi) · khóa chống-trùng ở tầng DB ·
--             đếm-có-ngưỡng atomic · latch chuyển-trạng-thái chạy-đúng-1-lần.
-- Thay <table>/<col> cho dự án của bạn. Xem thêm: sql-idempotent.sql

BEGIN;  -- cả file 1 giao dịch: 1 lỗi → rollback hết

-- ─────────────────────────────────────────────────────────────
-- 1) PARTIAL-UNIQUE trên bảng SOFT-DELETE
--    Mẹo: WHERE deleted_at IS NULL → xóa-mềm-rồi-insert-lại vẫn idempotent
--    (index chỉ tính các dòng còn sống). WHERE ... NOT NULL để cho phép
--    nhiều dòng thiếu mã (nullable) mà vẫn chặn trùng khi CÓ mã.
-- ─────────────────────────────────────────────────────────────

-- 1 giao dịch thật ↦ 1 bút toán: mã duy nhất tự nhiên (mã chuyển khoản / nonce)
CREATE UNIQUE INDEX IF NOT EXISTS payments_reqid_uidx
  ON public.payments (account_id, client_request_id)
  WHERE client_request_id IS NOT NULL AND deleted_at IS NULL;

-- 1 phiếu thu ↦ 1 bản ghi doanh thu (chống đếm-kép)
CREATE UNIQUE INDEX IF NOT EXISTS revenue_source_uidx
  ON public.revenue_entries (account_id, source_payment_id)
  WHERE deleted_at IS NULL;

-- 1 đơn ↦ 1 bút toán sale (idempotent theo số đơn cho sổ tiền)
CREATE UNIQUE INDEX IF NOT EXISTS cash_tx_sale_uidx
  ON public.cash_transactions (ref_type, ref_id, category)
  WHERE ref_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2) LATCH chuyển-trạng-thái chạy ĐÚNG-1-LẦN
--    Chỉ chuyển khi trạng thái hiện tại KHÁC đích. Trả về dòng ⇒ "mình
--    là người vừa chuyển" ⇒ mới được chạy side-effect. Cổng gọi lại
--    return/IPN nhiều lần → chỉ 1 lần RETURNING có dòng.
-- ─────────────────────────────────────────────────────────────
UPDATE public.orders
   SET payment_status = 'paid',
       paid_at        = now()
 WHERE id = $1
   AND payment_status <> 'paid'   -- terminal là BẤT BIẾN: không ghi lại
RETURNING id;                     -- 0 dòng = đã paid trước đó → BỎ QUA side-effect

-- Biến thể "khóa atomic không cần txn": dùng chính UPDATE làm khóa
UPDATE public.orders
   SET status = 'cancelled'
 WHERE id = $1
   AND status <> 'cancelled'      -- ai chạy trước thắng; 0 dòng = phiên thua
RETURNING id;

-- ─────────────────────────────────────────────────────────────
-- 3) ĐẾM-CÓ-NGƯỠNG ATOMIC (coupon usage / quota / lượt)
--    Tăng và kiểm ngưỡng trong 1 câu. 0 dòng = hết hạn → app ném lỗi,
--    rollback. KHÔNG đọc-rồi-tăng (race vượt limit).
-- ─────────────────────────────────────────────────────────────
UPDATE public.coupons
   SET used_count = used_count + 1
 WHERE id = $1
   AND used_count < usage_limit
RETURNING id, used_count, usage_limit;   -- 0 dòng ⇒ đã hết lượt

-- ─────────────────────────────────────────────────────────────
-- 4) ĐỌC-TÍNH-GHI trong 1 txn với FOR UPDATE (khi client DB hỗ trợ txn)
--    Khóa dòng đơn tới hết giao dịch → 2 phiên không thể cùng đọc-cũ.
-- ─────────────────────────────────────────────────────────────
-- SELECT total, paid_sum FROM public.orders WHERE id = $1 FOR UPDATE;
--   ... tính số cần ghi trong app ...
-- INSERT INTO public.payments (...) VALUES (...);
--   (mã duy nhất đã có UNIQUE ở mục 1 làm backstop)

COMMIT;

-- Sau DDL trên Postgres có PostgREST: reload schema cache
NOTIFY pgrst, 'reload schema';
