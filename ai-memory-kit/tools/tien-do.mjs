#!/usr/bin/env node
// "MÁY IN" TIẾN ĐỘ TOÀN HỆ — gom `status:`/`updated:`/`area:` của MỌI mảnh thành 1 bảng.
// Triết lý SSOT (như build-index.mjs): trạng thái CHỈ sống ở frontmatter mảnh; bảng này TỰ IN lại.
// Dùng:  node tien-do.mjs            → in ra màn hình (xem nhanh)
//        node tien-do.mjs --write    → ghi Memories/TIEN-DO.md (1 chỗ liếc toàn cảnh)
// Cũng EXPORT refreshTienDo() để memory-doctor.mjs gọi (tự tươi mỗi phiên — không cần nhớ chạy).
//
// 🟡 Mảnh wip/blocked mà THÂN có dấu hiệu đã-xong (✅/"đã xong"/"merged") được gắn cờ "nghi xong chưa
//   bump" ngay trên dòng — cùng heuristic với tools/doi-soat.mjs (đối soát status↔git đầy đủ hơn).
//
// ⚙️ ROOT = thư mục bộ nhớ (chứa Memories/). Mặc định = thư mục CHA của tools/.
//    Đặt MEMORY_ROOT để trỏ chỗ khác nếu muốn.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ngheXongChuaBump } from './doi-soat.mjs';
import { acquireLock, releaseLock } from './khoa-vault.mjs';

const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const MEM = join(ROOT, 'Memories');
const START = '<!-- TỰ SINH: node tien-do.mjs --write -->';
const END = '<!-- HẾT TỰ SINH -->';
const STALE_DAYS = 3; // mảnh wip/blocked không đụng quá ngần này → gắn cờ ⚠️
const ACTIVE = ['blocked', 'wip', 'live']; // trạng thái "đang nóng" — đưa lên đầu
const ICON = { blocked: '🔴', wip: '🟡', live: '🟢', plan: '📐', research: '🔬', maintain: '🧰', done: '✅', reference: '📚', archived: '🗄️', _unknown: '•' };

function parse(txt, file) {
  txt = txt.replace(/\r\n/g, '\n'); // CRLF-tolerant: \r sót lại làm gãy '\n---' exact-match + regex $ cuối dòng
  const fm = {};
  if (txt.startsWith('---')) {
    const end = txt.indexOf('\n---', 3);
    const body = end > 0 ? txt.slice(3, end) : '';
    for (const l of body.split('\n')) {
      const m = l.match(/^\s*(name|description|status|updated|area):\s*(.*)$/);
      if (m) fm[m[1]] = m[2].trim();
    }
  }
  return {
    name: (fm.name || basename(file, '.md')).trim(),
    desc: (fm.description || '').replace(/\s+/g, ' ').trim(),
    status: (fm.status || '_unknown').trim(),
    updated: (fm.updated || '').trim(),
    area: (fm.area || '').trim(), // vùng code đang đụng (chống giẫm chân đa-phiên)
    suspectDone: ngheXongChuaBump(stripFrontmatter(txt)), // 🟡 nghi xong chưa bump (thân có ✅/đã xong/merged)
  };
}
// Thân mảnh (bỏ khối frontmatter) — dùng cho heuristic "nghi xong chưa bump".
function stripFrontmatter(txt) {
  if (!txt.startsWith('---')) return txt;
  const end = txt.indexOf('\n---', 3);
  return end > 0 ? txt.slice(end + 4) : txt;
}

function daysSince(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return Math.floor((Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 86400000);
}

/** Quét mọi nhóm + mảnh → dữ liệu thô. */
export function scanAll() {
  const groups = {};
  for (const g of readdirSync(MEM)) {
    let isDir = false;
    try { isDir = statSync(join(MEM, g)).isDirectory(); } catch { /* skip */ }
    if (!isDir) continue;
    const dir = join(MEM, g);
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !/^index\.md$/i.test(f));
    groups[g] = files.map((f) => ({ g, file: f, ...parse(readFileSync(join(dir, f), 'utf8'), f) }));
  }
  return groups;
}

