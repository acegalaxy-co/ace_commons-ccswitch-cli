#!/usr/bin/env node
// 🔁 ĐỐI SOÁT status ↔ bằng chứng git (git-OPTIONAL) — bắt chỗ "khai đã merge nhưng quên bump status"
//   hoặc ngược lại ("status đã chốt nhưng bằng chứng không có thật"). CHỈ BÁO CÁO, KHÔNG tự sửa gì
//   (xem docs/trang-thai-cong-viec-6-nac.md — luật "cấm nhảy tắt done≠verified≠activated": máy chỉ
//   được đọc FACT từ git, người mới được chốt ý nghĩa).
//
// 2 nguồn `verify:` được đối soát:
//   (a) frontmatter mảnh:   verify: pr=<số PR> sha=<commit> gate=<tên-cổng|none>
//   (b) dòng checklist trong thân file backlog (chuẩn 6 nấc plan→wip→blocked→done→verified→activated):
//         - [x] Việc gì đó — 🤖 AI · done · verify: pr=128 sha=a1b2c3d gate=none
//
// Với mỗi sha= khai báo: nếu ĐANG trong git repo → `git cat-file -e <sha>` xem có thật không, rồi so
//   với status/task-state đi kèm. Không có git (hoặc lệnh git không có) → in "bỏ qua đối soát git" êm,
//   KHÔNG crash — vẫn chạy tiếp heuristic văn xuôi bên dưới.
//
// Luôn chạy (dù có git/verify: hay không) heuristic "nghi xong chưa bump": mảnh status wip/blocked mà
//   THÂN chứa dấu hiệu đã-xong (✅ / "đã xong" / "merged") → cờ 🟡. Cùng heuristic này được tools/tien-do.mjs
//   import để gắn cờ trên bảng tiến độ.
//
// Dùng:  node doi-soat.mjs
//
// ⚙️ ROOT = thư mục bộ nhớ (chứa Memories/). Mặc định = thư mục CHA của tools/. Đặt MEMORY_ROOT để đổi.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.env.MEMORY_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const MEM = join(ROOT, 'Memories');
// "Đã chốt" — chấp cả status mảnh (9 từ vựng chuẩn có `done`) lẫn task-state 6 nấc (`verified`/`activated`).
const SETTLED = new Set(['done', 'verified', 'activated']);
// CHỈ bỏ báo-cáo-máy-in (không phải mảnh ký ức). LƯU Ý: `_Backlog.md`/`_backlog.md` KHÔNG bị bỏ —
// đó chính là nơi task-state 6 nấc sống (dòng checklist `verify:`), xem docs/trang-thai-cong-viec-6-nac.md.
const SKIP_FILES = new Set(['MEMORY.md', 'README.md', 'TIEN-DO.md', 'SO-NANG-LUC.md', 'CATALOG.md']);

/** Tín hiệu văn xuôi "nghi đã xong" trong thân mảnh — DÙNG CHUNG cho doi-soat.mjs + tien-do.mjs. */
export function ngheXongChuaBump(bodyText) {
  if (!bodyText) return false;
  const low = bodyText.toLowerCase();
  return bodyText.includes('✅') || low.includes('merged') || low.includes('đã xong');
}

/** Có đang chạy TRONG một git repo không (git-OPTIONAL — không có git/không phải repo → false, không throw). */
export function checkGitAvailable(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (!r || r.error) return false;
  return r.status === 0 && String(r.stdout || '').trim() === 'true';
}

function shaExistsInGit(root, sha) {
  const r = spawnSync('git', ['-C', root, 'cat-file', '-e', sha], { encoding: 'utf8' });
  if (!r || r.error) return null; // không hỏi được (không nên xảy ra nếu checkGitAvailable đã true) → coi như "chưa rõ"
  return r.status === 0;
}

function readFM(text) {
  const lines = text.split('\n');
  if (!lines[0] || lines[0].trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const fm = {};
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^\s*([\w-]+):\s*(.*)$/);
    if (m && fm[m[1]] === undefined) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return fm;
}

const bodyOf = (text) => text.replace(/^---[\s\S]*?\n---/, '');

function parseVerify(str) {
  const out = {};
  const pr = str.match(/pr=(\S+)/); if (pr) out.pr = pr[1];
  const sha = str.match(/sha=(\S+)/); if (sha) out.sha = sha[1];
  const gate = str.match(/gate=(\S+)/); if (gate) out.gate = gate[1];
  return out;
}

// Quét đệ quy Memories/ (hỗ trợ nhóm lồng cấp) → {path, rel}. Êm nếu Memories/ chưa có / đọc lỗi.
function walkMd(dir, rel, out) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walkMd(p, r, out);
    else if (e.name.endsWith('.md')) out.push({ path: p, rel: r });
  }
}

