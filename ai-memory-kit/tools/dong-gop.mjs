#!/usr/bin/env node
// 🔁 ĐÓNG GÓP NGƯỢC — gói CẢI TIẾN phần KHUNG của bạn để gửi maintainer (mình + mọi người cùng học).
//   CHỈ lấy phần KHUNG (engine/docs/templates/PRINCIPLES…), TỰ QUÉT RÒ chặn secret + tên riêng.
//   TUYỆT ĐỐI KHÔNG đụng HANDBOOK.md / Memories/ (dữ liệu RIÊNG của bạn) — không bao giờ gói chúng.
//
// Dùng (chạy trong thư mục bộ nhớ của bạn):
//   node tools/dong-gop.mjs "mô tả đề xuất ngắn" [--block "TênCty,tên-bạn"] [--force]
//
// Tạo thư mục  <thư-mục-bộ-nhớ>-dong-gop-<ngày-giờ>/  gồm:
//   • DE-XUAT.md     — bạn ghi: đề xuất gì, vì sao (template sẵn nếu để trống)
//   • proposal.patch — (nếu có git) đúng phần KHUNG bạn đã đổi so với bản gốc origin/main
//   • files/         — bản sao các file KHUNG đã đổi (để maintainer xem nhanh)
//   • MANIFEST.txt   — danh sách file + kết quả quét rò
// Có git → cũng in hướng dẫn mở Pull Request. Gửi thư mục/zip này cho maintainer; HỌ duyệt + quét rò + merge.
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.env.MEMORY_ROOT || resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const bIdx = args.indexOf('--block');
const blockWords = (bIdx >= 0 && args[bIdx + 1] ? args[bIdx + 1] : '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const desc = args.find((a, i) => !a.startsWith('--') && i !== bIdx + 1) || '';

// KHUNG (chia chung được). KHÔNG có HANDBOOK.md / Memories/ / .obsidian / .state ở đây — đó là dữ liệu riêng.
const FW_FILES = ['PRINCIPLES.md', 'HANDBOOK.template.md', 'README.md', 'CHANGELOG.md', 'HUONG-DAN.html', 'VERSION', 'NANG-CAP.md'];
const FW_DIRS = ['tools', 'docs', 'templates'];
// giữ đồng bộ với memory-doctor.mjs SECRET_RE (cùng nguồn pattern, chỉ khác cú pháp RegExp literal vs chuỗi grep -E)
const SECRET_RE = /sbp_[a-z0-9]{20}|eyJhbGciOiJ[A-Za-z0-9_-]{30}|(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^/\s:]+:[^@\s]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{10,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|[Bb]earer\s+[A-Za-z0-9_.=-]{20,}/;

// Thu thập file KHUNG (đệ quy thư mục) — relative path so với ROOT.
function walk(dir, rel, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, r, out);
    else out.push(r);
  }
}
const fwFiles = [];
for (const f of FW_FILES) if (existsSync(join(ROOT, f))) fwFiles.push(f);
for (const d of FW_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d), d, fwFiles);

