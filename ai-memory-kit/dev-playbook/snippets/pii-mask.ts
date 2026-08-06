// pii-mask.ts — che PII để hiển thị ở admin. Hàm THUẦN, không phụ thuộc gì,
// dễ test riêng. Giữ đầu + cuối (+ domain với email) để vẫn đối chiếu được;
// data THẬT vẫn nằm trong DB — chỉ giá-trị-TRẢ-RA bị che.
//
// ⚠️ Tìm kiếm phải chạy server-side trên data THẬT, KHÔNG trên chuỗi đã mask.
// ⚠️ Audit ghi reveal chỉ để tên field (['phone','email']), KHÔNG để giá trị.

const BULLET = '•';

/**
 * maskPhone('0901234567') -> '090•••••67'
 * Giữ 3 đầu + 2 cuối; phần giữa thay bằng bullet. Số quá ngắn → che sạch.
 */
export function maskPhone(phone?: string | null): string {
  const s = (phone ?? '').replace(/\s+/g, '');
  if (!s) return '';
  if (s.length <= 5) return BULLET.repeat(s.length);
  const head = s.slice(0, 3);
  const tail = s.slice(-2);
  return head + BULLET.repeat(s.length - 5) + tail;
}

/**
 * maskEmail('duy@example.com') -> 'd•••y@example.com'
 * Giữ ký tự đầu + cuối của local-part + nguyên domain (để vẫn đối chiếu nhà cung cấp).
 * Local-part 1 ký tự → che 1 bullet, giữ domain.
 */
export function maskEmail(email?: string | null): string {
  const s = (email ?? '').trim();
  const at = s.lastIndexOf('@');
  if (at <= 0) return s ? BULLET.repeat(s.length) : '';
  const local = s.slice(0, at);
  const domain = s.slice(at); // gồm '@'
  if (local.length <= 2) {
    return local[0] + BULLET.repeat(Math.max(1, local.length - 1)) + domain;
  }
  return local[0] + BULLET.repeat(local.length - 2) + local.slice(-1) + domain;
}

/** last4 lưu plaintext để hiển thị CHE mà KHÔNG cần giải mã số đã mã hóa at-rest. */
export function last4(value?: string | null): string {
  const s = (value ?? '').replace(/\s+/g, '');
  return s.slice(-4);
}
