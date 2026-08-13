#!/usr/bin/env node
// 🔒 KHOÁ ENGINE — chống 2 phiên CÙNG MÁY chạy đồng thời script --write/--fix đè ghi lẫn nhau.
//   Cơ chế: mkdirSync atomic (thắng-thua rõ ràng trên POSIX) + info.json {pid, ts, host}.
//   Stale (>staleMs không refresh, nghi phiên chết) → phá khoá cũ + chiếm.
//   Hết retry vẫn bị giữ → FAIL-OPEN (WARN + vẫn chạy) — engine regeneration idempotent,
//   kẹt việc tệ hơn hiếm khi conflict ghi (rủi ro chấp nhận được, xem docs/multi-session.md).
//   KHÔNG bảo vệ đa-máy qua Drive sync (Drive không sync lock kịp thời gian thực).
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { hostname } from 'node:os';

const LOCK_DIR = '.khoa-engine.lock';

/** Chiếm khoá ở <root>/.khoa-engine.lock. true = có khoá (hoặc fail-open), luôn cho gọi tiếp. */
export function acquireLock(root, { retries = 5, staleMs = 10 * 60 * 1000 } = {}) {
  const lockPath = join(root, LOCK_DIR);
  const infoPath = join(lockPath, 'info.json');
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      mkdirSync(lockPath);
      writeFileSync(infoPath, JSON.stringify({ pid: process.pid, ts: Date.now(), host: hostname() }), 'utf8');
      const bye = (sig) => { releaseLock(root); process.exit(sig === 'SIGINT' ? 130 : 143); };
      process.once('SIGINT', () => bye('SIGINT'));
      process.once('SIGTERM', () => bye('SIGTERM'));
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') return true; // lỗi lạ (vd không quyền) → fail-open, đừng kẹt việc
      let stale = true;
      try {
        const info = JSON.parse(readFileSync(infoPath, 'utf8'));
        stale = !info.ts || (Date.now() - info.ts) > staleMs;
      } catch { /* info hỏng/thiếu → coi stale */ }
      if (stale) {
        try { rmSync(lockPath, { recursive: true, force: true }); } catch { /* thua race, thử lại vòng sau */ }
        continue;
      }
      if (attempt < retries) { try { execSync('sleep 1'); } catch { /* ignore */ } }
    }
  }
  process.stderr.write('⚠️ vault đang bị phiên khác khoá — vẫn chạy tiếp (fail-open)\n');
  return true;
}

/** Nhả khoá — best-effort, im lặng khi lỗi (vd đã bị phiên khác phá do stale). */
export function releaseLock(root) {
  try { rmSync(join(root, LOCK_DIR), { recursive: true, force: true }); } catch { /* ignore */ }
}

export { LOCK_DIR };
