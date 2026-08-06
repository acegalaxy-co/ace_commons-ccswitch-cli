#!/usr/bin/env node
// "MÁY IN" SỔ NĂNG LỰC (hệ HỌC CHÉO) — gom 2 loại:
//   • NĂNG LỰC (`capability:`) → bảng "năng lực → BẢN CHUẨN đang ở đâu" (cách DỰNG 1 tính năng).
//   • 🔧 ĐỒ NGHỀ (`cach-chay:`) → bảng "công cụ có sẵn → gọi chạy NGAY" (đừng dựng lại).
//   Cùng tra-trước-khi-làm để TÁI DÙNG, đừng làm lại từ đầu.
// Triết lý SSOT (giống tien-do.mjs / build-index.mjs): BẢN CHUẨN không gõ tay — MÁY suy
//   từ `capability:` + `do-tin:` + `status:` của mảnh → Sổ tự in lại, KHÔNG BAO GIỜ lệch.
// Dùng:  node so-nang-luc.mjs            → in ra xem
//        node so-nang-luc.mjs --write    → ghi Memories/SO-NANG-LUC.md
// EXPORT refreshSoNangLuc() cho memory-doctor.mjs gọi (tự tươi mỗi phiên — khỏi nhớ chạy).
//
// ⚙️ ROOT = thư mục bộ nhớ (chứa Memories/). Mặc định = thư mục CHA của tools/. Đặt MEMORY_ROOT để đổi.
//    Danh mục năng lực đọc từ tools/nang-luc-registry.json (sửa file đó để thêm/bớt năng lực).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.MEMORY_ROOT || join(HERE, '..');
const MEM = join(ROOT, 'Memories');
const START = '<!-- TỰ SINH: node so-nang-luc.mjs --write -->';
const END = '<!-- HẾT TỰ SINH -->';

const TIN = { cao: 3, vua: 2, thap: 1, '': 0 };           // điểm độ-tin để xếp bản tốt nhất lên đầu
const TIN_TXT = { cao: '🟢 cao', vua: '🟡 vừa', thap: '🔴 thấp', '': '• ?' };
const ALIVE = ['live', 'maintain', 'reference', 'done'];   // "còn dùng được" mới được làm BẢN CHUẨN; loại wip/blocked/plan/research/archived

function parse(txt, file) {
  const fm = {};
  if (txt.startsWith('---')) {
    const end = txt.indexOf('\n---', 3);
    const body = end > 0 ? txt.slice(3, end) : '';
    for (const l of body.split('\n')) {
      const m = l.match(/^\s*(name|description|status|updated|capability|do-tin|da-dung-o|cach-chay):\s*(.*)$/);
      if (m && fm[m[1]] === undefined) fm[m[1]] = m[2].trim();
    }
  }
  return {
    name: (fm.name || basename(file, '.md')).trim(),
    desc: (fm.description || '').replace(/\s+/g, ' ').trim(),
    status: (fm.status || '_unknown').trim(),
    updated: (fm.updated || '').trim(),
    caps: (fm.capability || '').split(',').map((s) => s.trim()).filter(Boolean),
    tin: (fm['do-tin'] || '').trim().toLowerCase(),
    provenAt: (fm['da-dung-o'] || '').trim(),
    cachChay: (fm['cach-chay'] || '').trim(), // 🔧 đồ nghề chạy được (lệnh/đường dẫn công cụ)
  };
}

function loadRegistry() {
  try { return JSON.parse(readFileSync(join(HERE, 'nang-luc-registry.json'), 'utf8')).nangLuc || []; }
  catch { return []; }
}

