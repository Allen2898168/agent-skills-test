#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const allowed = {
  admin: {
    envPath: "skills/weex-admin-ops/.env.local",
    prefixes: ["WEEX_ADMIN_", "WEEX_PRIZE_"],
    exact: ["CHROME_EXECUTABLE_PATH"],
  },
  fin: {
    envPath: "skills/weex-fin-admin-ops/.env.local",
    prefixes: ["WEEX_FIN_"],
    exact: [],
  },
  frontend: {
    envPath: "skills/weex-frontend-ops/.env.local",
    prefixes: ["WEEX_FRONTEND_"],
    exact: [],
  },
};

function parseArgs(argv) {
  const args = { values: {}, fromStdin: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skill") args.skill = argv[++index];
    else if (arg === "--set") {
      const pair = argv[++index] || "";
      const eq = pair.indexOf("=");
      if (eq < 1) throw new Error("--set expects KEY=VALUE");
      args.values[pair.slice(0, eq)] = pair.slice(eq + 1);
    } else if (arg === "--from-stdin") args.fromStdin = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function readStdinJson() {
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) return {};
  return JSON.parse(input);
}

function parseEnv(filePath) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const values = {};
  for (const line of lines) {
    const index = line.indexOf("=");
    if (index < 1 || line.trim().startsWith("#")) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1);
  }
  return values;
}

function isAllowed(key, rule) {
  return rule.exact.includes(key) || rule.prefixes.some(prefix => key.startsWith(prefix));
}

function serialize(values) {
  return `${Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${escapeValue(value)}`)
    .join("\n")}\n`;
}

function escapeValue(value) {
  const stringValue = String(value ?? "");
  if (!/[#\n\r"' ]/.test(stringValue)) return stringValue;
  return JSON.stringify(stringValue);
}

function help() {
  return `Usage:
  node tools/configure-skill-env.mjs --skill frontend --from-stdin
  node tools/configure-skill-env.mjs --skill fin --from-stdin

Paste a JSON object on stdin, then press Ctrl-D. Use --set only for non-sensitive values because CLI arguments may be stored in shell history.`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(`${help()}\n`);
  process.exit(0);
}
const rule = allowed[args.skill];
if (!rule) throw new Error("--skill must be one of admin, fin, frontend");
const values = { ...args.values, ...(args.fromStdin ? readStdinJson() : {}) };
const invalid = Object.keys(values).filter(key => !isAllowed(key, rule));
if (invalid.length) throw new Error(`Variables not allowed for ${args.skill}: ${invalid.join(", ")}`);

const envPath = path.join(repoRoot, rule.envPath);
fs.mkdirSync(path.dirname(envPath), { recursive: true });
const existing = parseEnv(envPath);
const next = { ...existing, ...values };
fs.writeFileSync(envPath, serialize(next));

console.log(JSON.stringify({
  ok: true,
  skill: args.skill,
  envPath: rule.envPath,
  updatedKeys: Object.keys(values).sort(),
  valuesPrinted: false,
}, null, 2));
