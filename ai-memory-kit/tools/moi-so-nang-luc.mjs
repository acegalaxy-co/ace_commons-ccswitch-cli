#!/usr/bin/env node
// 🌱 MỒI SỔ NĂNG LỰC — gắn `capability:`+`do-tin:` vào FRONTMATTER các mảnh "bản chuẩn" theo bản đồ MAP.
// Mục đích: Sổ ra mắt đã CÓ RUỘT (chống cold-start chết). Chạy 1 lần lúc mồi; có thể chạy lại để bổ sung.
// Idempotent: mảnh đã có capability → MERGE (gộp, không trùng); đã có do-tin → GIỮ NGUYÊN (tôn trọng nhãn tay).
// SSOT: sau khi mồi, sự thật nằm ở frontmatter mảnh — file này chỉ là bộ nạp ban đầu (chỉnh MAP rồi chạy lại).
// Dùng:  node moi-so-nang-luc.mjs           → DRY-RUN (chỉ in, không ghi)
//        node moi-so-nang-luc.mjs --write    → ghi thật
//
// ⚙️ SỬA `MAP` dưới đây cho khớp tủ của BẠN: mỗi dòng = 1 mảnh "bản tốt nhất" của 1 năng lực.
//    slug phải khớp danh mục trong tools/nang-luc-registry.json. tin = cao|vua|thap (đã kiểm kỹ chưa).
//    ROOT mặc định = cha của tools/; đặt MEMORY_ROOT để đổi.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, releaseLock } from './khoa-vault.mjs';

const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const MEM = join(ROOT, 'Memories');
const WRITE = process.argv.includes('--write');
if (WRITE) { acquireLock(ROOT); process.on('exit', () => releaseLock(ROOT)); }

// file (tương đối trong Memories/) · các năng lực mảnh này thể hiện · độ tin (cao|vua|thap)
// 👇 ĐÂY LÀ VÍ DỤ — thay bằng các mảnh thật của bạn rồi chạy lại.
const MAP = [
  { file: 'SampleProject/sample-decision.md', caps: ['feature-flag'], tin: 'vua' },
  // { file: 'YourProject/deploy-recipe.md',   caps: ['deploy'],       tin: 'cao' },
  // { file: 'YourProject/auth-setup.md',      caps: ['auth', 'rbac'], tin: 'cao' },
];

function inject(text, caps, tin) {
  const lines = text.replace(/\r\n/g, '\n').split('\n'); // CRLF-tolerant: \r sót lại làm gãy '---' exact-match
  if (lines[0].trim() !== '---') return { changed: false, reason: 'KHÔNG có frontmatter' };
  const end = lines.indexOf('---', 1);
  if (end < 1) return { changed: false, reason: 'frontmatter không đóng' };

  let capLine = -1, tinLine = -1, anchor = 1;
  for (let i = 1; i < end; i++) {
    if (/^capability:/.test(lines[i])) capLine = i;
    if (/^do-tin:/.test(lines[i])) tinLine = i;
    if (/^updated:/.test(lines[i])) anchor = i + 1;
    else if (/^status:/.test(lines[i]) && anchor === 1) anchor = i + 1;
  }

  let changed = false;
  const existing = capLine >= 0
    ? lines[capLine].replace(/^capability:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean) : [];
  const merged = [...new Set([...existing, ...caps])];

  if (capLine < 0) {
    lines.splice(anchor, 0, `capability: ${merged.join(', ')}`, `do-tin: ${tin}`);
    changed = true;
  } else {
    const newCap = `capability: ${merged.join(', ')}`;
    if (lines[capLine] !== newCap) { lines[capLine] = newCap; changed = true; }
    if (tinLine < 0) { lines.splice(capLine + 1, 0, `do-tin: ${tin}`); changed = true; }
  }
  return { changed, text: lines.join('\n') };
}

let tagged = 0, already = 0, missing = 0, skipped = 0;
for (const m of MAP) {
  const p = join(MEM, m.file);
  if (!existsSync(p)) { console.log(`  ❌ KHÔNG TỒN TẠI: ${m.file}`); missing++; continue; }
  const raw = readFileSync(p, 'utf8');
  const r = inject(raw, m.caps, m.tin);
  if (r.reason) { console.log(`  ⚠️  ${m.file}: ${r.reason} → bỏ qua`); skipped++; continue; }
  if (!r.changed) { console.log(`  ✓  ${m.file}: đã có nhãn (không đổi)`); already++; continue; }
  if (WRITE) writeFileSync(p, r.text, 'utf8');
  console.log(`  🌱 ${m.file} ← capability: ${m.caps.join(', ')} · do-tin: ${m.tin}`);
  tagged++;
}
console.log(`\n${WRITE ? '✅ ĐÃ GHI' : '👀 DRY-RUN'} — gắn mới ${tagged} · đã có ${already} · KHÔNG tồn tại ${missing} · bỏ qua ${skipped} (tổng ${MAP.length}).`);
if (!WRITE) console.log('→ Thêm --write để ghi thật.');