/**
 * Quét toàn bộ + đối soát. Hàm THUẦN (không console.log) để tool khác (vd tests, memory-doctor sau này)
 * gọi được. Trả { hasGit, nVerify, verifyFlags: string[], heuristicFlags: string[] }.
 */
export function runDoiSoat() {
  const hasGit = checkGitAvailable(ROOT);
  const files = [];
  if (existsSync(MEM)) walkMd(MEM, '', files);

  let nVerify = 0;
  const verifyFlags = [];

  function checkOne(where, what, v, settled, statusLabel) {
    if (!v.sha && !v.pr) return; // verify: rỗng/không có mỏ neo → bỏ qua
    if (!hasGit || !v.sha) return; // không đối soát được với git → im lặng (không báo sai)
    const exists = shaExistsInGit(ROOT, v.sha);
    if (exists === false) {
      verifyFlags.push(`🔴 ${where}: ${what} khai sha=${v.sha} nhưng KHÔNG thấy commit này trong git repo (sai hash hoặc verify của repo khác).`);
    } else if (exists === true && !settled) {
      verifyFlags.push(`🟡 ${where}: ${what} đã có sha=${v.sha} (bằng chứng merge có thật) nhưng status/task-state vẫn "${statusLabel}" — nghi QUÊN bump lên done/verified.`);
    }
  }

  for (const { path, rel } of files) {
    const bn = basename(path);
    if (SKIP_FILES.has(bn) || /^index\.md$/i.test(bn)) continue;
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { continue; }
    const fm = readFM(text) || {};

    // (a) verify: ở frontmatter — áp cho cả mảnh, đối chiếu với status: của mảnh.
    if (fm.verify) {
      nVerify++;
      const v = parseVerify(fm.verify);
      const status = (fm.status || '_unknown').trim();
      checkOne(rel, `frontmatter (status: ${status})`, v, SETTLED.has(status), status);
    }

    // (b) verify: theo dòng checklist trong thân (chuẩn task-state 6 nấc, docs/trang-thai-cong-viec-6-nac.md).
    const body = bodyOf(text);
    for (const line of body.split('\n')) {
      const m = line.match(/verify:\s*(.+)$/);
      if (!m) continue;
      nVerify++;
      const v = parseVerify(m[1]);
      const stM = line.match(/\b(plan|wip|blocked|done|verified|activated)\b/);
      const status = stM ? stM[1] : '_unknown';
      const label = line.trim().replace(/^-+\s*/, '').slice(0, 90);
      checkOne(rel, `dòng checklist "${label}"`, v, SETTLED.has(status), status);
    }
  }

  // Heuristic "nghi xong chưa bump" — LUÔN chạy, không cần verify:/git.
  const heuristicFlags = [];
  for (const { path, rel } of files) {
    const bn = basename(path);
    if (SKIP_FILES.has(bn) || /^index\.md$/i.test(bn)) continue;
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { continue; }
    const fm = readFM(text);
    const status = (fm?.status || '').trim();
    if (status !== 'wip' && status !== 'blocked') continue;
    if (ngheXongChuaBump(bodyOf(text))) {
      heuristicFlags.push(`🟡 ${rel} (status: ${status}) — thân có dấu hiệu đã xong (✅ / "đã xong" / "merged") nhưng status chưa bump.`);
    }
  }

  return { hasGit, nVerify, verifyFlags, heuristicFlags };
}

// ── CLI ──
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  console.log('\n🔁 ĐỐI SOÁT — status ↔ bằng chứng git (verify: pr=/sha=/gate=)\n');
  const { hasGit, nVerify, verifyFlags, heuristicFlags } = runDoiSoat();

  if (!hasGit) console.log('⏭️  Không ở trong git repo (hoặc không có lệnh git) → bỏ qua đối soát git.\n');

  if (nVerify === 0) {
    console.log('ℹ️  0 mảnh có `verify:` (frontmatter hoặc dòng checklist) — chưa gắn, hoặc dự án còn nhỏ nên chưa cần đối soát máy.\n');
  } else {
    console.log(`🔎 Quét thấy ${nVerify} mỏ neo verify:.`);
    if (verifyFlags.length) {
      console.log(`⚠️  ${verifyFlags.length} chỗ LỆCH status ↔ bằng chứng git:`);
      for (const f of verifyFlags) console.log('  ' + f);
    } else if (hasGit) {
      console.log('✅ Không có lệch status ↔ git.');
    }
    console.log('');
  }

  console.log('🩺 Heuristic "nghi xong chưa bump" (status wip/blocked mà thân có ✅ / đã xong / merged):');
  if (!heuristicFlags.length) console.log('  ✅ Không thấy mảnh nào nghi xong-chưa-bump.');
  else for (const f of heuristicFlags) console.log('  ' + f);

  console.log('\n────────────────');
  console.log('ℹ️  Công cụ CHỈ báo cáo — KHÔNG tự sửa status/task-state (luật "cấm nhảy tắt", xem docs/trang-thai-cong-viec-6-nac.md).');
}
