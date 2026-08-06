// rate-limit.ts — token-bucket trong RAM, không phụ thuộc thư viện ngoài.
// Dùng cho hệ 1 instance. Scale ngang (nhiều instance) → thay store bằng Redis (xem cuối file).
// Rửa sẵn: không có path/tên dự án/secret. Chỉnh CAPACITY/REFILL theo cổng của bạn.

type Bucket = { tokens: number; last: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private capacity: number;       // số token tối đa (đỉnh cho phép)
  private refillPerSec: number;   // tốc độ hồi token mỗi giây
  private ttlMs: number;          // quên bucket cũ sau ngần này (dọn RAM)
  constructor(capacity = 20, refillPerSec = 1, ttlMs = 10 * 60_000) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.ttlMs = ttlMs;
  }

  /** true = cho qua; false = bị hãm (trả 429). */
  take(key: string, cost = 1): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) { b = { tokens: this.capacity, last: now }; this.buckets.set(key, b); }
    // hồi token theo thời gian trôi qua
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.last) / 1000) * this.refillPerSec);
    b.last = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }

  /** giây nên chờ trước khi thử lại (cho header Retry-After). */
  retryAfter(key: string, cost = 1): number {
    const b = this.buckets.get(key);
    if (!b) return 0;
    const need = cost - b.tokens;
    return need <= 0 ? 0 : Math.ceil(need / this.refillPerSec);
  }

  /** gọi định kỳ (vd mỗi vài phút) để dọn bucket cũ, tránh phình RAM. */
  sweep() {
    const now = Date.now();
    for (const [k, b] of this.buckets) if (now - b.last > this.ttlMs) this.buckets.delete(k);
  }
}

// Lấy IP thật sau proxy/CDN (đừng tin remoteAddress = IP proxy).
export function callerIp(req: { headers: Record<string, any>; socket?: any }): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

// ── Ví dụ dùng (Express) — hãm 2 lớp: IP trước, rồi khoá/định danh ──
//
// const ipLimiter  = new RateLimiter(60, 1);   // 60 req, hồi 1/s theo IP
// const keyLimiter = new RateLimiter(10, 0.2); // chặt hơn theo khoá
// app.post('/api/ingest', (req, res, next) => {
//   const ip = callerIp(req);
//   for (const [name, lim, k] of [['ip', ipLimiter, ip], ['key', keyLimiter, req.header('x-api-key') || ip]] as const) {
//     if (!lim.take(k)) { res.set('Retry-After', String(lim.retryAfter(k))); return res.status(429).json({ error: `rate_limited:${name}` }); }
//   }
//   next();
// });
//
// ── Scale ngang? ──
// RAM-only = mỗi instance một bộ đếm. Nhiều instance → dùng Redis:
// INCR key + EXPIRE (fixed-window) hoặc Lua token-bucket, để mọi instance dùng CHUNG bộ đếm.
