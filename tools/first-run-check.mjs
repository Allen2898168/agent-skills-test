#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skillDefs = {
  admin: {
    label: "活动管理后台",
    envPath: "skills/weex-admin-ops/.env.local",
    examplePath: "skills/weex-admin-ops/.env.example",
    required: ["WEEX_ADMIN_PASSWORD", "WEEX_ADMIN_GOOGLE_CODE"],
    defaults: [{ key: "WEEX_ADMIN_USERNAME", value: "auto", note: "未配置时使用 staging 默认用户名 auto" }],
    configureExample: "node tools/configure-skill-env.mjs --skill admin --from-stdin",
  },
  fin: {
    label: "FIN Admin",
    envPath: "skills/weex-fin-admin-ops/.env.local",
    examplePath: "skills/weex-fin-admin-ops/.env.example",
    required: ["WEEX_FIN_GOOGLE_CODE"],
    defaults: [
      { key: "WEEX_FIN_CDP_URL", value: "http://127.0.0.1:9222", note: "默认 CDP 端口" },
      { key: "WEEX_FIN_CDP_AUTO_LAUNCH", value: "true", note: "登录态缺失时自动打开持久 CDP Chrome" },
    ],
    configureExample: "node tools/configure-skill-env.mjs --skill fin --from-stdin",
    authCheck: ["node", "skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs"],
    authRecovery: "node skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs --wait-for-close",
  },
  frontend: {
    label: "前端",
    envPath: "skills/weex-frontend-ops/.env.local",
    examplePath: "skills/weex-frontend-ops/.env.example",
    required: ["WEEX_FRONTEND_COMMON_PASSWORD", "WEEX_FRONTEND_ACCOUNT_DEFAULT_USERNAME"],
    defaults: [
      { key: "WEEX_FRONTEND_ENV", value: "stg", note: "默认前端环境" },
      { key: "WEEX_FRONTEND_LOGIN_TOOL_DIR", value: "", note: "留空使用 skill 内置 loginTool" },
    ],
    configureExample: "node tools/configure-skill-env.mjs --skill frontend --from-stdin",
    configCheck: ["node", "skills/weex-frontend-ops/scripts/check-auth-config.mjs"],
  },
};

function parseArgs(argv) {
  const args = { skill: "all", installDeps: true, checkFinAuth: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skill") args.skill = argv[++index] || "all";
    else if (arg === "--no-install") args.installDeps = false;
    else if (arg === "--skip-fin-auth") args.checkFinAuth = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function readEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    values[key] = trimmed.slice(index + 1).trim();
  }
  return values;
}

function isPresent(value) {
  return Boolean(value) && !/^<.*>$/.test(String(value).trim());
}

function ensureDependencies(installDeps) {
  const result = { ok: true, installed: false, missing: [], message: null };
  try {
    require("playwright");
    return result;
  } catch {
    result.missing.push("playwright");
  }
  if (!installDeps) {
    result.ok = false;
    result.message = "缺少项目依赖；运行 npm install，或重新执行本检查时不要加 --no-install。";
    return result;
  }
  const install = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  result.installed = install.status === 0;
  result.ok = install.status === 0;
  result.message = result.ok ? "已自动安装缺失项目依赖。" : (install.stderr || install.stdout || "npm install failed").trim();
  return result;
}

function checkSkill(id, def, args) {
  const envAbs = path.join(repoRoot, def.envPath);
  const exampleAbs = path.join(repoRoot, def.examplePath);
  const fileValues = readEnvFile(envAbs);
  const missing = def.required.filter(key => !isPresent(process.env[key] ?? fileValues[key]));
  const defaultsUsed = def.defaults.filter(item => !isPresent(process.env[item.key] ?? fileValues[item.key]));
  const result = {
    id,
    label: def.label,
    ok: missing.length === 0,
    envFile: fs.existsSync(envAbs),
    envPath: def.envPath,
    examplePath: def.examplePath,
    missing,
    defaultsUsed,
    configure: [
      `复制模板：cp ${def.examplePath} ${def.envPath}`,
      `或对话配置：把 ${missing.join(", ") || "需要更新的变量"} 发给 Codex，Codex 写入 ${def.envPath}`,
      `或 stdin 配置：${def.configureExample}`,
    ],
  };
  if (!fs.existsSync(exampleAbs)) {
    result.ok = false;
    result.missing.push("env example missing");
  }
  if (def.configCheck) result.configCheck = runCheck(def.configCheck);
  if (id === "fin" && args.checkFinAuth && missing.length === 0) {
    result.auth = runCheck(def.authCheck);
    if (!result.auth.ok) {
      result.ok = false;
      result.authRecovery = def.authRecovery;
      result.configure.push(`FIN 登录态恢复：${def.authRecovery}，在打开的 FIN 页面登录后关闭该页面。`);
    }
  }
  return result;
}

function runCheck(command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {}
  return {
    ok: result.status === 0 && parsed?.ok !== false,
    status: result.status,
    summary: parsed ? redactParsed(parsed) : (result.stderr || result.stdout || "").trim().slice(0, 500),
  };
}

function redactParsed(value) {
  if (Array.isArray(value)) return value.map(redactParsed);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|token|cookie|code|secret|key/i.test(key) && typeof item === "string") output[key] = "<redacted>";
    else output[key] = redactParsed(item);
  }
  return output;
}

function help() {
  return `Usage:
  node tools/first-run-check.mjs
  node tools/first-run-check.mjs --skill frontend
  node tools/first-run-check.mjs --skill fin --skip-fin-auth

Checks project dependencies, skill-local .env.local readiness, and FIN login state when applicable.`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(`${help()}\n`);
  process.exit(0);
}

const selected = args.skill === "all" ? Object.keys(skillDefs) : [args.skill];
const unknown = selected.filter(id => !skillDefs[id]);
if (unknown.length) {
  console.log(JSON.stringify({
    ok: false,
    error: `Unknown skill: ${unknown.join(", ")}`,
    allowedSkills: Object.keys(skillDefs),
  }, null, 2));
  process.exit(2);
}
const dependencies = ensureDependencies(args.installDeps);
const skills = selected.map(id => checkSkill(id, skillDefs[id], args));
const ok = dependencies.ok && skills.every(item => item.ok);

console.log(JSON.stringify({
  ok,
  dependencies,
  skills,
  nextStep: ok
    ? "依赖和配置检查通过，可以继续执行任务。"
    : "先按 configure/authRecovery 提示补齐配置或登录态；也可以把缺失值直接发给 Codex，由 Codex 写入对应 skill 的 .env.local。",
}, null, 2));
process.exitCode = ok ? 0 : 2;
