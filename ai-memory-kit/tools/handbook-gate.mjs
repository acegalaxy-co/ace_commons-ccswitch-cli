#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): CHẶN sửa file BỘ NHỚ nếu phiên CHƯA thật sự Read HANDBOOK (Tầng 0).
// Chống lặp lỗi: thiết kế/sửa bộ nhớ mà bỏ qua nguyên tắc + lằn ranh đỏ trong sổ tay.
// Fail-OPEN: mọi lỗi/không chắc → cho qua (không bao giờ chặn nhầm làm kẹt việc).
//
// 🔧 VÁ chặn-nhầm SUB-AGENT: sub-agent có transcript RIÊNG → không thấy lượt Read HANDBOOK của phiên
//    CHA (và lượt của chính nó có thể CHƯA flush ra đĩa lúc hook chạy). Cách vá: nếu transcript HIỆN TẠI
//    chưa thấy, quét các transcript phiên ĐANG HOẠT ĐỘNG (sửa trong 6h) cùng thư mục — phiên CHA đã đọc
//    Tầng 0 thì cho qua. Vẫn CHẶN phiên mới tinh chưa đọc Tầng 0 ở đâu cả.
//
// ⚙️ CHỈNH 2 hằng số (qua biến môi trường) cho khớp setup của bạn:
//    MEMORY_DIR_MARKER  = chuỗi nhận diện đường dẫn cây bộ nhớ (mặc định '/Memories/').
//    HANDBOOK_NAME      = tên file sổ tay Tầng 0 (mặc định 'HANDBOOK.md').
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MEM_MARKER = process.env.MEMORY_DIR_MARKER || '/Memories/';
const HANDBOOK   = process.env.HANDBOOK_NAME    || 'HANDBOOK.md';

const ok = () => process.exit(0);
let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { ok(); }

const fp = data?.tool_input?.file_path || '';
const tp = data?.transcript_path || '';

// Chỉ áp cho file trong cây bộ nhớ; cho phép sửa chính HANDBOOK
if (!fp.includes(MEM_MARKER)) ok();
if (fp.includes(HANDBOOK)) ok();

// Có lượt Read/Edit file_path THẬT là HANDBOOK trong 1 transcript không? (KHÔNG nhầm với lời nhắc
// SessionStart vốn cũng có thể chứa tên HANDBOOK nhưng KHÔNG ở dạng "file_path":"...HANDBOOK").
const RE = new RegExp('"file_path"\\s*:\\s*"[^"]*' + HANDBOOK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
const touchedIn = (file) => {
  try { return RE.test(readFileSync(file, 'utf8')); } catch { return false; }
};

// 1) Phiên hiện tại đã đọc Tầng 0? (đường nhanh — đúng cho phiên CHÍNH)
if (!tp) ok();                       // không có transcript path → fail-open
if (touchedIn(tp)) ok();

// 2) Chưa thấy → có thể là SUB-AGENT. Quét transcript các phiên ĐANG HOẠT ĐỘNG (mtime ≤ 6h) cùng thư mục;
//    phiên nào đã đọc Tầng 0 thì coi như môi trường này đã nạp lằn ranh đỏ → cho qua. Dừng ở lần khớp đầu.
const SIX_H = 6 * 60 * 60 * 1000;
try {
  const dir = dirname(tp);
  const now = Date.now();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f))
    .filter((p) => p !== tp)
    .map((p) => { try { return { p, m: statSync(p).mtimeMs }; } catch { return null; } })
    .filter((x) => x && now - x.m <= SIX_H)
    .sort((a, b) => b.m - a.m)   // mới nhất trước (phiên cha đang chạy ⇒ mtime gần)
    .slice(0, 12);               // giới hạn để hook luôn nhanh
  for (const { p } of files) if (touchedIn(p)) ok();
} catch { ok(); }                // lỗi quét thư mục → fail-open

// CHẶN: trả exit 2 + thông điệp cho AI (PreToolUse: stderr → AI đọc).
process.stderr.write(
  `⛔ CHƯA đọc Tầng 0. Trước khi sửa/tạo file BỘ NHỚ, hãy Read "${HANDBOOK}" ` +
  `(nguyên tắc + lằn ranh đỏ ở đầu file) — và kiểm bộ nhớ xem đã có quyết định cũ chưa. ` +
  `Đọc xong làm lại thao tác này.`
);
process.exit(2);
