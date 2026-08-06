#!/usr/bin/env node
// 🩺 BÁC SĨ BỘ NHỚ — khám sức khoẻ tủ bộ nhớ + tự chụp lịch sử ra GIT (ngoài cây bộ nhớ) + tự in 2 bảng.
// Chạy ĐẦU MỖI PHIÊN (khi "đọc bộ nhớ"). Bắt bệnh CƠ HỌC (①–④) + NGHĨA/liên kết (⑥) + giữ lịch sử (⑤)
//   + làm tươi BẢNG TIẾN ĐỘ (⑦) và SỔ NĂNG LỰC (⑧) + canh LUẬT TRẦN chống phình (⑨, cảnh báo 🟡 không chặn).
//   TỰ VÁ status/mồ côi/index khi --fix.
//   node memory-doctor.mjs                → khám + chụp lịch sử (KHÔNG tự sửa)
//   node memory-doctor.mjs --fix          → khám + TỰ VÁ status/mồ côi/index + chụp lịch sử
//   node memory-doctor.mjs --no-snapshot  → khám, bỏ qua chụp lịch sử
// Thoát mã 1 nếu còn bệnh chưa lành.
//
// ⚙️ CONFIG (đặt biến môi trường nếu muốn đổi mặc định):
//    MEMORY_ROOT        — thư mục bộ nhớ (mặc định = cha của tools/)
//    MEMORY_BACKUP_DIR  — nơi backup FIFO (mặc định ~/MemoryBackups)
//    MEMORY_GIT_MIRROR  — git mirror lịch sử, NGOÀI cây bộ nhớ (mặc định ~/MemoryGitMirror)
//    MEMORY_MIN_FILES   — sàn an toàn: tủ ít hơn số này thì KHÔNG mirror (nghi mất data; mặc định 10)
//    MEMORY_MAX_WORDS_PIECE — trần số từ 1 mảnh trước khi nhắc xé (mặc định 6000)
//    MEMORY_MAX_WORDS_INDEX — trần số từ 1 INDEX nhóm trước khi nhắc tách sub-INDEX (mặc định 3000)
//    MEMORY_MAX_PIECES_GROUP — trần số mảnh / 1 nhóm trước khi nhắc dựng sub-INDEX 2 cấp (mặc định 60)
//    MEMORY_MAX_TOKENS_TIER0 — trần token ước-lượng (byte/4) cho HANDBOOK.md + Memories/MEMORY.md (mặc định 12000)

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildBlock, processDir, MEM, ROOT, START, END } from './build-index.mjs';
import { refreshTienDo } from './tien-do.mjs';
import { refreshSoNangLuc } from './so-nang-luc.mjs';

const FIX = process.argv.includes('--fix');
const SNAP = !process.argv.includes('--no-snapshot');
const VOCAB = ['live', 'wip', 'blocked', 'plan', 'research', 'maintain', 'done', 'reference', 'archived'];
const MIN_FILES = Number(process.env.MEMORY_MIN_FILES) || 10;
const MAX_W_PIECE = Number(process.env.MEMORY_MAX_WORDS_PIECE) || 6000;   // trần ~1 mảnh
const MAX_W_INDEX = Number(process.env.MEMORY_MAX_WORDS_INDEX) || 3000;   // trần ~1 INDEX nhóm
const MAX_PIECES_GROUP = Number(process.env.MEMORY_MAX_PIECES_GROUP) || 60; // trần số mảnh / nhóm
const MAX_TOKENS_TIER0 = Number(process.env.MEMORY_MAX_TOKENS_TIER0) || 12000; // trần token ước-lượng Tầng-0 (HANDBOOK.md + MEMORY.md)
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let problems = 0;
let autoFixed = 0; // số chỗ bác sĩ TỰ vá lần này (status/mồ côi) — để Stop-hook biết có động tay không
const say = (icon, msg) => console.log(`${icon} ${msg}`);

// File báo cáo MÁY-IN / không-phải-mảnh → bỏ qua kiểm frontmatter (khỏi báo "thiếu" oan).
const SKIP_FM = new Set(['INDEX.md', 'MEMORY.md', 'README.md', 'TIEN-DO.md', 'SO-NANG-LUC.md', '_Backlog.md', 'tien-do.md']);

