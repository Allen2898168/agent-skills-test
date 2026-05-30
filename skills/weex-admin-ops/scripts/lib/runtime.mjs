import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireProjectDependency } from "./dependencies.mjs";

export function pathsFrom(importMetaUrl) {
  const file = String(importMetaUrl).startsWith("file:")
    ? fileURLToPath(importMetaUrl)
    : path.resolve(String(importMetaUrl));
  const dir = path.dirname(file);
  const skillRoot = path.resolve(dir, "..");
  const repoRoot = path.basename(path.dirname(skillRoot)) === "skills"
    ? path.resolve(skillRoot, "../..")
    : skillRoot;
  return {
    file,
    dir,
    skillRoot,
    repoRoot,
  };
}

export function adminConfig(repoRoot) {
  const skillRoot = fs.existsSync(path.join(repoRoot, "SKILL.md"))
    ? repoRoot
    : path.join(repoRoot, "skills/weex-admin-ops");
  return {
    baseUrl: process.env.WEEX_ADMIN_BASE_URL || "https://stg-activity.weex.tech",
    username: process.env.WEEX_ADMIN_USERNAME || "auto",
    password: process.env.WEEX_ADMIN_PASSWORD || "",
    googleCode: process.env.WEEX_ADMIN_GOOGLE_CODE || "",
    imagePath: process.env.WEEX_PRIZE_IMAGE_PATH || path.join(skillRoot, "assets/default-prize-images/default-bonus-prize.webp"),
    chromePath: process.env.CHROME_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    useExistingChrome: process.env.WEEX_ADMIN_USE_EXISTING_CHROME === "1",
    chromeCdpUrl: process.env.WEEX_ADMIN_CHROME_CDP_URL || "http://127.0.0.1:9222",
  };
}

export function loadLocalEnv(repoRoot) {
  const skillRoot = fs.existsSync(path.join(repoRoot, "SKILL.md"))
    ? repoRoot
    : path.join(repoRoot, "skills/weex-admin-ops");
  const envPath = path.join(skillRoot, ".env.local");
  if (!fs.existsSync(envPath)) return false;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    if (!isAllowedAdminEnvKey(key)) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env) || process.env[key] === "") process.env[key] = value;
  }
  return true;
}

function isAllowedAdminEnvKey(key) {
  return key.startsWith("WEEX_ADMIN_") || key.startsWith("WEEX_PRIZE_") || key === "CHROME_EXECUTABLE_PATH";
}

export function assertAdminConfig(config) {
  if (!config.password) throw new Error("WEEX_ADMIN_PASSWORD is required");
  if (!config.googleCode) throw new Error("WEEX_ADMIN_GOOGLE_CODE is required for this staging login flow");
  if (!fs.existsSync(config.imagePath)) throw new Error(`Prize image not found: ${config.imagePath}`);
}

export function assertAdminLoginConfig(config) {
  if (!config.password) throw new Error("WEEX_ADMIN_PASSWORD is required");
  if (!config.googleCode) throw new Error("WEEX_ADMIN_GOOGLE_CODE is required for this staging login flow");
}

export function loadPlaywright() {
  return requireProjectDependency("playwright");
}