// Git: chỉ lấy phần KHUNG ĐÃ ĐỔI so với bản gốc.
const isGit = spawnSync('git', ['-C', ROOT, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).stdout.trim() === 'true';
let changed = null, patch = '';
if (isGit && spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', 'origin/main'], { encoding: 'utf8' }).status === 0) {
  changed = spawnSync('git', ['-C', ROOT, 'diff', '--name-only', 'origin/main', '--', ...FW_DIRS, ...FW_FILES], { encoding: 'utf8' })
    .stdout.split('\n').map(s => s.trim()).filter(Boolean);
  patch = spawnSync('git', ['-C', ROOT, 'diff', 'origin/main', '--', ...FW_DIRS, ...FW_FILES], { encoding: 'utf8' }).stdout;
}

// Tập file SẼ GÓI: nếu git biết file đổi → chỉ chúng; nếu không → toàn bộ KHUNG (maintainer tự so).
const include = changed && changed.length ? changed.filter(f => fwFiles.includes(f)) : fwFiles;
if (changed && !include.length) {
  console.log('ℹ️  Không thấy bạn đổi gì ở phần KHUNG so với bản gốc (origin/main) → chưa có gì để góp.');
  process.exit(0);
}

// QUÉT RÒ những file sẽ gói.
const secretHits = [], wordHits = [];
for (const f of include) {
  let txt = ''; try { txt = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
  if (SECRET_RE.test(txt)) secretHits.push(f);
  const low = txt.toLowerCase();
  for (const w of blockWords) if (low.includes(w)) { wordHits.push(`${f} ← "${w}"`); break; }
}
if (secretHits.length && !force) {
  console.error('🔴 DỪNG — phát hiện SECRET TRẦN trong file định gói (đừng gửi đi):');
  for (const f of secretHits) console.error('   • ' + f);
  console.error('Chuyển secret ra két riêng + tham chiếu, rồi chạy lại. (Nếu chắc chắn an toàn: thêm --force.)');
  process.exit(1);
}

// Tạo gói (sibling của thư mục bộ nhớ — ngoài cây, không lẫn vào tủ).
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const OUT = `${ROOT}-dong-gop-${stamp}`;
mkdirSync(join(OUT, 'files'), { recursive: true });
for (const f of include) { mkdirSync(join(OUT, 'files', dirname(f)), { recursive: true }); cpSync(join(ROOT, f), join(OUT, 'files', f)); }
if (patch) writeFileSync(join(OUT, 'proposal.patch'), patch, 'utf8');

const deXuat = desc
  ? `# Đề xuất đóng góp\n\n${desc}\n\n## Gồm gì\n${include.map(f => `- ${f}`).join('\n')}\n`
  : `# Đề xuất đóng góp\n\n> Điền giúp maintainer hiểu nhanh:\n\n**Đề xuất gì:** \n\n**Vì sao tốt / đã thử ở đâu:** \n\n**Có rủi ro/lưu ý gì:** \n\n## File KHUNG đã đổi\n${include.map(f => `- ${f}`).join('\n')}\n`;
writeFileSync(join(OUT, 'DE-XUAT.md'), deXuat, 'utf8');

const manifest = [
  `Gói đóng góp ngược — ${stamp}`,
  `Nguồn: ${ROOT}  ·  bản VERSION: ${(() => { try { return readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(); } catch { return '?'; } })()}`,
  `Chế độ: ${changed ? 'git diff vs origin/main (chỉ file đã đổi)' : 'snapshot toàn bộ KHUNG (không có git — maintainer tự so)'}`,
  '', 'File gói (CHỈ phần KHUNG — KHÔNG có HANDBOOK.md/Memories/):',
  ...include.map(f => '  ' + f),
  '', 'Quét rò:',
  `  secret: ${secretHits.length ? '⚠️ ' + secretHits.join(', ') + (force ? ' (bỏ qua do --force)' : '') : '✅ sạch'}`,
  `  tên-chặn (${blockWords.join(',') || 'không khai'}): ${wordHits.length ? '⚠️ ' + wordHits.join('; ') : '✅ sạch'}`,
].join('\n') + '\n';
writeFileSync(join(OUT, 'MANIFEST.txt'), manifest, 'utf8');

// Thử nén nếu có lệnh zip (không bắt buộc).
let zipPath = '';
if (spawnSync('sh', ['-c', 'command -v zip'], { encoding: 'utf8' }).stdout.trim()) {
  const z = `${OUT}.zip`;
  if (spawnSync('zip', ['-r', '-X', '-q', z, basename(OUT)], { cwd: dirname(OUT) }).status === 0) zipPath = z;
}

console.log(`✅ Đã tạo gói đóng góp: ${OUT}${zipPath ? `\n   (kèm zip: ${zipPath})` : ''}`);
console.log(`   • ${include.length} file KHUNG${changed ? ' (đã đổi)' : ''} · DE-XUAT.md · MANIFEST.txt${patch ? ' · proposal.patch' : ''}`);
if (wordHits.length) console.log(`   ⚠️ Có chữ trong danh sách chặn — xem MANIFEST.txt, soát lại trước khi gửi.`);
console.log(`🔒 KHÔNG gói: HANDBOOK.md, Memories/, secret, .obsidian, file trạng thái.`);
console.log(`\n👉 GỬI: ${desc ? '' : 'mở DE-XUAT.md điền vài dòng, rồi '}bỏ thư mục/zip trên vào thư mục Google Drive chung "MemoryOS - Đóng góp" (link ở CONTRIBUTING.md). Maintainer DUYỆT + quét rò + merge → ra bản mới cho mọi người nâng cấp.`);
if (isGit) console.log(`   (Hoặc nếu bạn quen git: tạo nhánh + Pull Request lên repo — xem CONTRIBUTING.md.)`);
