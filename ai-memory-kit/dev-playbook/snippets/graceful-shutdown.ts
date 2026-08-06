// graceful-shutdown.ts — bắt SIGTERM/SIGINT, đóng server êm, thoát mã 0.
// Rửa sẵn: generic, không tên dự án/secret. Thay <db-pool> bằng pool DB thật của bạn (tuỳ chọn).
//
// ⚠️ ĐIỀU KIỆN BẮT BUỘC: tiến trình node phải là PID 1 — chạy TRỰC TIẾP `node server.js`,
// KHÔNG qua `npm start` (npm → sh → node là các lớp shell trung gian, KHÔNG forward tín hiệu
// xuống node con). Thiếu điều kiện này, handler dưới đây sẽ KHÔNG BAO GIỜ được gọi, và nền
// tảng deploy (PaaS) vẫn báo "crashed" GIẢ mỗi lần swap-deploy dù app chạy khỏe.

import type { Server } from 'http';

type ClosablePool = { end: () => Promise<void> } | null | undefined;

let shuttingDown = false;

export function registerGracefulShutdown(server: Server, pool?: ClosablePool, timeoutMs = 5000) {
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] nhận ${signal} → đóng server êm, thoát mã 0`);

    // Chốt AN TOÀN: đừng để treo quá timeoutMs dù server.close()/pool.end() bị kẹt.
    const forceExit = setTimeout(() => {
      console.warn('[shutdown] quá hạn chờ đóng êm → ép thoát mã 0');
      process.exit(0);
    }, timeoutMs);
    forceExit.unref();

    server.close(async () => {
      try {
        await pool?.end(); // <db-pool>: bỏ qua nếu app không giữ pool DB riêng
      } catch (e) {
        console.error('[shutdown] lỗi khi đóng pool DB (bỏ qua, vẫn thoát sạch):', e);
      }
      clearTimeout(forceExit);
      process.exit(0); // thoát mã 0 = "dừng có chủ đích", KHÔNG phải "crashed"
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Lưới an toàn: lỗi async lạc ghi log, KHÔNG để sập tiến trình vì lỗi vặt.
  process.on('unhandledRejection', (e: any) => console.error('[unhandledRejection]', e?.message || e));
  process.on('uncaughtException', (e: any) => console.error('[uncaughtException]', e?.stack || e));
}

// ── Cách dùng ──
// const server = app.listen(port, () => console.log(`listening on ${port}`));
// registerGracefulShutdown(server /*, dbPool */);
//
// ── Kèm cấu hình PaaS (nếu builder tự chọn "npm start") ──
// Ép start-command chạy node trực tiếp, vd railway.json:
// { "deploy": { "startCommand": "node server.js" } }
