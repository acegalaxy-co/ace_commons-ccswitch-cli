#!/usr/bin/env node
// 🔎 NHẮC TRA-TRƯỚC-KHI-LÀM (UserPromptSubmit hook) — hệ HỌC CHÉO. NHẸ, fail-open: lỗi gì cũng IM.
// Việc duy nhất: prompt có "MÙI VIỆC LẶP LẠI" (động từ dựng/làm + tên 1 năng lực trong
//   nang-luc-registry.json) → chèn 1 nhắc: liếc SO-NANG-LUC.md xem đã có BẢN CHUẨN chưa,
//   nếu có thì ĐỌC & TÁI DÙNG, đừng làm lại từ đầu.
// Triết lý: MÁY phát hiện "mùi việc lặp" để ÉP tra-trước fire — KHÔNG trông vào AI tự nhớ.
//   Chỉ NHẮC (không chặn). Việc vặt/one-off → AI tự bỏ qua nhắc.
//
// ⚙️ Danh mục năng lực đọc từ nang-luc-registry.json CÙNG THƯ MỤC (tools/). Đổi 'tu-khoa' sang tiếng của bạn.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function silent() { process.exit(0); }

try {
  // stdin = JSON của hook (có field `prompt`). Không đọc được → im.
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { silent(); }
  const prompt = String((JSON.parse(raw || '{}') || {}).prompt || '').toLowerCase();
  if (prompt.length < 6) silent();

  // Chỉ nhắc khi định DỰNG/LÀM cái gì (không phải hỏi/đọc vu vơ).
  const VERB = /(dựng|làm|tạo|thêm|build|setup|cài|cắm|tích hợp|viết|triển khai|làm lại|code)/;
  if (!VERB.test(prompt)) silent();

  const HERE = dirname(fileURLToPath(import.meta.url));
  const reg = JSON.parse(readFileSync(join(HERE, 'nang-luc-registry.json'), 'utf8')).nangLuc || [];

  const hits = [];
  for (const nl of reg) {
    if ((nl['tu-khoa'] || []).some((k) => prompt.includes(String(k).toLowerCase())))
      hits.push(nl.nhan || nl.slug);
  }
  if (!hits.length) silent();

  const list = [...new Set(hits)].slice(0, 4).join(' · ');
  const msg = `🔎 HỌC CHÉO — việc này CÓ MÙI LẶP LẠI (${list}). TRƯỚC khi làm: liếc \`Memories/SO-NANG-LUC.md\` xem đã có BẢN CHUẨN chưa — nếu có thì ĐỌC & TÁI DÙNG bản đó (đừng dựng lại từ đầu); nếu \`do-tin: thap\` thì cảnh báo người chủ. Việc vặt/one-off thì bỏ qua nhắc này.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
  }));
  process.exit(0);
} catch {
  silent();
}