export function buildSoNangLuc() {
  const byCap = {};
  const tools = [];               // 🔧 mảnh có `cach-chay:` → tủ đồ nghề
  let scanned = 0, tagged = 0;
  for (const g of readdirSync(MEM)) {
    let isDir = false; try { isDir = statSync(join(MEM, g)).isDirectory(); } catch { /* skip */ }
    if (!isDir) continue;
    for (const f of readdirSync(join(MEM, g)).filter((x) => x.endsWith('.md') && !/^index\.md$/i.test(x))) {
      scanned++;
      const it = { g, file: f, ...parse(readFileSync(join(MEM, g, f), 'utf8'), f) };
      if (it.cachChay) tools.push(it);
      if (!it.caps.length) continue;
      tagged++;
      for (const c of it.caps) (byCap[c] ||= []).push(it);
    }
  }

  const reg = loadRegistry();
  const labelOf = (slug) => (reg.find((r) => r.slug === slug) || {}).nhan || slug;
  // Xếp các bản trong 1 năng lực: do-tin cao trước → KHUÔN ĐÚC (reference) làm headline,
  //   rồi bản chạy thật (live/maintain) → done → mới hơn trước.
  const STD_RANK = { reference: 4, live: 3, maintain: 3, done: 2 };
  const rankImpl = (a, b) =>
    (TIN[b.tin] || 0) - (TIN[a.tin] || 0)
    || (STD_RANK[b.status] || 0) - (STD_RANK[a.status] || 0)
    || (b.updated || '').localeCompare(a.updated || '');

  const caps = Object.keys(byCap).sort((a, b) => byCap[b].length - byCap[a].length);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const L = [];
  L.push('# 📒 SỔ NĂNG LỰC — "đã từng LÀM cái này chưa? bản TỐT NHẤT ở đâu?"', '');
  L.push('> 🎯 **HỌC CHÉO** — TRƯỚC khi dựng 1 việc LẶP LẠI (auth, deploy, RBAC, CMS, thanh toán, feature-flag…): liếc đây xem có BẢN CHUẨN chưa → **TÁI DÙNG, đừng làm lại từ đầu**.');
  L.push('> 🧩 **2 LOẠI:** *năng lực* (`capability:` = cách DỰNG tính năng) + 🔧 *đồ nghề chạy được* (`cach-chay:` = công cụ có sẵn gọi chạy NGAY: trình quét, script, nút bấm).');
  L.push('> ⚙️ **TỰ IN** từ `capability:`/`cach-chay:`/`do-tin:` của mảnh (đừng sửa tay giữa 2 marker). Cập: dựng/cải tiến xong → set tag cho mảnh → `node tools/so-nang-luc.mjs --write` (hoặc memory-doctor đầu phiên tự làm tươi).');
  L.push('> 🥇 BẢN CHUẨN = mảnh `do-tin: cao` + còn sống (live/maintain), mới nhất. 🔴 `do-tin: thap` = CHƯA kiểm → tái dùng phải CẢNH BÁO.', '');
  L.push(START);
  L.push(`<!-- in lúc ${stamp} · quét ${scanned} mảnh · ${tagged} có 'capability:' · ${caps.length} năng lực · ${tools.length} đồ nghề -->`, '');

  // ── Bảng tra nhanh ──
  L.push('## 🔎 Tra nhanh (1 liếc)', '');
  L.push('| Năng lực | Bản chuẩn hiện tại | Độ tin | Số bản |');
  L.push('|---|---|---|---|');
  for (const c of caps) {
    const list = [...byCap[c]].sort(rankImpl);
    const top = list.find((it) => ALIVE.includes(it.status)) || list[0];
    const stdCell = top ? `\`${top.g}\` · [${top.name}](${top.g}/${top.file})` : '—';
    const tinCell = top ? (TIN_TXT[top.tin] || '• ?') : '—';
    L.push(`| **${labelOf(c)}** | ${stdCell} | ${tinCell} | ${list.length} |`);
  }

  // ── 🔧 Tủ đồ nghề (mảnh có `cach-chay:`) ──
  if (tools.length) {
    const ts = [...tools].sort(rankImpl);
    L.push('', '## 🔧 Đồ nghề chạy được (công cụ có sẵn — gọi chạy NGAY, đừng dựng lại)', '');
    L.push('> Khác *năng lực* (= cách DỰNG): đây là CÔNG CỤ đã có (trình quét, script, nút bấm). Gắn `cach-chay: <lệnh/đường-dẫn>` vào frontmatter mảnh để gom vào đây.', '');
    L.push('| Đồ nghề | Cách chạy | Độ tin | Mảnh |');
    L.push('|---|---|---|---|');
    for (const it of ts) {
      const cmd = it.cachChay.replace(/\|/g, '\\|');
      L.push(`| **${it.name}** | \`${cmd}\` | ${TIN_TXT[it.tin] || '• ?'} | [${it.g}/${it.file}](${it.g}/${it.file}) |`);
    }
  }

  // ── Chi tiết từng năng lực ──
  L.push('', '## 📚 Chi tiết từng năng lực', '');
  for (const c of caps) {
    const list = [...byCap[c]].sort(rankImpl);
    L.push(`### ${labelOf(c)}  \`${c}\``);
    list.forEach((it, i) => {
      const alive = ALIVE.includes(it.status);
      const std = i === 0 && alive && it.tin === 'cao' ? '🥇 ' : '';
      const dead = !alive ? `  〔${it.status}〕` : '';
      const warn = it.tin === 'thap' ? '  ⚠️ chưa kiểm — tái dùng phải cảnh báo' : '';
      const at = it.provenAt ? `  · đã dùng: ${it.provenAt}` : '';
      const d = it.desc.length > 110 ? it.desc.slice(0, 110) + '…' : it.desc;
      L.push(`- ${std}**[${it.name}](${it.g}/${it.file})** — \`${it.g}\` · tin ${TIN_TXT[it.tin] || '• ?'}${dead}${at} · *${it.updated || '?'}*${warn}`);
      if (d) L.push(`    ${d}`);
    });
    L.push('');
  }

  // ── Năng lực chưa có bản nào (cơ hội đánh dấu) ──
  const have = new Set(caps);
  const gaps = reg.filter((r) => !have.has(r.slug));
  if (gaps.length) {
    L.push('## 🌱 Năng lực CHƯA có bản nào trong Sổ (gặp lúc làm thì gắn `capability:` cho mảnh)', '');
    for (const r of gaps) L.push(`- **${r.nhan}** \`${r.slug}\``);
    L.push('');
  }

  L.push(END);
  return { content: L.join('\n') + '\n', stats: { scanned, tagged, caps: caps.length, gaps: gaps.length, tools: tools.length } };
}

export function refreshSoNangLuc(write = true) {
  const { content, stats } = buildSoNangLuc();
  if (write) writeFileSync(join(MEM, 'SO-NANG-LUC.md'), content, 'utf8');
  return stats;
}

// ── CLI ──
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const write = process.argv.includes('--write');
  const { content, stats } = buildSoNangLuc();
  if (write) {
    writeFileSync(join(MEM, 'SO-NANG-LUC.md'), content, 'utf8');
    console.log(`✅ Đã ghi Memories/SO-NANG-LUC.md — ${stats.tagged}/${stats.scanned} mảnh có capability · ${stats.caps} năng lực · ${stats.tools} đồ nghề · ${stats.gaps} năng lực chưa có bản.`);
  } else {
    console.log(content);
  }
}
