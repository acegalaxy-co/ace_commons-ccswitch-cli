#!/usr/bin/env node
// count-hooks.mjs — đếm hook entries MemoryOS trong settings.json (helper cho cai-dat.sh --self-check).
// argv: SETTINGS_PATH VAULT
import { readFileSync } from 'node:fs';

const [, , SETTINGS, VAULT] = process.argv;
const VAULT_MARK = `${VAULT}/tools/`;
const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
let count = 0;
for (const ev of Object.values(settings.hooks || {})) {
  for (const entry of ev) {
    for (const h of entry.hooks || []) {
      if ((h.command || '').includes(VAULT_MARK)) count++;
    }
  }
}
console.log(count);
