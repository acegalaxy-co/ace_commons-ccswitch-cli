#!/usr/bin/env node
// 🔔 NHẮC DỌN TỦ + ĐÚC KẾT — chạy đầu mỗi phiên (SessionStart hook). NHẸ, KHÔNG ghi gì, KHÔNG side-effect.
// 2 việc: (a) đếm mảnh mới kể từ lần dọn gần nhất → tới ngưỡng thì nhắc dọn; (b) nhóm nào tích nhiều
//   mảnh mới gần đây → gợi ý ĐÚC KẾT (reflection có chủ đề — best-practice SOTA).
//   - Ngưỡng dọn: +N mảnh mới (cả tủ), HOẶC quá D ngày chưa dọn → cái nào tới trước.
//   - Ngưỡng đúc kết: ≥G mảnh mới (trong cửa sổ gần đây) ở 1 NHÓM.
//   - Mốc đếm nằm ở .cleanup-state.json (do quy trình dọn ghi lại sau mỗi lần xong).
//   - Không có mốc / lỗi bất kỳ → IM LẶNG (tuyệt đối không làm hỏng phiên).
// Triết lý: máy lo "KHI NÀO nên dọn/đúc"; người lo "dọn/đúc CÁI GÌ".
//
// ⚙️ ROOT mặc định = thư mục CHA của tools/. Đặt MEMORY_ROOT để trỏ chỗ khác.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEW_THRESHOLD = 20;   // mảnh mới (cả tủ)
const DAYS_THRESHOLD = 90;  // ngày
const RECENT_DAYS = 30;     // cửa sổ "gần đây" cho reflection theo nhóm
const GROUP_THRESHOLD = 6;  // ≥ N mảnh mới gần đây trong 1 NHÓM → gợi ý đúc kết

function silent() { process.exit(0); }

try {
  const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
  const MEM = join(ROOT, 'Memories');
  const STATE = join(ROOT, '.cleanup-state.json');

  if (!existsSync(MEM) || !existsSync(STATE)) silent();

  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  const baseCount = Number(state.count) || 0;
  const baseDate = state.date ? new Date(state.date + 'T00:00:00') : null;
  // Mốc reflection: chỉ tính mảnh mới KỂ TỪ lần dọn gần nhất (đúc kết xong RESET → chống alert-fatigue).
  const reflectFloorMs = baseDate ? baseDate.getTime() : Date.now() - RECENT_DAYS * 86400000;

  const SKIP = new Set(['INDEX.md', 'MEMORY.md', 'README.md', 'TIEN-DO.md', 'SO-NANG-LUC.md', '_Backlog.md', 'tien-do.md']);
  let count = 0;
  const recentByGroup = {}; // nhóm → số mảnh có updated SAU mốc reflection
  (function walk(dir, group) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, group || e.name); // nhóm = thư mục cấp 1 dưới Memories
      else if (e.name.endsWith('.md') && !SKIP.has(e.name)) {
        count++;
        if (!group) continue;
        try {
          const head = readFileSync(p, 'utf8').slice(0, 400);
          const m = head.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m);
          if (m && new Date(m[1] + 'T00:00:00').getTime() > reflectFloorMs)
            recentByGroup[group] = (recentByGroup[group] || 0) + 1;
        } catch { /* mảnh lỗi đọc → bỏ qua */ }
      }
    }
  })(MEM, '');
  const hotGroups = Object.entries(recentByGroup)
    .filter(([, n]) => n >= GROUP_THRESHOLD).sort((a, b) => b[1] - a[1]);

  const newSince = count - baseCount;
  const daysSince = baseDate ? Math.floor((Date.now() - baseDate.getTime()) / 86400000) : 0;

  const hitCount = newSince >= NEW_THRESHOLD;
  const hitDays = daysSince >= DAYS_THRESHOLD;
  const hitReflect = hotGroups.length > 0;
  if (!hitCount && !hitDays && !hitReflect) silent();

  const parts = [];
  if (hitCount || hitDays) {
    const why = hitCount
      ? `tủ đã tích +${newSince} mảnh mới kể từ lần dọn ${state.date}`
      : `đã ${daysSince} ngày chưa dọn theo nghĩa (từ ${state.date})`;
    parts.push(`🔔 NHẮC DỌN TỦ: ${why}. Gợi ý chạy quy trình dọn (snapshot → quét trùng/mâu thuẫn theo nghĩa → tờ trình 🟢🟡🔴 để người duyệt).`);
  }
  if (hitReflect) {
    const list = hotGroups.slice(0, 3).map(([g, n]) => `${g} (+${n})`).join(', ');
    parts.push(`🧠 NHẮC ĐÚC KẾT (reflection): nhóm ${list} tích nhiều mảnh mới gần đây (${RECENT_DAYS} ngày) — gợi ý ĐÚC vụn thành 1-2 NGUYÊN TẮC tái dùng. Best-practice SOTA: consolidation theo chủ đề.`);
  }
  const msg = parts.join(' ') + ' KHÔNG tự chạy — chỉ nhắc khi hợp ngữ cảnh.';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: msg }
  }));
  process.exit(0);
} catch {
  silent();
}
