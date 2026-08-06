#!/usr/bin/env node
// ✅ TỰ KIỂM (assert-based, không framework) — chốt 2 fix P1 từ audit:
//   Fix A: parse frontmatter CRLF-tolerant (build-index/memory-doctor/tien-do/doi-soat/moi-so-nang-luc/build-catalog/so-nang-luc).
//   Fix B: SECRET_RE mở rộng (memory-doctor.mjs + dong-gop.mjs) — vẫn ĐỒNG BỘ 2 file.
// Dùng: node tools/test-fixes.mjs   → in OK/FAIL từng case, exit 1 nếu có FAIL.
// Giá trị test dưới đây là chuỗi GIẢ (obviously-fake), chỉ vừa đủ dài để vượt ngưỡng regex — không phải secret thật.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
function check(label, cond) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) fails++;
}

// ── Fix A: CRLF-tolerant frontmatter parse ──
const tmp = mkdtempSync(join(tmpdir(), 'memkit-test-'));
process.env.MEMORY_ROOT = tmp;
mkdirSync(join(tmp, 'Memories', 'Grp'), { recursive: true });
const crlf = '---\r\nname: piece-a\r\ndescription: mo ta CRLF\r\nstatus: wip\r\nupdated: 2026-08-06\r\n---\r\n\r\n# Piece A\r\n';
writeFileSync(join(tmp, 'Memories', 'Grp', 'piece-a.md'), crlf, 'utf8');

const { scanAll } = await import('./tien-do.mjs');
const groups = scanAll();
const item = groups['Grp']?.[0];
check('tien-do.mjs parse CRLF: status = wip (khong phai _unknown)', item?.status === 'wip');
check('tien-do.mjs parse CRLF: description parse dung', item?.desc === 'mo ta CRLF');

const { parse: parseBuildIndex } = await import('./build-index.mjs');
const biParsed = parseBuildIndex(crlf, 'piece-a.md');
check('build-index.mjs parse CRLF: status = wip', biParsed.status === 'wip');

rmSync(tmp, { recursive: true, force: true });

// ── Fix B: SECRET_RE mo rong, dong bo 2 file ──
function extractSecretRe(file, pattern) {
  const src = readFileSync(join(HERE, file), 'utf8');
  const m = src.match(pattern);
  if (!m) throw new Error(`Khong tim thay SECRET_RE trong ${file}`);
  return m[1];
}
// memory-doctor.mjs: const SECRET_RE = "...";  (chuoi JS string literal, dung [:space:] POSIX-class thay \s cho grep -E)
const reDoctorStrLit = extractSecretRe('memory-doctor.mjs', /const SECRET_RE = ("(?:[^"\\]|\\.)*");/);
const reDoctorSrc = JSON.parse(reDoctorStrLit); // giai ma escape JS string -> chuoi regex that
const reDoctor = new RegExp(reDoctorSrc.split('[:space:]').join('\\s'));
// dong-gop.mjs: const SECRET_RE = /.../;  (RegExp literal, source lay truc tiep)
const reDongGopSrc = extractSecretRe('dong-gop.mjs', /const SECRET_RE = \/(.+)\/;/);
const reDongGop = new RegExp(reDongGopSrc);

const FAKE_PREFIX_LIVE = ['sk', 'live'].join('_');
const FAKE_PREFIX_SLACK = ['xox', 'b'].join('');
const MUST_MATCH = [
  `${FAKE_PREFIX_LIVE}_abc123def456ghi`,
  `${FAKE_PREFIX_SLACK}-1234567890-abcdef`,
  'mongodb://fakeuser:fakepass123@host/db',
  'Bearer abcdefghij1234567890XYZ',
];
const MUST_NOT_MATCH = [
  'Bearer <token>',
  'postgres://localhost/db', // khong co creds
];

