#!/usr/bin/env node
// 📇 "MÁY IN" MỤC LỤC PHẲNG toàn bộ mảnh — tiết kiệm token khi TRA (khỏi mở từng INDEX nhóm để dò).
// Quét ĐỆ QUY mọi *.md dưới Memories/ (mọi cấp nhóm/nhóm-con), đọc frontmatter (name/description/
//   status/canonical/capability) rồi in MỖI MẢNH 1 DÒNG, gom theo thư mục — mảnh `canonical: true`
//   (★ = BẢN CHUẨN) đẩy lên đầu nhóm. Cùng triết lý SSOT với build-index.mjs/tien-do.mjs: đây là
//   BÁO CÁO tự in lại từ frontmatter, KHÔNG BAO GIỜ sửa tay.
// Dùng:  node build-catalog.mjs           → in ra thử (DRY-RUN, chưa ghi)
//        node build-catalog.mjs --write   → ghi Memories/CATALOG.md
//
// ⚙️ ROOT = thư mục bộ nhớ (chứa Memories/). Mặc định = thư mục CHA của tools/.
//    Đặt biến môi trường MEMORY_ROOT để trỏ chỗ khác nếu muốn.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const MEM = join(ROOT, 'Memories');
const START = '<!-- TỰ SINH: node build-catalog.mjs --write -->';
const END = '<!-- HẾT TỰ SINH -->';

// Báo-cáo-máy-in / không-phải-mảnh → bỏ qua (khớp cách build-index.mjs & memory-doctor.mjs đang lọc).
const SKIP_FILES = new Set(['INDEX.md', 'MEMORY.md', 'README.md', 'TIEN-DO.md', 'SO-NANG-LUC.md', 'CATALOG.md', '_Backlog.md']);

function isCanonical(v) {
  return /^(true|có|yes|1|★)$/i.test((v || '').trim());
}

// Đọc frontmatter (êm nếu thiếu — không crash) + suy tên/description dự phòng như build-index.mjs.
function parseFM(text, file) {
  const lines = text.replace(/\r\n/g, '\n').split('\n'); // CRLF-tolerant: \r sót lại làm gãy '---' exact-match + regex $ cuối dòng
  let fm = {};
  if (lines[0] && lines[0].trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) for (const l of lines.slice(1, end)) {
      const m = l.match(/^\s*(name|description|status|canonical|capability):\s*(.*)$/);
      if (m && fm[m[1]] === undefined) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  const h1 = lines.find((l) => l.startsWith('# '));
  const name = (fm.name || (h1 ? h1.replace(/^#\s+/, '') : basename(file, '.md'))).trim();
  let desc = (fm.description || '').trim();
  if (desc.length > 140) desc = desc.slice(0, 137) + '…';
  return {
    name,
    desc,
    status: (fm.status || '_unknown').trim(),
    canonical: isCanonical(fm.canonical),
    capability: (fm.capability || '').trim(),
  };
}

// Quét đệ quy Memories/ (hỗ trợ nhóm lồng nhiều cấp) → danh sách {path, rel}. Êm nếu Memories/ chưa có.
function walkMd(dir, rel, out) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // bỏ file/thư mục ẩn (.obsidian, .git…)
    const p = join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walkMd(p, r, out);
    else if (e.name.endsWith('.md') && !e.name.startsWith('_') && !SKIP_FILES.has(e.name) && e.name.toUpperCase() !== 'INDEX.MD') {
      out.push({ path: p, rel: r });
    }
  }
}

/** Dựng nội dung CATALOG.md + thống kê. Đọc lỗi 1 file không làm gãy cả mẻ quét. */
export function buildCatalog() {
  const files = [];
  if (existsSync(MEM)) walkMd(MEM, '', files);

  const items = [];
  for (const { path, rel } of files) {
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { continue; } // file lỗi/không đọc được → bỏ qua, đừng crash
    items.push({ rel, ...parseFM(text, path) });
  }

  const groups = {};
  for (const it of items) {
    const i = it.rel.lastIndexOf('/');
    const g = i >= 0 ? it.rel.slice(0, i) : '(gốc Memories/)';
    (groups[g] ||= []).push(it);
  }
  const gkeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const L = [];
  L.push('# 📇 CATALOG — mục lục PHẲNG toàn bộ mảnh (tiết kiệm token khi tra)', '');
  L.push('> Mỗi mảnh 1 dòng: `[tên] (status) ★nếu-canonical — mô tả — đường-dẫn`. Tra nhanh không cần mở từng INDEX nhóm.');
  L.push('> Máy sinh — ĐỪNG sửa tay giữa 2 marker. Làm tươi: `node tools/build-catalog.mjs --write`.', '');
  L.push(START);
  L.push(`<!-- in lúc ${stamp} · ${items.length} mảnh · ${gkeys.length} nhóm -->`, '');
  for (const g of gkeys) {
    const list = [...groups[g]].sort((a, b) => (Number(b.canonical) - Number(a.canonical)) || a.name.localeCompare(b.name));
    L.push(`## ${g} — ${list.length}`);
    for (const it of list) {
      const star = it.canonical ? ' ★' : '';
      const desc = it.desc || '_(chưa có description)_';
      L.push(`- [${it.name}] (${it.status})${star} — ${desc} — ${it.rel}`);
    }
    L.push('');
  }
  L.push(`Tổng: ${items.length} mảnh · ${gkeys.length} nhóm.`);
  L.push(END);
  return { content: L.join('\n') + '\n', stats: { total: items.length, groups: gkeys.length } };
}

/** Ghi/refresh Memories/CATALOG.md — cho tool khác gọi (vd memory-doctor) nếu sau này muốn tự tươi mỗi phiên. */
export function refreshCatalog(write = true) {
  const { content, stats } = buildCatalog();
  if (write) writeFileSync(join(MEM, 'CATALOG.md'), content, 'utf8');
  return stats;
}

// ── CLI ──
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const write = process.argv.includes('--write');
  const { content, stats } = buildCatalog();
  if (write) {
    writeFileSync(join(MEM, 'CATALOG.md'), content, 'utf8');
    console.log(`✅ Đã ghi Memories/CATALOG.md — ${stats.total} mảnh · ${stats.groups} nhóm.`);
  } else {
    console.log(content);
    console.log('👀 DRY-RUN (chưa ghi) — thêm --write để ghi Memories/CATALOG.md.');
  }
}