// ── TIÊM PHÒNG: helper TỰ VÁ an toàn (chỉ chạy khi --fix) ──
// Đoán status mặc định theo LOẠI mảnh (người non-tech → AI tự gán, liếc INDEX sai thì sửa).
function inferStatus(fm) {
  const t = String(fm.type || fm.metadata_type || '').toLowerCase();
  if (t === 'feedback' || t === 'reference' || t === 'user') return 'reference'; // nguyên tắc/kiến thức
  return 'wip'; // dự án/khác → coi như đang làm (an toàn nhất; chưa-go-live = wip)
}
// Ngày sửa file gần nhất (YYYY-MM-DD) làm `updated` mặc định.
function fileDate(path) {
  try { return new Date(statSync(path).mtime).toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}
// Chèn status/updated vào frontmatter (sau description top-level, hoặc name, hoặc ngay sau '---').
function injectFM(text, adds) {
  const lines = text.split('\n');
  const end = lines.indexOf('---', 1);
  if (end < 1) return text; // không có frontmatter chuẩn → không đụng
  let at = 1;
  for (let i = 1; i < end; i++) {
    if (/^description:/.test(lines[i])) { at = i + 1; break; }
    if (/^name:/.test(lines[i]) && at === 1) at = i + 1;
  }
  const ins = [];
  if (adds.status !== undefined) ins.push(`status: ${adds.status}`);
  if (adds.updated !== undefined) ins.push(`updated: ${adds.updated}`);
  lines.splice(at, 0, ...ins);
  return lines.join('\n');
}
// Thêm mảnh mồ côi vào CUỐI INDEX nhóm, gom dưới 1 mục rõ để dễ sắp lại.
const ORPHAN_HEAD = '## 🆕 Mảnh mới (bác sĩ tự thêm — sắp xếp lại khi rảnh)';
function appendOrphan(idxPath, f, fm) {
  const title = String(fm.description || basename(f, '.md')).split('—')[0].split(/\.\s/)[0].slice(0, 80).trim();
  const desc = String(fm.description || '').trim();
  let idx = readFileSync(idxPath, 'utf8');
  const line = `- [${title}](${f})${desc ? ' — ' + desc : ''}`;
  if (idx.includes(ORPHAN_HEAD)) idx = idx.replace(ORPHAN_HEAD, `${ORPHAN_HEAD}\n${line}`);
  else idx = idx.replace(/\s*$/, '') + `\n\n${ORPHAN_HEAD}\n${line}\n`;
  writeFileSync(idxPath, idx, 'utf8');
}
// Gợi ý tên gần đúng cho link gãy (Levenshtein) — KHÔNG tự sửa, chỉ mách để người chọn.
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function suggestName(t, targets) {
  let best = null, bd = 1e9;
  for (const c of targets) { const d = lev(t, c); if (d < bd) { bd = d; best = c; } }
  return best && bd <= Math.max(4, Math.floor(t.length * 0.4)) ? best : null;
}

// Liệt kê file
const groups = readdirSync(MEM).filter(f => statSync(join(MEM, f)).isDirectory());
const allMd = []; // mọi .md trong Memories (đệ quy 1 cấp nhóm)
for (const g of groups) for (const f of readdirSync(join(MEM, g)).filter(x => x.endsWith('.md'))) allMd.push({ g, f, path: join(MEM, g, f) });
for (const f of readdirSync(MEM).filter(x => x.endsWith('.md'))) allMd.push({ g: '', f, path: join(MEM, f) });
const rootMd = readdirSync(ROOT).filter(x => x.endsWith('.md')).map(f => ({ g: '_root', f, path: join(ROOT, f) }));

// Đọc frontmatter thô
function readFM(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const fm = {};
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^\s*([\w]+):\s*(.*)$/);
    if (m && fm[m[1]] === undefined) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return fm;
}

console.log('\n🩺 BÁC SĨ BỘ NHỚ — bắt đầu khám\n');

