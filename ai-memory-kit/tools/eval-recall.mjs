#!/usr/bin/env node
// 📏 BỘ ĐO RECALL THỦ THƯ — biến "không biết bộ tra-cứu có SÓT mảnh không" thành 1 CON SỐ chạy-lại-được.
//   Đo Recall@K = bao nhiêu câu hỏi mà MẢNH-VÀNG (đáp án đúng) nằm trong ≤K kết quả thủ-thư trả về.
//   Dùng để: đo baseline → xé nhóm to / thêm `aliases:` → ĐO LẠI bằng số (đỡ hơn / tệ hơn).
//
// Quy trình (xem docs/do-recall-thu-thu.md):
//   1) node tools/eval-recall.mjs --init           → tạo bộ eval + mẫu kết quả trong Memories/_eval/
//   2) Sửa Memories/_eval/recall-eval.json: viết ~18 câu hỏi BẰNG TIẾNG NGƯỜI DÙNG + mảnh-vàng mỗi câu.
//   3) Hỏi trợ lý AI từng câu ("mảnh nào liên quan tới …?") → chép tên mảnh nó trả về vào recall-results.json.
//   4) node tools/eval-recall.mjs                   → in Recall@K + 🔴🟡🟢 + chi tiết từng câu (lọc theo loại bẫy).
//
// ⚙️ CONFIG: MEMORY_ROOT (mặc định = cha của tools/). Cờ: --eval <path> --results <path> --k <N> --init
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.MEMORY_ROOT || resolve(join(HERE, '..'));
const EVAL_DIR = join(ROOT, 'Memories', '_eval');
const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const SAMPLE = join(HERE, 'recall-eval.sample.json');
const EVAL_PATH = resolve(flag('--eval', existsSync(join(EVAL_DIR, 'recall-eval.json')) ? join(EVAL_DIR, 'recall-eval.json') : SAMPLE));
const RES_PATH = resolve(flag('--results', join(EVAL_DIR, 'recall-results.json')));
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\.md$/, '');

// ── --init: dựng bộ eval + mẫu kết quả từ sample ──
if (argv.includes('--init')) {
  mkdirSync(EVAL_DIR, { recursive: true });
  const dst = join(EVAL_DIR, 'recall-eval.json');
  if (existsSync(dst)) console.log(`• Đã có ${dst} — giữ nguyên (không ghi đè bộ eval của bạn).`);
  else { cpSync(SAMPLE, dst); console.log(`✅ Tạo ${dst} (chép từ mẫu — SỬA lại bằng câu hỏi & mảnh-vàng của BẠN).`); }
  const ev = JSON.parse(readFileSync(dst, 'utf8'));
  const tmpl = Object.fromEntries((ev.questions || []).map((q) => [q.id, []]));
  const rdst = join(EVAL_DIR, 'recall-results.json');
  if (existsSync(rdst)) console.log(`• Đã có ${rdst} — giữ nguyên.`);
  else { writeFileSync(rdst, JSON.stringify(tmpl, null, 2) + '\n'); console.log(`✅ Tạo ${rdst} (điền tên mảnh thủ-thư trả về cho mỗi câu).`); }
  process.exit(0);
}

// ── Nạp bộ eval ──
let ev;
try { ev = JSON.parse(readFileSync(EVAL_PATH, 'utf8')); }
catch (e) { console.error(`❌ Không đọc được bộ eval: ${EVAL_PATH}\n   ${e.message}\n   Chạy: node tools/eval-recall.mjs --init`); process.exit(1); }
const questions = ev.questions || [];
const K = Number(flag('--k', ev.k || 8));
if (EVAL_PATH === SAMPLE) console.log('ℹ️  Đang dùng bộ eval MẪU (chưa có Memories/_eval/recall-eval.json). Chạy --init để tạo bộ của bạn.\n');

// ── Nạp kết quả thủ thư ──
let results = null;
try { results = JSON.parse(readFileSync(RES_PATH, 'utf8')); } catch { /* chưa có */ }
if (!results) {
  console.log(`📋 Chưa có file kết quả (${RES_PATH}). Hỏi trợ lý AI ${questions.length} câu dưới, chép tên mảnh nó trả về vào file đó:\n`);
  for (const q of questions) console.log(`  [${q.id}] (${q.trap || '-'}) ${q.question}`);
  mkdirSync(EVAL_DIR, { recursive: true });
  const tmpl = Object.fromEntries(questions.map((q) => [q.id, []]));
  if (!existsSync(RES_PATH)) { writeFileSync(RES_PATH, JSON.stringify(tmpl, null, 2) + '\n'); console.log(`\n✍️  Đã tạo mẫu trống: ${RES_PATH}`); }
  process.exit(0);
}

// ── Chấm Recall@K ──
let hit = 0;
const byTrap = {};
const misses = [];
for (const q of questions) {
  const ret = (results[q.id] || []).slice(0, K).map(norm);
  const ok = ret.includes(norm(q.gold));
  (byTrap[q.trap || '-'] ||= { hit: 0, n: 0 });
  byTrap[q.trap || '-'].n++; if (ok) byTrap[q.trap || '-'].hit++;
  if (ok) hit++; else misses.push(q);
}
const total = questions.length || 1;
const pct = Math.round((hit / total) * 100);
const color = pct < 80 ? '🔴' : pct < 92 ? '🟡' : '🟢';

console.log(`📏 RECALL@${K} = ${color} ${pct}%  (${hit}/${total} câu có mảnh-vàng trong ≤${K} kết quả)`);
console.log(`   Ngưỡng: 🔴 <80% (phải xé nhóm / thêm aliases / cân vector) · 🟡 80–92% (vá cấu trúc) · 🟢 ≥92%.\n`);
console.log('Theo loại bẫy:');
for (const [t, s] of Object.entries(byTrap)) console.log(`  • ${t}: ${s.hit}/${s.n}`);
if (misses.length) {
  console.log('\n❌ Câu SÓT (xem mảnh-vàng: thiếu `aliases:`? nằm nhóm quá to? → vá rồi đo lại):');
  for (const q of misses) console.log(`  [${q.id}] (${q.trap || '-'}) ${q.question}\n        → mảnh-vàng: ${q.gold}`);
} else console.log('\n✅ Không câu nào sót.');
process.exit(pct < 80 ? 1 : 0);
