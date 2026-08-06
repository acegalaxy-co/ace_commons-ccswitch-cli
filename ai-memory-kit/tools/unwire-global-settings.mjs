#!/usr/bin/env node
// unwire-global-settings.mjs — gỡ hook + env MemoryOS khỏi ~/.claude/settings.json.
// Dùng bởi cai-dat.sh --go-remove. argv: VAULT SETTINGS_PATH
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [, , VAULT, SETTINGS] = process.argv;
if (!VAULT || !SETTINGS) {
  console.error('usage: unwire-global-settings.mjs <VAULT> <SETTINGS_PATH>');
  process.exit(1);
}
if (!existsSync(SETTINGS)) process.exit(0);

const VAULT_MARK = `${VAULT}/tools/`;
const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));

settings.hooks = settings.hooks || {};
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = (settings.hooks[ev] || []).filter((entry) => {
    const cmds = (entry.hooks || []).map((h) => h.command || '');
    return !cmds.some((c) => c.includes(VAULT_MARK) || c.includes('ai-memory-kit'));
  });
  if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
}

if (settings.env) {
  for (const k of ['MEMORY_ROOT', 'MEMORY_GIT_MIRROR', 'MEMORY_BACKUP_DIR']) {
    delete settings.env[k];
  }
  if (Object.keys(settings.env).length === 0) delete settings.env;
}

writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log('✅ gỡ hook + env MemoryOS khỏi settings.json');