// ── ⓪ SỨC KHOẺ BACKUP (cờ lỗi bền + tuổi bản auto) — để lỗi backup ÂM THẦM tới được người chủ ──
console.log('⓪ Sức khoẻ backup tự động');
(() => {
  const BK = process.env.MEMORY_BACKUP_DIR || join(homedir(), 'MemoryBackups');
  try {
    const flag = join(BK, 'LAST_FAIL.txt');
    if (existsSync(flag)) { say('  🔴', 'BACKUP TỰ ĐỘNG ĐANG LỖI: ' + readFileSync(flag, 'utf8').trim()); problems++; return; }
    const autos = existsSync(BK) ? readdirSync(BK).filter(d => d.endsWith('_auto')) : [];
    if (!autos.length) { say('  💡', 'Chưa có bản auto nào (job nền chưa chạy lần nào trên máy này).'); return; }
    const newest = Math.max(...autos.map(d => statSync(join(BK, d)).mtimeMs));
    const hrs = (Date.now() - newest) / 3600000;
    if (hrs > 36) say('  🟡', `Bản backup tự động gần nhất ${Math.round(hrs)}h trước (>36h) — kiểm máy backup có chạy không.`);
    else say('  ✅', `Backup tự động gần nhất ${Math.round(hrs)}h trước — ổn.`);
  } catch (e) { say('  ⚠️', 'Không đọc được trạng thái backup: ' + e.message); }
})();

// ── ① Nhãn/frontmatter mảnh (TỰ VÁ status/updated khi --fix) ──
console.log('\n① Nhãn trạng thái mảnh');
let badFm = 0, fixedFm = 0;
for (const { g, f, path } of allMd) {
  if (SKIP_FM.has(f)) continue;
  const raw = readFileSync(path, 'utf8');
  const fm = readFM(raw);
  const rel = `${g}/${f}`;
  if (!fm) { say('  ⚠️', `${rel}: THIẾU frontmatter (cần tay — không có name/description để tự dựng)`); badFm++; continue; }
  const missing = ['name', 'description', 'status', 'updated'].filter(k => !fm[k]);
  const hard = missing.filter(k => k === 'name' || k === 'description'); // không tự bịa được
  // TỰ VÁ: chỉ thiếu status/updated (có name+description rồi) → bác sĩ tự gắn an toàn.
  if (FIX && hard.length === 0 && missing.length) {
    const adds = {};
    if (missing.includes('status')) adds.status = inferStatus(fm);
    if (missing.includes('updated')) adds.updated = fileDate(path);
    writeFileSync(path, injectFM(raw, adds), 'utf8');
    say('  🔧', `${rel}: tự gắn ${Object.entries(adds).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    fixedFm++; autoFixed++;
    continue;
  }
  for (const k of missing) { say('  ⚠️', `${rel}: thiếu \`${k}\``); badFm++; }
  if (fm.status && !VOCAB.includes(fm.status)) { say('  ⚠️', `${rel}: status lạ "${fm.status}" (ngoài từ vựng — cần tay)`); badFm++; }
}
if (fixedFm) say('  🔧', `Đã TỰ gắn nhãn cho ${fixedFm} mảnh (status đoán theo loại + updated = ngày sửa file).`);
if (badFm === 0) say('  ✅', 'Mọi mảnh đủ nhãn + đúng từ vựng.'); else problems += badFm;

// ── ② Mục lục cũ (lệch frontmatter) ──
console.log('\n② Mục lục có cũ không (so với frontmatter)');
let stale = [];
for (const g of groups) {
  const idxPath = join(MEM, g, 'INDEX.md');
  if (!existsSync(idxPath)) continue;
  const idx = readFileSync(idxPath, 'utf8');
  if (!idx.includes(START) || !idx.includes(END)) continue; // nhóm INDEX viết tay → bỏ qua
  const cur = (idx.match(new RegExp(esc(START) + '[\\s\\S]*?' + esc(END))) || [null])[0];
  const want = buildBlock(join(MEM, g)).block;
  if (cur !== want) stale.push(g);
}
if (stale.length === 0) say('  ✅', 'Mọi INDEX khớp frontmatter (không cũ).');
else {
  say('  ⚠️', `INDEX cũ: ${stale.join(', ')}`);
  if (FIX) { for (const g of stale) processDir(join(MEM, g), true); say('  🔧', `Đã VÁ ${stale.length} INDEX (in lại).`); }
  else { problems += stale.length; say('  💡', 'Chạy lại với --fix để tự vá.'); }
}

