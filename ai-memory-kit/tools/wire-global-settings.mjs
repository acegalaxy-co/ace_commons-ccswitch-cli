#!/usr/bin/env node
// wire-global-settings.mjs — merge 4 hook MemoryOS + env vào ~/.claude/settings.json (GLOBAL).
// Dùng bởi cai-dat.sh. Idempotent: strip-then-append (chạy nhiều lần không nhân đôi).
// argv: VAULT SETTINGS_PATH HOME
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [, , VAULT, SETTINGS, HOME] = process.argv;
if (!VAULT || !SETTINGS || !HOME) {
  console.error('usage: wire-global-settings.mjs <VAULT> <SETTINGS_PATH> <HOME>');
  process.exit(1);
}

const VAULT_MARK = `${VAULT}/tools/`;

function loadSettings() {
  if (!existsSync(SETTINGS)) return {};
  const raw = readFileSync(SETTINGS, 'utf8');
  try {
    return raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    const bak = `${SETTINGS}.bak-${Date.now()}`;
    writeFileSync(bak, raw);
    console.error(`⚠️  ${SETTINGS} lỗi JSON — đã backup về ${bak}, tạo mới từ rỗng.`);
    return {};
  }
}

const settings = loadSettings();
settings.hooks = settings.hooks || {};

// --- strip cũ: bỏ mọi entry có command chứa vault tools/ path hoặc marker "ai-memory-kit"
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = (settings.hooks[ev] || []).filter((entry) => {
    const cmds = (entry.hooks || []).map((h) => h.command || '');
    return !cmds.some((c) => c.includes(VAULT_MARK) || c.includes('ai-memory-kit'));
  });
  if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
}

const cmd = (script) => `node "${VAULT}/tools/${script}"`;

settings.hooks.SessionStart = [
  ...(settings.hooks.SessionStart || []),
  { hooks: [{ type: 'command', command: cmd('cleanup-nudge.mjs') }] },
];
settings.hooks.PreToolUse = [
  ...(settings.hooks.PreToolUse || []),
  { matcher: 'Edit|Write', hooks: [{ type: 'command', command: cmd('handbook-gate.mjs') }] },
];
settings.hooks.UserPromptSubmit = [
  ...(settings.hooks.UserPromptSubmit || []),
  { hooks: [{ type: 'command', command: cmd('pre-work-nudge.mjs') }] },
];
settings.hooks.Stop = [
  ...(settings.hooks.Stop || []),
  { hooks: [{ type: 'command', command: cmd('memory-autofix.mjs') }] },
];

// --- env: merge, enforce local mirror (không cloud sync cho secret/git history)
settings.env = settings.env || {};
const CLOUD_RE = /CloudStorage|Dropbox|OneDrive|Google Drive|iCloud/;

const localGitMirror = `${HOME}/MemoryGitMirror`;
const localBackupDir = `${HOME}/MemoryBackups`;

if (settings.env.MEMORY_GIT_MIRROR && CLOUD_RE.test(settings.env.MEMORY_GIT_MIRROR)) {
  console.error(`⚠️  MEMORY_GIT_MIRROR cũ trỏ vào cloud storage (${settings.env.MEMORY_GIT_MIRROR}) — thay bằng local (${localGitMirror}). Secret + git history KHÔNG được sync cloud.`);
}
if (settings.env.MEMORY_BACKUP_DIR && CLOUD_RE.test(settings.env.MEMORY_BACKUP_DIR)) {
  console.error(`⚠️  MEMORY_BACKUP_DIR cũ trỏ vào cloud storage (${settings.env.MEMORY_BACKUP_DIR}) — thay bằng local (${localBackupDir}). Secret + git history KHÔNG được sync cloud.`);
}

settings.env.MEMORY_ROOT = VAULT;
settings.env.MEMORY_GIT_MIRROR = localGitMirror;
settings.env.MEMORY_BACKUP_DIR = localBackupDir;

writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`✅ hooks + env: ${SETTINGS}`);
