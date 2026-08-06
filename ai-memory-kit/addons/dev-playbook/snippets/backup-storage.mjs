// backup-storage.mjs — mirror FILE trong object-storage (bucket) ra bản sao thứ 2.
// Generic, đã rửa: không tên dự án/secret. Backup-DB KHÔNG cứu file → cần job này.
//
// Chạy:  node backup-storage.mjs [--dry]
// Cần env (đặt ở két/.env, KHÔNG hardcode):
//   STORAGE_URL                – URL object-storage
//   STORAGE_SERVICE_KEY        – key quyền cao (đọc hết bucket; KHÔNG để lộ client)
//   STORAGE_BUCKET             – tên bucket cần backup
//   BACKUP_DIR                 – thư mục đích (NGOÀI repo/Git; ổ ngoài/cloud khác cho 3-2-1)
//   ALERT_WEBHOOK (tuỳ)        – nơi bắn cảnh báo best-effort khi lỗi
//
// Ý tưởng: liệt kê ĐỆ QUY (prefix + phân trang) → mirror TĂNG DẦN (đã có + đúng cỡ = bỏ qua) → manifest đối soát.

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const URL = process.env.STORAGE_URL;
const KEY = process.env.STORAGE_SERVICE_KEY;
const BUCKET = process.env.STORAGE_BUCKET;
const BACKUP_DIR = process.env.BACKUP_DIR;
const ALERT = process.env.ALERT_WEBHOOK;

// Chặn cứng: KHÔNG cho backup nằm trong repo/Git (nhất là file nhạy cảm/PII).
async function assertSafeDir(dir) {
  const abs = path.resolve(dir);
  let p = abs;
  while (p !== path.dirname(p)) {
    try { await fs.access(path.join(p, '.git')); throw new Error(`BACKUP_DIR nằm trong Git repo (${p}) — chọn ổ ngoài/cloud khác.`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    p = path.dirname(p);
  }
}

// Cảnh báo best-effort: KHÔNG bao giờ re-throw (đừng làm hỏng job chính).
async function alert(msg) {
  console.error('[backup]', msg);
  if (!ALERT) return;
  try { await fetch(ALERT, { method: 'POST', body: JSON.stringify({ text: `[backup-storage] ${msg}` }) }); }
  catch (e) { console.error('[backup] gửi cảnh báo lỗi (bỏ qua):', e?.message); }
}

// Liệt kê ĐỆ QUY: .list theo prefix + phân trang; entry.id === null = thư mục → đệ quy.
async function listAll(sb, prefix = '') {
  const out = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const e of data) {
      const full = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...await listAll(sb, full));   // thư mục → đệ quy
      else out.push({ path: full, size: e.metadata?.size ?? null });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function main() {
  for (const [k, v] of Object.entries({ STORAGE_URL: URL, STORAGE_SERVICE_KEY: KEY, STORAGE_BUCKET: BUCKET, BACKUP_DIR }))
    if (!v) { await alert(`thiếu env ${k}`); process.exit(1); }

  await assertSafeDir(BACKUP_DIR);
  const sb = createClient(URL, KEY);

  let files;
  try { files = await listAll(sb); }
  catch (e) { await alert(`liệt kê bucket lỗi: ${e?.message}`); process.exit(1); }

  let copied = 0, skipped = 0, failed = 0;
  const manifest = [];

  for (const f of files) {
    const dest = path.join(BACKUP_DIR, f.path);
    try {
      // Mirror TĂNG DẦN: đã có + đúng cỡ → bỏ qua.
      const st = await fs.stat(dest).catch(() => null);
      if (st && f.size != null && st.size === f.size) { skipped++; manifest.push({ ...f, state: 'skip' }); continue; }

      if (!DRY) {
        const { data, error } = await sb.storage.from(BUCKET).download(f.path);
        if (error) throw error;
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, Buffer.from(await data.arrayBuffer()));
      }
      copied++; manifest.push({ ...f, state: DRY ? 'would-copy' : 'copied' });
    } catch (e) {
      failed++; manifest.push({ ...f, state: 'FAIL', error: e?.message });
      console.error('[backup] lỗi file', f.path, e?.message);
    }
  }

  if (!DRY) await fs.writeFile(path.join(BACKUP_DIR, '_manifest.json'),
    JSON.stringify({ ts: Date.now(), bucket: BUCKET, total: files.length, copied, skipped, failed, files: manifest }, null, 2));

  const summary = `bucket=${BUCKET} total=${files.length} copied=${copied} skipped=${skipped} failed=${failed}${DRY ? ' (DRY)' : ''}`;
  console.log('[backup]', summary);
  if (failed > 0) await alert(`có ${failed} file lỗi — ${summary}`);
}

main().catch(async (e) => { await alert(`crash: ${e?.message}`); process.exit(1); });