// ── ③ Link gãy (quét cả Tầng 0 ở thư mục gốc) ──
console.log('\n③ Link gãy');
const targets = new Set();
for (const { f, path } of [...allMd, ...rootMd]) {
  targets.add(basename(f, '.md'));
  const fm = readFM(readFileSync(path, 'utf8'));
  if (fm?.name) targets.add(fm.name);
}
let brokenLinks = 0;
for (const { g, f, path } of [...allMd, ...rootMd]) {
  const text = readFileSync(path, 'utf8');
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const t = m[1].trim();
    if (!t || t.includes('/') || t.includes('.') || t.includes(' ')) continue; // bỏ rỗng/đường dẫn
    if (text[m.index - 1] === '`' && text[m.index + m[0].length] === '`') continue; // ví dụ trong code
    if (!targets.has(t)) {
      const sug = suggestName(t, targets);
      say('  ⚠️', `${g}/${f}: [[${t}]] không trỏ tới mảnh nào${sug ? ` — ý là [[${sug}]]?` : ' (mảnh chưa viết? gỡ link hoặc viết mảnh)'}`);
      brokenLinks++;
    }
  }
  if (f === 'INDEX.md') for (const m of text.matchAll(/\]\(([^)]+\.md)\)/g)) {
    const link = m[1];
    if (link.includes('://')) continue;
    if (!existsSync(join(MEM, g, link))) { say('  ⚠️', `${g}/INDEX.md: link (${link}) không tồn tại`); brokenLinks++; }
  }
}
if (brokenLinks === 0) say('  ✅', 'Không có link gãy.'); else problems += brokenLinks;

// ── ④ File rác / xung đột (bản sao thủ công, conflict copy) ──
console.log('\n④ File rác / xung đột');
let junk = 0;
function scanJunk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) scanJunk(p);
    else if (/ \d\.\w+$/.test(e.name) || /conflict/i.test(e.name)) { say('  ⚠️', `Nghi xung đột (sync): ${p}`); junk++; }
    // Pattern HẸP (không bắt theo chữ "backup" — sẽ nuốt nhầm mảnh/script).
    else if (/(\.bak|\.old|\.orig)([.\-]|$)/i.test(e.name) || /~$/.test(e.name)) { say('  ⚠️', `Bản sao thủ công (git đã giữ lịch sử → nên dọn): ${p}`); junk++; }
  }
}
scanJunk(ROOT);
if (junk === 0) say('  ✅', 'Không có file rác/xung đột.'); else problems += junk;

