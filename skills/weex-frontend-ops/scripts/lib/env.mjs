import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function skillRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function repoRoot() {
  return path.resolve(skillRoot(), '..', '..');
}

function loadEnvFile(filePath, originalKeys) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!key.startsWith('WEEX_FRONTEND_')) continue;
    if (originalKeys.has(key)) continue;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function loadFrontendEnv() {
  const originalKeys = new Set(Object.keys(process.env));
  loadEnvFile(path.join(skillRoot(), '.env.local'), originalKeys);
}

export function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|y)$/i.test(value);
}

export function isPlaceholder(value) {
  return !value || /^<.*>$/.test(String(value).trim());
}
