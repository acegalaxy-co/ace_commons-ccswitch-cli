#!/usr/bin/env node
// check-env.mjs — verify env keys MemoryOS trong settings.json đúng giá trị (helper --self-check).
// argv: SETTINGS_PATH VAULT HOME
import { readFileSync } from 'node:fs';

const [, , SETTINGS, VAULT, HOME] = process.argv;
const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
const env = settings.env || {};

const expect = {
  MEMORY_ROOT: VAULT,
  MEMORY_GIT_MIRROR: `${HOME}/MemoryGitMirror`,
  MEMORY_BACKUP_DIR: `${HOME}/MemoryBackups`,
};

let ok = true;
for (const [k, v] of Object.entries(expect)) {
  if (env[k] !== v) {
    console.error(`env.${k} = ${env[k]} (kỳ vọng ${v})`);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
