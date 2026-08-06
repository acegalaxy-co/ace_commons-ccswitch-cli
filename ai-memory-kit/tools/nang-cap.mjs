#!/usr/bin/env node
// 🔼 NÂNG CẤP tủ bộ nhớ ĐÃ CÀI lên bản kit MỚI — chỉ thay phần KHUNG, KHÔNG đụng dữ liệu của bạn.
//
// Dùng (chạy TỪ thư mục kit MỚI vừa tải về, trỏ tới tủ CŨ của bạn):
//   node tools/nang-cap.mjs <đường-dẫn-thư-mục-bộ-nhớ-CỦA-BẠN>
//   vd:  node tools/nang-cap.mjs ~/MyMemory
//
// AN TOÀN:
//   • TỰ SAO LƯU cả tủ của bạn trước (chép sang thư mục ...-backup-<ngày-giờ>, không xoá gì).
//   • CHỈ GHI ĐÈ phần KHUNG: tools/ (engine+hook) · docs/ · templates/ · PRINCIPLES.md · README.md
//       · CHANGELOG.md · HUONG-DAN.html · HANDBOOK.template.md · VERSION.
//   • GIỮ NGUYÊN cấu hình bạn đã sửa: tools/nang-luc-registry.json · tools/moi-so-nang-luc.mjs
//       · .obsidian/ (chỉ chép nếu bạn CHƯA có).
//   • TUYỆT ĐỐI KHÔNG đụng: HANDBOOK.md (sổ tay bạn điền) · Memories/ (mảnh của bạn) · file .state.
import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(join(dirname(fileURLToPath(import.meta.url)), '..')); // kit MỚI = cha của tools/
const argPath = process.argv[2];
if (!argPath) {
  console.error('❌ Dùng: node tools/nang-cap.mjs <thư-mục-bộ-nhớ-của-bạn>');
  console.error('   vd:  node tools/nang-cap.mjs ~/MyMemory');
  process.exit(1);
}
const DEST = resolve(argPath.replace(/^~(?=$|\/)/, process.env.HOME || ''));

if (!existsSync(DEST)) { console.error(`❌ Không thấy thư mục: ${DEST}`); process.exit(1); }
if (SRC === DEST) { console.error('❌ Nguồn = đích. Hãy chạy script này TỪ kit MỚI vừa tải, trỏ tới tủ CŨ của bạn.'); process.exit(1); }
if (!existsSync(join(DEST, 'Memories')) && !existsSync(join(DEST, 'HANDBOOK.md'))) {
  console.error(`⚠️  "${DEST}" không giống thư mục bộ nhớ (thiếu cả Memories/ lẫn HANDBOOK.md). Dừng cho chắc — kiểm lại đường dẫn.`);
  process.exit(1);
}

const ver = (p) => { try { return readFileSync(join(p, 'VERSION'), 'utf8').trim(); } catch { return 'cũ (chưa có VERSION)'; } };

// 1) SAO LƯU cả tủ của bạn (an toàn — không xoá gì, chỉ chép sang thư mục cạnh bên)
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const BK = `${DEST}-backup-${stamp}`;
const skipNames = new Set(['.git', 'node_modules']);
cpSync(DEST, BK, { recursive: true, filter: (s) => !skipNames.has(basename(s)) });
console.log(`💾 Đã sao lưu tủ của bạn → ${BK}`);
console.log(`🔼 Nâng cấp: bản ${ver(DEST)} → bản ${ver(SRC)}\n`);

// 2) Cập nhật phần KHUNG
const PRESERVE = new Set(['nang-luc-registry.json', 'moi-so-nang-luc.mjs']); // cấu hình người dùng đã sửa → chỉ chép nếu THIẾU
const OVERWRITE_FILES = ['PRINCIPLES.md', 'README.md', 'CHANGELOG.md', 'HUONG-DAN.html', 'HANDBOOK.template.md', 'VERSION'];
const OVERWRITE_DIRS = ['docs', 'templates', 'nut-bam'];
const COPY_IF_MISSING_DIRS = ['.obsidian'];

let nTool = 0, nKept = 0, nAdded = 0;
mkdirSync(join(DEST, 'tools'), { recursive: true });
for (const f of readdirSync(join(SRC, 'tools'))) {
  const d = join(DEST, 'tools', f);
  const isNew = !existsSync(d);
  if (PRESERVE.has(f) && existsSync(d)) { console.log(`  • giữ cấu hình của bạn: tools/${f}`); nKept++; continue; }
  cpSync(join(SRC, 'tools', f), d, { recursive: true });
  if (isNew) { console.log(`  + thêm công cụ mới: tools/${f}`); nAdded++; }
  nTool++;
}
for (const dir of OVERWRITE_DIRS) {
  if (existsSync(join(SRC, dir))) { cpSync(join(SRC, dir), join(DEST, dir), { recursive: true }); console.log(`  • cập nhật ${dir}/`); }
}
for (const f of OVERWRITE_FILES) {
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(DEST, f));
}
for (const dir of COPY_IF_MISSING_DIRS) {
  if (existsSync(join(SRC, dir)) && !existsSync(join(DEST, dir))) { cpSync(join(SRC, dir), join(DEST, dir), { recursive: true }); console.log(`  + thêm ${dir}/`); }
}

console.log(`\n✅ Đã cập nhật ${nTool} công cụ (${nAdded} cái MỚI) + docs/ + templates/ + PRINCIPLES… · giữ nguyên ${nKept} file cấu hình của bạn.`);
console.log(`🔒 KHÔNG đụng: HANDBOOK.md · Memories/ (dữ liệu của bạn) · file trạng thái.`);

console.log(`\n👉 CÒN 2 VIỆC TAY (nếu lên từ v1/v2):`);
console.log(`   1) Nối 2 HOOK MỚI vào trợ lý AI (settings.json):`);
console.log(`        • UserPromptSubmit → node <gốc>/tools/pre-work-nudge.mjs   (nhắc tra Sổ Năng Lực trước việc lặp)`);
console.log(`        • Stop            → node <gốc>/tools/memory-autofix.mjs    (tự khám + vá cuối mỗi lượt)`);
console.log(`   2) (tuỳ chọn) Mở PRINCIPLES.md mục 29–45 (học chéo+đồ-nghề · tiêm phòng · SSOT · luật-trần · checkpoint · verify · #6 viết-lại + toàn-vẹn-tiền/giám-sát/bộ-nhớ-team) — chép vào HANDBOOK.md nếu thấy đúng.`);
console.log(`\n▶️ Cuối cùng chạy:  cd "${DEST}" && node tools/memory-doctor.mjs --fix`);
console.log(`   (in lại bảng TIEN-DO + SO-NANG-LUC, kiểm tra tủ khoẻ). Yên tâm thì xoá thư mục backup ở trên.`);
