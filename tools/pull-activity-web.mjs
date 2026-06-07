#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activityWebDir = path.join(repoRoot, "activity-web");

function sh(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function parseArgs(argv) {
  const args = { ffOnly: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-pull") args.pull = false;
    else if (arg === "--pull") args.pull = true;
    else if (arg === "--no-ff-only") args.ffOnly = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  if (args.pull === undefined) args.pull = true;
  return args;
}

function help() {
  return `Usage:
  node tools/pull-activity-web.mjs
  node tools/pull-activity-web.mjs --no-pull

Default behavior:
  - git fetch --prune
  - git pull --ff-only (unless --no-pull)
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${help()}\n`);
    return 0;
  }
  if (!fs.existsSync(activityWebDir)) {
    process.stdout.write(JSON.stringify({ ok: false, error: "activity-web directory missing", activityWebDir }, null, 2));
    return 2;
  }
  const isRepo = sh("git", ["rev-parse", "--is-inside-work-tree"], activityWebDir);
  if (!isRepo.ok || isRepo.stdout !== "true") {
    process.stdout.write(JSON.stringify({ ok: false, error: "activity-web is not a git repo", activityWebDir }, null, 2));
    return 2;
  }

  const branch = sh("git", ["branch", "--show-current"], activityWebDir).stdout || "";
  const before = sh("git", ["rev-parse", "HEAD"], activityWebDir).stdout || "";
  const dirty = sh("git", ["status", "--porcelain=v1"], activityWebDir).stdout || "";

  const fetch = sh("git", ["fetch", "--prune"], activityWebDir);
  const upstream = branch ? `origin/${branch}` : "";
  const remoteHead = upstream ? sh("git", ["rev-parse", upstream], activityWebDir).stdout : "";

  let pulled = null;
  let after = before;
  let changedFiles = [];
  let skillUpdateHint = [];

  if (args.pull) {
    const pullArgs = ["pull"];
    if (args.ffOnly) pullArgs.push("--ff-only");
    pulled = sh("git", pullArgs, activityWebDir);
    after = sh("git", ["rev-parse", "HEAD"], activityWebDir).stdout || after;
    if (before && after && before !== after) {
      const diff = sh("git", ["diff", "--name-only", `${before}..${after}`], activityWebDir);
      changedFiles = diff.stdout ? diff.stdout.split("\n").map(v => v.trim()).filter(Boolean) : [];
    }
  }

  const addHint = (text) => {
    if (text && !skillUpdateHint.includes(text)) skillUpdateHint.push(text);
  };
  for (const file of changedFiles) {
    if (file.startsWith("activity-ui/src/views/activity/lottery/")) addHint("检测到转盘抽奖页面改动：建议复跑 lottery 相关 headless_api 流程与断言校验。");
    if (file.startsWith("activity-ui/src/api/activity/")) addHint("检测到后管 API 封装改动：建议复跑 API surface 校验与相关无头脚本 dry-run。");
    if (file.startsWith("activity-backend/src/main/java/com/activity/web/controller/")) addHint("检测到后端 controller 改动：建议复跑 API surface 校验并检查是否需要调整脚本接口路径/入参。");
  }

  const ok = fetch.ok && (!args.pull || pulled?.ok);
  process.stdout.write(JSON.stringify({
    ok,
    activityWebDir,
    branch,
    dirty: Boolean(dirty),
    dirtySummary: dirty ? dirty.split("\n").slice(0, 20) : [],
    before,
    upstream,
    remoteHead,
    fetched: fetch.ok,
    pulled: args.pull ? pulled.ok : false,
    pullStatus: args.pull ? pulled.status : null,
    changed: before && after ? before !== after : false,
    after,
    changedFiles,
    skillUpdateHint,
  }, null, 2));
  return ok ? 0 : 2;
}

process.exitCode = main();
