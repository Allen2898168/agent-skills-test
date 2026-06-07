import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function finSkillRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadFinEnv() {
  const envPath = path.join(finSkillRoot(), ".env.local");
  if (!fs.existsSync(envPath)) return false;
  const originalKeys = new Set(Object.keys(process.env));
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (!key.startsWith("WEEX_FIN_") || originalKeys.has(key)) continue;
    process.env[key] = parseEnvValue(trimmed.slice(index + 1));
  }
  return true;
}