/** Dựng nội dung TIEN-DO.md + thống kê. */
export function buildTienDo() {
  const groups = scanAll();
  const all = Object.values(groups).flat();

  const rank = (s) => { const i = ACTIVE.indexOf(s); return i < 0 ? 99 : i; };
  const hot = all
    .filter((it) => ACTIVE.includes(it.status))
    .sort((a, b) => rank(a.status) - rank(b.status) || (b.updated || '').localeCompare(a.updated || ''));

  // Coi chừng giẫm chân: 2+ mảnh ĐANG NÓNG cùng `area:`.
  const byArea = {};
  for (const it of hot) if (it.area) (byArea[it.area] ||= []).push(it);
  const clashes = Object.entries(byArea).filter(([, list]) => list.length >= 2);

  // Mảnh thiếu status (không lên bảng đúng → cần gắn).
  const noStatus = all.filter((it) => it.status === '_unknown');

  // 🟡 Nghi xong chưa bump: status wip/blocked nhưng thân có dấu hiệu đã-xong (cùng heuristic doi-soat.mjs).
  const suspectDone = hot.filter((it) => (it.status === 'wip' || it.status === 'blocked') && it.suspectDone);

  let backlogOpen = '?';
  try {
    const bl = readFileSync(join(MEM, '_Backlog.md'), 'utf8');
    backlogOpen = String((bl.match(/^\s*-\s+(?!.*✅)/gm) || []).length);
  } catch { /* không có */ }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const L = [];
  L.push('# 📊 TIẾN ĐỘ TOÀN HỆ — tự in', '');
  L.push(`> Liếc 1 chỗ: việc nào ĐANG làm hay BỊ CHẶN · mảnh để LÂU · 2 phiên có GIẪM CHÂN không. Tự gom từ frontmatter mọi mảnh.`);
  L.push(`> ĐỪNG sửa tay phần dưới (giữa 2 marker) — \`node tools/tien-do.mjs --write\` (hoặc memory-doctor đầu phiên) sẽ làm tươi.`, '');
  L.push(START);
  L.push(`<!-- in lúc ${stamp} · ${all.length} mảnh · stale = wip/blocked > ${STALE_DAYS} ngày chưa đụng -->`, '');

  if (clashes.length) {
    L.push(`## ⚠️ COI CHỪNG GIẪM CHÂN (${clashes.length} vùng có ≥2 việc đang chạy)`);
    for (const [area, list] of clashes) {
      L.push(`- **\`${area}\`** ← ${list.map((it) => `${it.name} (${it.g}, ${it.updated || '?'})`).join('  ·  ')}`);
    }
    L.push('');
  }

  L.push(`## 🔥 ĐANG LÀM / BỊ CHẶN (${hot.length})`);
  if (!hot.length) L.push('_(không có mảnh wip/blocked/live)_');
  for (const it of hot) {
    const ds = daysSince(it.updated);
    const stale = ds != null && ds > STALE_DAYS ? `  ⚠️ ${ds}d chưa đụng` : '';
    const ar = it.area ? `  〔${it.area}〕` : '';
    const bump = (it.status === 'wip' || it.status === 'blocked') && it.suspectDone ? '  🟡 nghi xong chưa bump' : '';
    const d = it.desc.length > 90 ? it.desc.slice(0, 90) + '…' : it.desc;
    L.push(`- ${ICON[it.status] || '•'} \`${it.g}\` **${it.name}** — ${d}  · *${it.updated || '?'}*${ar}${stale}${bump}`);
  }

  if (suspectDone.length) {
    L.push('', `## 🟡 NGHI XONG CHƯA BUMP (${suspectDone.length}) — status wip/blocked mà thân có ✅/"đã xong"/"merged"`);
    L.push('> Kiểm tay rồi bump status (đối soát sâu hơn theo git: \`node tools/doi-soat.mjs\`).');
    for (const it of suspectDone) L.push(`- \`${it.g}\` **${it.name}** (${it.status}) · *${it.updated || '?'}*`);
  }

  L.push('', `## 📁 THEO DỰ ÁN (số mảnh theo trạng thái)`);
  for (const g of Object.keys(groups).sort()) {
    const items = groups[g];
    if (!items.length) continue;
    const c = {};
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
    const order = [...ACTIVE, 'plan', 'research', 'maintain', 'reference', 'done', 'archived', '_unknown'];
    const cstr = order.filter((k) => c[k]).map((k) => `${ICON[k] || ''}${c[k]} ${k}`).join(' · ');
    L.push(`- **${g}** (${items.length}): ${cstr}`);
  }

  if (noStatus.length) {
    L.push('', `## 🩹 THIẾU \`status:\` — cần gắn (${noStatus.length}) → bảng mới đủ`);
    for (const it of noStatus) L.push(`- \`${it.g}/${it.file}\``);
  }

  L.push('', `## 📋 Backlog: ~${backlogOpen} mục mở (chi tiết: \`Memories/_Backlog.md\`)`);
  L.push('', END);
  return {
    content: L.join('\n') + '\n',
    stats: { total: all.length, hot: hot.length, clashes: clashes.length, noStatus: noStatus.length, suspectDone: suspectDone.length },
  };
}

/** Làm tươi TIEN-DO.md (memory-doctor gọi cái này). Trả thống kê để in cảnh báo. */
export function refreshTienDo(write = true) {
  const { content, stats } = buildTienDo();
  if (write) writeFileSync(join(MEM, 'TIEN-DO.md'), content, 'utf8');
  return stats;
}

// ── CLI ──
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const write = process.argv.includes('--write');
  if (write) { acquireLock(ROOT); process.on('exit', () => releaseLock(ROOT)); }
  const { content, stats } = buildTienDo();
  if (write) {
    writeFileSync(join(MEM, 'TIEN-DO.md'), content, 'utf8');
    console.log(`✅ Đã ghi Memories/TIEN-DO.md — ${stats.total} mảnh · ${stats.hot} đang nóng · ${stats.clashes} vùng coi-chừng · ${stats.noStatus} thiếu status · ${stats.suspectDone} nghi xong chưa bump.`);
  } else {
    console.log(content);
  }
}