// ── ⑤ LƯỚI AN TOÀN: chụp lịch sử ra git (NGOÀI cây bộ nhớ) ──
console.log('\n⑤ Lịch sử (git mirror ngoài cây bộ nhớ)');
if (SNAP) {
  const REPO = process.env.MEMORY_GIT_MIRROR || join(homedir(), 'MemoryGitMirror');
  try {
    if (!existsSync(REPO)) mkdirSync(REPO, { recursive: true });
    if (!existsSync(join(REPO, '.git'))) spawnSync('git', ['init', '-q'], { cwd: REPO });
    // HÀNG RÀO SECRET: không mirror nếu cây bộ nhớ còn secret TRẦN.
    // Secret phải nằm ở KÉT RIÊNG (ngoài cây bộ nhớ → backup không hút); trong bộ nhớ chỉ để stub/tham chiếu.
    // ⚙️ Thêm pattern secret riêng của bạn vào SECRET_RE nếu cần; SECRET_SKIP loại file MÔ TẢ pattern.
    const blockedBySecret = (() => {
      const SECRET_RE = "sbp_[a-z0-9]{20}|eyJhbGciOiJ[A-Za-z0-9_-]{30}|postgres(ql)?://[^:/ ]{2,}:[^@ /]{8,}@|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}";
      const SECRET_SKIP = ""; // ⚙️ vd: --exclude='ten-file-chinh-sach.md' cho file MÔ TẢ pattern (khỏi báo nhầm)
      const sec = spawnSync('sh', ['-c', `grep -rlE '${SECRET_RE}' "${ROOT}" --include='*.md' --include='*.json' ${SECRET_SKIP} 2>/dev/null`]);
      const hits = String(sec.stdout).trim();
      if (hits) { say('  🔴', `PHÁT HIỆN SECRET TRẦN → DỪNG mirror (tránh nhân secret ra git). Chuyển giá trị ra két riêng rồi chạy lại. File:\n${hits.split('\n').map(s => '        ' + s).join('\n')}`); return true; }
      return false;
    })();
    if (blockedBySecret) {
      // đã cảnh báo — bỏ mirror lần này
    } else if (Number(String(spawnSync('sh', ['-c', `find "${ROOT}" -name '*.md' | wc -l`]).stdout).trim()) < MIN_FILES) {
      say('  🔴', `Tủ nguồn < ${MIN_FILES} file .md → DỪNG mirror (nghi mất dữ liệu; tránh rsync --delete nhân trạng thái mất file). Đổi MEMORY_MIN_FILES nếu tủ bạn nhỏ.`);
    } else if (existsSync(join(REPO, '.git')) && spawnSync('git', ['fsck', '--connectivity-only'], { cwd: REPO }).status !== 0) {
      say('  🔴', `git mirror (.git) hỏng — fsck lỗi → BỎ chụp lần này. Nên xoá ${REPO} để phiên sau dựng lại sạch.`);
    } else {
      const rs = spawnSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', '.DS_Store', '--exclude', '*.icloud', '--exclude', 'node_modules', ROOT + '/', REPO + '/']);
      if (rs.status !== 0) throw new Error('rsync lỗi: ' + (rs.stderr || ''));
      spawnSync('git', ['add', '-A'], { cwd: REPO });
      const dirty = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO }).status;
      if (dirty === 1) {
        const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const c = spawnSync('git', ['-c', 'user.email=memory@local.invalid', '-c', 'user.name=memory-doctor', 'commit', '-q', '-m', `auto-snapshot ${stamp}`], { cwd: REPO });
        if (c.status === 0) say('  ✅', `Đã chụp lịch sử mới vào ${REPO}`);
        else throw new Error('git commit lỗi: ' + (c.stderr || ''));
      } else say('  ✅', `Không có thay đổi mới — lịch sử đã cập nhật (${REPO}).`);
      const n = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: REPO });
      if (n.status === 0) console.log(`     (tổng ${String(n.stdout).trim()} bản lịch sử · lùi lại: cd ${REPO} && git log)`);
    }
  } catch (e) { say('  ⚠️', 'Chụp lịch sử lỗi: ' + e.message); }
} else say('  ⏭️', 'Bỏ qua chụp lịch sử (--no-snapshot).');