for (const pair of [['memory-doctor.mjs', reDoctor], ['dong-gop.mjs', reDongGop]]) {
  const [label, rx] = pair;
  for (const s of MUST_MATCH) check(`${label} SECRET_RE khop: "${s}"`, rx.test(s));
  for (const s of MUST_NOT_MATCH) check(`${label} SECRET_RE KHONG khop: "${s}"`, !rx.test(s));
}
// So sanh NGHIA: doctor dung POSIX class [[:space:]] (grep -E khong ho tro \s), dong-gop dung \s (RegExp JS).
// Normalize ca 2 ve 1 token whitespace chung roi so tung ky tu con lai -> chung minh dong bo THAT.
const WS = '<WS>';
// POSIX class xuat hien 2 dang: dung TRAN "[[:space:]]" (co ngoac vuong bao ngoai) hoac LONG trong negated class "[^...[:space:]...]".
const normDoctor = reDoctorSrc.split('[[:space:]]').join(WS).split('[:space:]').join(WS);
const normDongGop = reDongGopSrc.split('\\/').join('/').split('\\s').join(WS);
check('2 file SECRET_RE dong bo (cung source pattern, khac cu phap whitespace-class theo yeu cau engine)', normDoctor === normDongGop);

// ── Fix P2-a: khoa-vault.mjs (lock chong da-phien cung may) ──
{
  const { acquireLock, releaseLock } = await import('./khoa-vault.mjs');
  const lockRoot = mkdtempSync(join(tmpdir(), 'memkit-lock-'));
  const lockPath = join(lockRoot, '.khoa-engine.lock');

  const got1 = acquireLock(lockRoot);
  check('khoa-vault acquire: tra true', got1 === true);
  check('khoa-vault acquire: dir khoa ton tai', existsSync(lockPath));

  // gia lap khoa CU (stale): ghi ts qua staleMs -> lan acquire sau phai pha va chiem lai
  writeFileSync(join(lockPath, 'info.json'), JSON.stringify({ pid: 999999, ts: Date.now() - 20 * 60 * 1000, host: 'other' }), 'utf8');
  const got2 = acquireLock(lockRoot, { retries: 1, staleMs: 10 * 60 * 1000 });
  check('khoa-vault stale-break: chiem lai duoc (tra true)', got2 === true);
  const info2 = JSON.parse(readFileSync(join(lockPath, 'info.json'), 'utf8'));
  check('khoa-vault stale-break: info.json ghi lai pid moi', info2.pid === process.pid);

  releaseLock(lockRoot);
  check('khoa-vault release: dir khoa bien mat', !existsSync(lockPath));

  // fail-open: khoa dang giu (ts moi = khong stale) + retries=0 -> van tra true, khong throw/kẹt
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'info.json'), JSON.stringify({ pid: 1, ts: Date.now(), host: 'other' }), 'utf8');
  const got3 = acquireLock(lockRoot, { retries: 0, staleMs: 10 * 60 * 1000 });
  check('khoa-vault fail-open: het retry van tra true', got3 === true);

  rmSync(lockRoot, { recursive: true, force: true });
}

// ── Fix P2-b: handbook-gate.mjs cache (giam latency doc full transcript moi Edit) ──
{
  const { createHash } = await import('node:crypto');
  const gateDir = mkdtempSync(join(tmpdir(), 'memkit-gate-'));
  const transcriptPath = join(gateDir, 'session.jsonl');
  writeFileSync(transcriptPath, 'noise\n{"file_path":"/root/HANDBOOK.md"}\nmore-noise\n', 'utf8');
  const cacheFile = join(tmpdir(), 'handbook-gate-ok-' + createHash('sha256').update(transcriptPath).digest('hex').slice(0, 16));
  rmSync(cacheFile, { force: true }); // don cache cu neu test truoc de lai (hash trung path)

  const input1 = JSON.stringify({ tool_input: { file_path: '/root/Memories/y.md' }, transcript_path: transcriptPath });
  const r1 = spawnSync(process.execPath, [join(HERE, 'handbook-gate.mjs')], { input: input1, encoding: 'utf8' });
  check('handbook-gate lan 1 (da doc HANDBOOK): exit 0', r1.status === 0);
  check('handbook-gate lan 1: cache file da tao', existsSync(cacheFile));

  writeFileSync(transcriptPath, '', 'utf8'); // xoa sach transcript -> neu KHONG co cache se bi CHAN (exit 2)
  const r2 = spawnSync(process.execPath, [join(HERE, 'handbook-gate.mjs')], { input: input1, encoding: 'utf8' });
  check('handbook-gate lan 2 (transcript rong, cache hit): van exit 0', r2.status === 0);

  rmSync(cacheFile, { force: true });
  rmSync(gateDir, { recursive: true, force: true });
}

console.log(`\n----------------\n${fails === 0 ? 'PASS - tat ca OK' : `FAIL - ${fails} case`}`);
process.exit(fails === 0 ? 0 : 1);
