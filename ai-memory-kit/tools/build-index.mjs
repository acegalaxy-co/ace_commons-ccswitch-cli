#!/usr/bin/env node
// "MÁY IN" mục lục nhóm bộ nhớ — gom mảnh THEO TRẠNG THÁI (status) từ frontmatter.
// Triết lý SSOT: trạng thái CHỈ sống ở frontmatter mảnh; INDEX là BÁO CÁO tự in lại.
// CHẾ ĐỘ LAI: chỉ thay phần GIỮA 2 marker; ghi chú tay ngoài marker GIỮ NGUYÊN.
// Dùng:  node build-index.mjs "<thư-mục-nhóm>"          → DRY-RUN (in ra xem)
//        node build-index.mjs "<thư-mục-nhóm>" --write   → ghi vào INDEX.md
//        node build-index.mjs --all [--write]            → chạy mọi nhóm trong Memories/
//
// ⚙️ ROOT = thư mục bộ nhớ (chứa Memories/). Mặc định = thư mục CHA của tools/.
//    Đặt biến môi trường MEMORY_ROOT để trỏ chỗ khác nếu muốn.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const MEM = join(ROOT, 'Memories');
const START = '<!-- BẮT ĐẦU TỰ SINH (build-index.mjs) — đừng sửa tay giữa 2 marker -->';
const END = '<!-- HẾT TỰ SINH -->';

// Thứ tự + nhãn hiển thị từng trạng thái
const ORDER = ['live', 'wip', 'blocked', 'plan', 'research', 'maintain', 'done', 'reference', 'archived'];
const LABEL = {
  live: '🟢 Đang chạy (LIVE)',
  wip: '🔧 Đang làm',
  blocked: '⛔ Chờ / Vướng',
  plan: '📋 Kế hoạch (chưa làm)',
  research: '🔍 Đang nghiên cứu',
  maintain: '🟡 Duy trì (đã bàn giao)',
  done: '✅ Đã xong',
  reference: '📚 Tham chiếu (kiến thức/nguyên tắc)',
  archived: '📦 Lưu trữ (lịch sử)',
  _unknown: '❔ Chưa gắn nhãn',
};

function parse(text, file) {
  const lines = text.split('\n');
  let fm = {};
  if (lines[0].trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) for (const l of lines.slice(1, end)) {
      const m = l.match(/^\s*(name|description|status|updated):\s*(.*)$/);
      if (m && fm[m[1]] === undefined) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  const h1 = lines.find(l => l.startsWith('# '));
  const title = (h1 ? h1.replace(/^#\s+/, '') : fm.name || basename(file, '.md')).trim();
  let desc = (fm.description || '').trim();
  if (desc.length > 150) desc = desc.slice(0, 147) + '…';
  return { title, desc, status: fm.status || '_unknown', updated: fm.updated || '' };
}

function buildBlock(dir) {
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md') && f.toUpperCase() !== 'INDEX.MD' && !f.startsWith('_'))
    .sort();
  const items = files.map(f => ({ f, ...parse(readFileSync(join(dir, f), 'utf8'), f) }));
  const groups = {};
  for (const it of items) (groups[it.status] ||= []).push(it);
  const keys = [...ORDER.filter(k => groups[k]), ...Object.keys(groups).filter(k => !ORDER.includes(k))];
  const out = [];
  for (const k of keys) {
    out.push(`\n### ${LABEL[k] || LABEL._unknown} — ${groups[k].length}`);
    for (const it of groups[k].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))) {
      const upd = it.updated ? `  ·  *${it.updated}*` : '';
      out.push(`- [${it.title}](${it.f})${it.desc ? ' — ' + it.desc : ''}${upd}`);
    }
  }
  return { block: `${START}\n<!-- ${items.length} mảnh · tự sinh từ frontmatter \`status\` — chạy \`node build-index.mjs\` để làm tươi -->${out.join('\n')}\n${END}`, n: items.length };
}

function processDir(dir, write) {
  const indexPath = join(dir, 'INDEX.md');
  let index;
  try { index = readFileSync(indexPath, 'utf8'); }
  catch { console.error(`❌ Không thấy ${indexPath}`); return; }
  const { block, n } = buildBlock(dir);
  const name = basename(dir);
  if (!index.includes(START) || !index.includes(END)) {
    console.log(`\n⚠️  ${name}/INDEX.md CHƯA có marker → in thử (chưa ghi). Dán 2 marker vào chỗ muốn đặt danh sách rồi chạy lại:\n`);
    console.log(block);
    return;
  }
  const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const next = index.replace(re, block);
  if (write) { writeFileSync(indexPath, next, 'utf8'); console.log(`✅ ${name}: ${n} mảnh, đã in lại. Ghi chú tay giữ nguyên.`); }
  else console.log(`👀 ${name}: ${n} mảnh (DRY-RUN, chưa ghi — thêm --write để ghi).`);
}

export { buildBlock, processDir, parse, MEM, ROOT, START, END };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  if (args.includes('--all')) {
    for (const d of readdirSync(MEM).filter(f => statSync(join(MEM, f)).isDirectory()))
      processDir(join(MEM, d), write);
  } else {
    const dir = args.find(a => !a.startsWith('--'));
    if (!dir) { console.error('Dùng: node build-index.mjs "<thư-mục-nhóm>" [--write]  |  node build-index.mjs --all [--write]'); process.exit(1); }
    processDir(dir.startsWith('/') ? dir : join(MEM, dir), write);
  }
}
