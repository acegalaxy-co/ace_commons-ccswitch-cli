#!/usr/bin/env node
// ✍️ GHI MẢNH 1 BƯỚC — tạo mảnh nhớ mới ĐÚNG CHUẨN ngay từ lúc sinh (chống thiếu-status & mồ côi tận gốc).
// Thay cho việc gõ tay file .md rồi nhớ gắn frontmatter + nhớ thêm vào INDEX (hay sót).
//
// Dùng:
//   node ghi-manh.mjs <Nhóm> <slug> "<mô tả 1 dòng>" [status] [type]
// Ví dụ:
//   node ghi-manh.mjs SampleProject vi-merchant "Ví merchant — quyết định report-only" wip project
//   node ghi-manh.mjs _Common quy-tac-abc "Nguyên tắc ABC đã chốt" reference feedback
//
// status mặc định: wip   ·   type mặc định: project
// Tự làm: ① tạo file với frontmatter ĐỦ (name/description/status/updated/type)
//         ② thêm dòng vào INDEX nhóm (marker tự-sinh → in lại; không marker → thêm cuối)
//         ③ in sẵn dòng để dán vào MEMORY.md tổng (1 dòng trỏ)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { processDir, MEM, START } from './build-index.mjs';
import { acquireLock, releaseLock } from './khoa-vault.mjs';

// 🔒 Script này LUÔN ghi file (tạo mảnh + cập INDEX) → khoá chống 2 phiên cùng máy đè nhau.
const ROOT = dirname(MEM);
acquireLock(ROOT);
process.on('exit', () => releaseLock(ROOT));

const VOCAB = ['live', 'wip', 'blocked', 'plan', 'research', 'maintain', 'done', 'reference', 'archived'];
const [group, slug, desc, statusArg, typeArg] = process.argv.slice(2);

if (!group || !slug || !desc) {
  console.error('❌ Dùng: node ghi-manh.mjs <Nhóm> <slug> "<mô tả>" [status] [type]');
  console.error('   vd:  node ghi-manh.mjs SampleProject vi-merchant "Ví merchant report-only" wip project');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) { console.error(`❌ slug "${slug}" phải là chữ-thường-gạch-nối (a-z0-9-).`); process.exit(1); }
const status = statusArg || 'wip';
if (!VOCAB.includes(status)) { console.error(`❌ status "${status}" lạ. Chọn: ${VOCAB.join(' | ')}`); process.exit(1); }
const type = typeArg || 'project';
const today = new Date().toISOString().slice(0, 10);

const groupDir = join(MEM, group);
// Nhóm chưa có → tạo + INDEX khung TỰ-SINH (marker) ⇒ nhóm mới KHÔNG BAO GIỜ mồ côi.
if (!existsSync(groupDir)) {
  mkdirSync(groupDir, { recursive: true });
  const idxSkel = `# ${group} — INDEX nhóm\n\n> Mục lục nhóm (danh sách mảnh TỰ SINH từ \`status:\` — chạy \`node tools/build-index.mjs ${group} --write\`).\n\n${START}\n<!-- HẾT TỰ SINH -->\n`;
  writeFileSync(join(groupDir, 'INDEX.md'), idxSkel, 'utf8');
  console.log(`📁 Tạo nhóm mới "${group}" + INDEX khung tự-sinh.`);
}

const filePath = join(groupDir, `${slug}.md`);
if (existsSync(filePath)) { console.error(`❌ Đã có ${group}/${slug}.md — sửa trực tiếp, đừng tạo đè.`); process.exit(1); }

// Tiêu đề H1 từ mô tả (cắt ở dấu — hoặc .)
const title = desc.split('—')[0].split(/\.\s/)[0].slice(0, 80).trim();
// Mảnh BÀI HỌC (type=feedback) → dựng sẵn khung 4 phần để đúc tình huống thành QUY TẮC tái dùng.
const fm = `---\nname: ${slug}\ndescription: ${desc}\nstatus: ${status}\nupdated: ${today}\nmetadata:\n  type: ${type}\n---\n\n`;
const skeleton = type === 'feedback'
  ? `# ${title}\n\n**Tình huống:** \n\n**Quyết định / cách xử:** \n\n**Vì sao:** \n\n**Quy tắc tái dùng (áp lần sau):** \n`
  : `# ${title}\n\n`;
const body = fm + skeleton;
writeFileSync(filePath, body, 'utf8');
console.log(`✅ Tạo ${group}/${slug}.md (status=${status}, updated=${today}, type=${type}).`);

// ② Thêm vào INDEX nhóm
const idxPath = join(groupDir, 'INDEX.md');
if (existsSync(idxPath)) {
  const idx = readFileSync(idxPath, 'utf8');
  if (idx.includes(START)) {
    processDir(groupDir, true); // nhóm tự-sinh → in lại, có ngay
  } else {
    // nhóm ghi-chú-tay → thêm 1 dòng cuối (sắp lại sau cho hợp mạch)
    const line = `- [${title}](${slug}.md) — ${desc}`;
    writeFileSync(idxPath, idx.replace(/\s*$/, '') + `\n${line}\n`, 'utf8');
    console.log(`✅ Thêm dòng vào ${group}/INDEX.md (cuối file — sắp lại cho hợp mạch khi rảnh).`);
  }
} else {
  console.log(`⚠️ Nhóm chưa có INDEX.md — tạo theo template GROUP-INDEX rồi chạy build-index.`);
}

// ③ Gợi ý dòng cho MEMORY.md tổng
console.log(`\n👉 Nếu mảnh đáng vào mục lục TỔNG, dán 1 dòng này vào MEMORY.md (mục nhóm ${group}):`);
console.log(`   - **${title}** → \`${group}/${slug}.md\``);
console.log(`\n📝 File đã mở sẵn khung — viết nội dung vào ${group}/${slug}.md là xong.`);
