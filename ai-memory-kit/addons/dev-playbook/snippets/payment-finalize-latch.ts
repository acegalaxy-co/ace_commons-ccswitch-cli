// payment-finalize-latch.ts — chốt side-effect khi thanh toán PAID thật,
// idempotent theo latch trạng thái. Generic, không dính cổng cụ thể.
//
// Ý tưởng: route callback của cổng (return/IPN/callback) có thể được gọi
// NHIỀU LẦN. Ta dùng 1 UPDATE-có-điều-kiện làm "latch": chỉ phiên nào thực
// sự chuyển order sang 'paid' mới được chạy side-effect (doanh thu/CRM/email).
// Sổ tiền còn có lớp phòng thủ #2: idempotent theo số đơn.

type Db = {
  // UPDATE ... WHERE payment_status <> 'paid' RETURNING id  → dòng hoặc null
  latchPaid(orderId: string): Promise<{ id: string } | null>;
  // đã có bút toán sale cho đơn này chưa? (ref_type='order' + ref_id + category)
  hasCashEntry(orderId: string, category: 'sale' | 'refund'): Promise<boolean>;
  insertCashEntry(orderId: string, category: 'sale' | 'refund', amount: number): Promise<void>;
  getOrderAmount(orderId: string): Promise<number>;
};

type SideEffects = {
  syncCrm(orderId: string): Promise<void>;      // nên tự-idempotent theo số đơn
  grantPoints(orderId: string): Promise<void>;  // nên tự-idempotent theo số đơn
  sendReceiptEmail(orderId: string): Promise<void>;
};

/**
 * Gọi từ MỌI route callback của cổng. An toàn khi bị gọi lại nhiều lần.
 * Trả về true nếu ĐÂY là lần chốt thật (đã chạy side-effect), false nếu no-op.
 */
export async function finalizePaidOnline(
  db: Db,
  fx: SideEffects,
  orderId: string,
): Promise<boolean> {
  // 1) LATCH: chỉ 1 phiên chuyển được sang 'paid' → chỉ phiên đó đi tiếp.
  const latched = await db.latchPaid(orderId);
  if (!latched) return false; // đã paid trước đó (gọi lại) → no-op

  // 2) Sổ tiền IDEMPOTENT theo số đơn (INSERT không idempotent → tự kiểm).
  if (!(await db.hasCashEntry(orderId, 'sale'))) {
    const amount = await db.getOrderAmount(orderId);
    await db.insertCashEntry(orderId, 'sale', amount);
  }

  // 3) Side-effect còn lại — chốt ĐÚNG lúc paid thật, không phải lúc tạo đơn.
  await fx.syncCrm(orderId);
  await fx.grantPoints(orderId);
  await fx.sendReceiptEmail(orderId);
  return true;
}

/**
 * Huỷ/đảo đơn CÓ ĐIỀU KIỆN: chỉ ghi bút toán đảo nếu ĐÃ từng ghi doanh thu
 * và CHƯA đảo — tránh 'âm khống' khi đơn online chưa-paid bị huỷ.
 */
export async function reverseOnCancel(db: Db, orderId: string): Promise<boolean> {
  const hadSale = await db.hasCashEntry(orderId, 'sale');
  const alreadyRefunded = await db.hasCashEntry(orderId, 'refund');
  if (!hadSale || alreadyRefunded) return false; // không âm khống, không đảo x2

  const amount = await db.getOrderAmount(orderId);
  await db.insertCashEntry(orderId, 'refund', -amount);
  return true;
}
