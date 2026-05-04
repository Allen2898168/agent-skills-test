import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export function pathsFrom(importMetaUrl) {
  const file = fileURLToPath(importMetaUrl);
  const dir = path.dirname(file);
  const skillRoot = path.resolve(dir, "..");
  return {
    file,
    dir,
    skillRoot,
    repoRoot: path.resolve(skillRoot, "../.."),
  };
}

export function adminConfig(repoRoot) {
  return {
    baseUrl: process.env.WEEX_ADMIN_BASE_URL || "https://stg-activity.weex.tech",
    username: process.env.WEEX_ADMIN_USERNAME || "auto",
    password: process.env.WEEX_ADMIN_PASSWORD || "",
    googleCode: process.env.WEEX_ADMIN_GOOGLE_CODE || "",
    imagePath: process.env.WEEX_PRIZE_IMAGE_PATH || path.join(repoRoot, "assets/default-prize-images/default-bonus-prize.webp"),
    chromePath: process.env.CHROME_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };
}

export function loadLocalEnv(repoRoot) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return false;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

export function assertAdminConfig(config) {
  if (!config.password) throw new Error("WEEX_ADMIN_PASSWORD is required");
  if (!config.googleCode) throw new Error("WEEX_ADMIN_GOOGLE_CODE is required for this staging login flow");
  if (!fs.existsSync(config.imagePath)) throw new Error(`Prize image not found: ${config.imagePath}`);
}

export function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(`Playwright is not available. Install playwright or set NODE_PATH to a runtime containing playwright. ${error.message}`);
  }
}
