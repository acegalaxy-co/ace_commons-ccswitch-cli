# 14 — Giám sát job nền / cron: 4 lớp (cron im lặng = rủi ro lớn nhất)

🎯 **Vấn đề:** engine nền/cron **ngừng chạy mà không ai biết** (sai giờ, thiếu secret, treo) → tới lúc phát hiện đã trễ hàng tuần. "Cron im lặng" nguy hơn cron lỗi-có-báo. Cần 4 lớp phòng thủ sâu (không cần bảng mới nếu đọc được bảng task sẵn có).

## 🛡️ Lớp 0 — Chịu lỗi rớt kết nối DB (điều kiện SỐNG trước khi 4 lớp dưới có nghĩa)
Worker nền **poll-độc-lập** (đọc DB qua driver, không phải request/response) khi kết nối chết **FATAL** (pooler ngắt/quá tải, timeout socket…) thì nhiều driver **reject 1 promise NỘI BỘ không gắn với `await` nào trong code của bạn** → Node phát `unhandledRejection` → **mặc định giết luôn tiến trình**. `try/catch` quanh vòng lặp/nhịp tim **KHÔNG cứu được** vì nó chỉ bắt được nhánh CÓ `await`; promise nội bộ của thư viện nằm ngoài tầm với. Nếu worker chết ngay ở đây thì 4 lớp giám sát bên dưới (fail-closed, heartbeat, hàng đợi, alert) **không còn ai chạy để báo** — worker im lặng luôn, đúng loại rủi ro lớn nhất mà bài này muốn chặn.

**Vá — lưới an toàn CẤP TIẾN TRÌNH, CHỈ nuốt đúng lớp lỗi kết-nối:**
```ts
const DB_CONN_ERROR =
  /ECHECKOUTTIMEOUT|ECONNRESET|CONNECTION_CLOSED|CONNECTION_DESTROYED|CONNECTION_ENDED|ETIMEDOUT|EPIPE|57P01|08006|08003|08000/i;

process.on('unhandledRejection', (e: any) => {
  const s = `${e?.code ?? ''} ${e?.message ?? e ?? ''}`;
  if (DB_CONN_ERROR.test(s)) {
    console.error(`[${WORKER_ID}] ⚠️ rớt kết nối DB (nuốt, thử lại vòng sau): ${e?.message ?? e}`);
    return;                          // pool tự tái lập, vòng poll sau đọc lại từ DB
  }
  console.error(`[${WORKER_ID}] 💥 unhandledRejection LẠ (thoát để watchdog restart):`, e);
  process.exit(1);                   // ĐỪNG nuốt lỗi lạ → che mất bug thật
});
```
- **Chỉ an toàn khi worker KHÔNG giữ state trong RAM** — mỗi vòng poll là 1 giao dịch độc lập; rớt giữa chừng thì vòng sau đọc lại từ DB làm y hệt. Worker có state/giữ-lock giữa các vòng thì cân nhắc thêm trước khi áp nguyên bản.
- **KHÔNG thay cho watchdog/KeepAlive** — đây là lớp "sống sót lỗi tạm"; lỗi LẠ (không khớp regex) vẫn cho nổ để watchdog/launchd/pm2 restart tiến trình, và Lớp 4 (Alert) bên dưới có cơ hội báo ra ngoài.

## ✅ Cách làm — 4 lớp

### Lớp 1 — Fail-closed (endpoint cron phải có secret)
```ts
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  const allowOpen = process.env.ALLOW_OPEN_CRON === '1'; // chỉ test local
  if (!allowOpen && secret !== process.env.CRON_SECRET) return new Response('Forbidden', { status: 503 });
  // ... logic job
}
```
Thiếu `CRON_SECRET` → 503, KHÔNG bao giờ mở toang cho public.

### Lớp 2 — Heartbeat (cho uptime monitor ngoài cắm vào)
```ts
export async function GET() {                       // GET /api/cron/status
  const cutoff = new Date(Date.now() - 30*60*1000); // overdue 30'
  const [failed, overdue] = await Promise.all([
    db.select({ c: count() }).from(jobs).where(eq(jobs.status, 'failed')),
    db.select({ c: count(), oldest: min(jobs.scheduledAt) })
      .from(jobs).where(and(eq(jobs.status,'pending'), lt(jobs.scheduledAt, cutoff))),
  ]);
  return Response.json({                            // KHÔNG trả PII — chỉ số tổng hợp
    ok: failed[0].c === 0 && overdue[0].c === 0,
    failedCount: failed[0].c, overdueCount: overdue[0].c,
    oldestOverdueMin: overdue[0].oldest ? Math.round((Date.now()-+new Date(overdue[0].oldest))/60000) : 0,
  });
}
```
`oldestOverdueMin` cứ tăng = engine đã NGỪNG hẳn (khác lỗi đơn lẻ). Cắm URL này vào uptime monitor ngoài (UptimeRobot, cron-job.org…) poll mỗi 5–15'.

### Lớp 3 — Hàng đợi ngoại lệ (UI cho người xử)
Trang quản trị liệt kê job `status='failed'` + số `overdue` (từ bảng task sẵn có — không cần bảng mới); cho retry/dismiss.

### Lớp 4 — Alert best-effort (KHÔNG được làm hỏng job chính)
```ts
async function sendOpsAlert(msg: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.OPS_ALERT_CHAT_ID;
    if (!token || !chat) { console.warn('[alert] thiếu env, bỏ qua'); return; }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`,
      { method:'POST', body: JSON.stringify({ chat_id: chat, text: msg }) });
  } catch (e) { console.error('[alert] gửi lỗi', e); }   // TUYỆT ĐỐI không re-throw
}
```

> **Nâng cấp sau (cần schema):** bảng `job_runs(id, job_name, started_at, finished_at, stats jsonb, ok bool)` lưu lịch sử mỗi lần chạy — bền hơn suy từ bảng task.

## 📋 Checklist
- [ ] Worker poll-độc-lập có lưới `unhandledRejection` CHỈ nuốt lỗi kết-nối-DB (regex mã lỗi), lỗi lạ vẫn thoát để watchdog restart
- [ ] Endpoint cron fail-closed (thiếu secret = 503)
- [ ] Có `/status` heartbeat (chỉ số tổng hợp, không PII) cắm vào monitor ngoài
- [ ] Có chỗ xem job lỗi/quá hạn + retry
- [ ] Alert bọc try/catch không re-throw, thiếu env thì chỉ log

## ⚠️ Cạm bẫy
- Nuốt TẤT CẢ `unhandledRejection` (không lọc regex mã lỗi) → che mất bug thật, worker lỗi logic vẫn "sống" giả.
- Cron mở (không secret) → ai cũng kích được. Luôn fail-closed.
- Alert throw khi gửi lỗi → kéo sập luôn job chính. Best-effort.
- Heartbeat trả PII/chi tiết → rò dữ liệu. Chỉ số tổng hợp.

> Áp: mọi dự án có cron/worker nền. Rửa: tên dự án, đường dẫn route, tên bảng prefix, kênh alert nội bộ, tên biến `WORKER_ID`.