// ── ⑥ Mâu thuẫn NGHĨA & liên kết (đổi tên / mồ côi / mục lục tổng) ──
console.log('\n⑥ Mâu thuẫn nghĩa & liên kết (đổi tên · mồ côi · mục lục tổng)');
let sem = 0;
// ⑥a — name: phải khớp tên file (nguồn gốc back-link gãy âm thầm khi đổi tên)
for (const { g, f, path } of [...allMd, ...rootMd]) {
  if (f === 'INDEX.md' || f === 'MEMORY.md' || f === 'README.md') continue;
  const fm = readFM(readFileSync(path, 'utf8'));
  if (fm?.name && fm.name !== basename(f, '.md')) {
    say('  ⚠️', `${g}/${f}: name "${fm.name}" ≠ tên file "${basename(f, '.md')}" → [[link]] sẽ gãy khi đổi tên (sửa 1 trong 2 cho khớp)`);
    sem++;
  }
}
// ⑥b — con trỏ .md trong MEMORY.md tổng phải trỏ tới mảnh CÓ THẬT
const memTong = join(MEM, 'MEMORY.md');
if (existsSync(memTong)) {
  const txt = readFileSync(memTong, 'utf8');
  for (const m of txt.matchAll(/→\s*`?([\w./-]+\.md)`?/g)) {
    const link = m[1];
    if (link.includes('://') || link.startsWith('../')) continue;
    if (!existsSync(join(MEM, link))) { say('  ⚠️', `MEMORY.md tổng: con trỏ "${link}" → mảnh KHÔNG tồn tại (đổi tên/xoá mà quên sửa mục lục)`); sem++; }
  }
}
// ⑥c — mảnh mồ côi ở nhóm có INDEX viết tay (không marker) → TỰ THÊM khi --fix
for (const g of groups) {
  const idxPath = join(MEM, g, 'INDEX.md');
  if (!existsSync(idxPath)) continue;
  const idx = readFileSync(idxPath, 'utf8');
  if (idx.includes(START)) continue; // nhóm tự sinh → build-index luôn liệt kê đủ
  for (const f of readdirSync(join(MEM, g)).filter(x => x.endsWith('.md') && x !== 'INDEX.md' && !x.startsWith('_'))) {
    if (!idx.includes(f) && !idx.includes(basename(f, '.md'))) {
      if (FIX) {
        const fm = readFM(readFileSync(join(MEM, g, f), 'utf8')) || {};
        appendOrphan(idxPath, f, fm);
        say('  🔧', `${g}/${f}: mảnh mồ côi → ĐÃ tự thêm vào cuối INDEX (mục "🆕 Mảnh mới" — sắp lại khi rảnh).`);
        autoFixed++;
      } else {
        say('  ⚠️', `${g}/${f}: mảnh MỒ CÔI — INDEX nhóm không nhắc tới → chạy --fix để tự thêm (hoặc gắn 2 marker tự sinh)`);
        sem++;
      }
    }
  }
}
if (sem === 0) say('  ✅', 'Tên file khớp name · mục lục tổng không trỏ trật · không mảnh mồ côi.');
else problems += sem;

// ── ⑦ BẢNG TIẾN ĐỘ TOÀN HỆ (TIEN-DO.md) — tự tươi mỗi phiên ──
console.log('\n⑦ Bảng tiến độ (TIEN-DO.md) — tự tươi');
try {
  const t = refreshTienDo(true);
  say('  ✅', `Đã làm tươi TIEN-DO.md — ${t.total} mảnh · ${t.hot} đang nóng.`);
  if (t.clashes) say('  ⚠️', `${t.clashes} vùng code có ≥2 việc song song → COI CHỪNG GIẪM CHÂN (xem TIEN-DO.md).`);
  if (t.noStatus) say('  ⚠️', `${t.noStatus} mảnh THIẾU \`status:\` → chưa lên bảng đúng (gắn status cho đủ).`);
} catch (e) { say('  ⚠️', 'Làm tươi TIEN-DO lỗi: ' + e.message); }

// ── ⑧ SỔ NĂNG LỰC (SO-NANG-LUC.md) — hệ HỌC CHÉO: tự tươi mỗi phiên ──
console.log('\n⑧ Sổ năng lực (SO-NANG-LUC.md) — tự tươi');
try {
  const s = refreshSoNangLuc(true);
  say('  ✅', `Đã làm tươi SO-NANG-LUC.md — ${s.tagged} mảnh có capability · ${s.caps} năng lực${s.tools ? ` · ${s.tools} đồ nghề` : ''}${s.gaps ? ` · ${s.gaps} năng lực chưa có bản` : ''}.`);
} catch (e) { say('  ⚠️', 'Làm tươi SO-NANG-LUC lỗi: ' + e.message); }

