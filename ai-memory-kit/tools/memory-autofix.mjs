#!/usr/bin/env node
// 🩺⚡ TỰ KHÁM CUỐI LƯỢT — chạy bởi Stop-hook sau mỗi lượt trả lời.
// Gọi memory-doctor --fix (KHÔNG snapshot, cho nhẹ) để lỗi status/mồ côi/index KHÔNG dồn quá 1 lượt.
// - VAN TIẾT LƯU: bỏ qua nếu vừa chạy < 90 giây (tránh chạy dồn khi hỏi liên tục).
// - IM LẶNG khi sạch: chỉ nhắn khi bác sĩ TỰ VÁ được gì, hoặc còn chỗ cần tay.
// - LUÔN exit 0: không bao giờ chặn phiên dừng.
//
// ⚙️ Mốc tiết lưu ở ~/.mem-autofix-stamp. memory-doctor.mjs nằm CÙNG thư mục (tools/).
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STAMP = join(homedir(), '.mem-autofix-stamp');
const THROTTLE_MS = 90_000;

try {
  if (existsSync(STAMP) && Date.now() - statSync(STAMP).mtimeMs < THROTTLE_MS) process.exit(0);
  writeFileSync(STAMP, String(Date.now())); // chấm mốc TRƯỚC khi chạy (tránh chồng lượt)

  const r = spawnSync('node', [join(HERE, 'memory-doctor.mjs'), '--fix', '--no-snapshot'],
    { encoding: 'utf8', timeout: 30_000 });
  const out = (r.stdout || '') + (r.stderr || '');

  const fixedM = out.match(/Bác sĩ TỰ vá (\d+) chỗ/);
  const fixed = fixedM ? Number(fixedM[1]) : 0;
  const leftM = out.match(/Còn (\d+) chỗ cần xử/);
  const left = leftM ? Number(leftM[1]) : 0;

  if (fixed > 0 || left > 0) {
    const parts = [];
    if (fixed > 0) parts.push(`tự vá ${fixed} chỗ (status/mồ côi)`);
    if (left > 0) parts.push(`còn ${left} chỗ cần tay (vd link gãy) — gõ "đọc bộ nhớ" để xem chi tiết`);
    const msg = `🩺 Bác sĩ bộ nhớ (cuối lượt): ${parts.join(' · ')}.`;
    process.stdout.write(JSON.stringify({ systemMessage: msg }));
  }
} catch { /* không bao giờ làm hỏng việc dừng phiên */ }
process.exit(0);