// ── ⑨ LUẬT TRẦN chống phình (cảnh báo 🟡 — KHÔNG chặn phiên) ──
// "Hao token mỗi lần hỏi" đến từ NHÓM/MẢNH phình (token-mỗi-lần-tra), KHÔNG từ Tầng-0/MEMORY.md (đã rẻ + cache).
// Phình = nợ kỹ thuật, xé khi rảnh → chỉ NHẮC, không tính vào `problems` (chặn cứng gây nhờn cảnh báo).
console.log('\n⑨ Luật trần chống phình (cảnh báo, không chặn)');
let oversize = 0;
const wordCount = (t) => (t.replace(/^---[\s\S]*?\n---/, '').replace(/```[\s\S]*?```/g, ' ').match(/\S+/g) || []).length;
// ⑨a — mảnh quá dài → xé mảnh con + 1 hub mỏng trỏ 2 chiều
for (const { g, f, path } of allMd) {
  if (SKIP_FM.has(f) || f.startsWith('_idx')) continue; // bỏ báo-cáo-máy-in + sub-INDEX
  const n = wordCount(readFileSync(path, 'utf8'));
  if (n > MAX_W_PIECE) { say('  🟡', `${g}/${f}: ~${n} từ > ${MAX_W_PIECE} → XÉ thành mảnh con + 1 hub mỏng trỏ 2 chiều (ranh theo đề mục/ngữ cảnh, đừng xé vụn).`); oversize++; }
}
// ⑨b — INDEX nhóm quá dài → tách sub-INDEX theo miền
for (const g of groups) {
  const idxPath = join(MEM, g, 'INDEX.md');
  if (!existsSync(idxPath)) continue;
  const n = wordCount(readFileSync(idxPath, 'utf8'));
  if (n > MAX_W_INDEX) { say('  🟡', `${g}/INDEX.md: ~${n} từ > ${MAX_W_INDEX} → tách sub-INDEX theo miền (_idx-<miền>.md), INDEX gốc chỉ trỏ + banner định hướng.`); oversize++; }
}
// ⑨c — nhóm quá nhiều mảnh → dựng sub-INDEX 2 cấp
for (const g of groups) {
  const cnt = readdirSync(join(MEM, g)).filter(x => x.endsWith('.md') && x !== 'INDEX.md' && !x.startsWith('_')).length;
  if (cnt > MAX_PIECES_GROUP) { say('  🟡', `${g}: ${cnt} mảnh > ${MAX_PIECES_GROUP} → dựng sub-INDEX 2 cấp (chia theo miền).`); oversize++; }
}
// ⑨d — TRẦN TẦNG-0: sổ tay (HANDBOOK.md) + mục lục tổng (Memories/MEMORY.md) ước-lượng token (byte/4).
//   Đọc MỌI phiên (nạp bắt buộc) → phình ở đây tốn token MỌI LẦN, khác nợ-kỹ-thuật của mảnh/nhóm lẻ ở trên.
const estTokens = (p) => { try { return Math.round(statSync(p).size / 4); } catch { return 0; } };
for (const p of [join(ROOT, 'HANDBOOK.md'), join(MEM, 'MEMORY.md')]) {
  if (!existsSync(p)) continue; // chưa điền HANDBOOK.md (mới cài kit) → bỏ qua êm
  const tok = estTokens(p);
  if (tok > MAX_TOKENS_TIER0) {
    say('  🟡', `${p.slice(ROOT.length + 1)}: ~${tok} token (ước byte/4) > ${MAX_TOKENS_TIER0} → Tầng-0 đang nặng (nạp MỌI phiên) — cân xé bớt xuống Tầng-1/2 (INDEX nhóm/mảnh riêng).`);
    oversize++;
  }
}
if (oversize === 0) say('  ✅', `Không chỗ nào vượt trần (mảnh ≤${MAX_W_PIECE} từ · INDEX ≤${MAX_W_INDEX} từ · nhóm ≤${MAX_PIECES_GROUP} mảnh · Tầng-0 ≤${MAX_TOKENS_TIER0} token).`);
else say('  💡', `${oversize} chỗ vượt trần — nợ kỹ thuật, XÉ khi rảnh (không chặn). Ngưỡng cân vector/RAG: chỉ khi đã xé sub-INDEX + thêm aliases mà recall đo được vẫn <90%.`);

// ── KẾT LUẬN ──
console.log('\n────────────────');
if (autoFixed) say('🔧', `Bác sĩ TỰ vá ${autoFixed} chỗ lần này (status/mồ côi) — không cần động tay.`);
if (problems === 0) { say('🟢', 'TỦ BỘ NHỚ KHOẺ — không bệnh.'); process.exit(0); }
else { say('🔴', `Còn ${problems} chỗ cần xử${FIX ? ' (đã vá status/mồ côi/index tự được; còn lại — vd link gãy — cần tay)' : ' — chạy --fix để tự vá'}.`); process.exit(1); }
