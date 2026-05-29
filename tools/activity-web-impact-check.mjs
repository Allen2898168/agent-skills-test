#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeActivityWebImpact,
  readChangedFilesFromGit,
  resolveActivityWebDir,
} from "./lib/activity-web-impact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage:
  node tools/activity-web-impact-check.mjs --changed-files <csv>
  node tools/activity-web-impact-check.mjs --activity-web-dir /path/to/activity-web --base origin/main --head HEAD

Options:
  --activity-web-dir <path>  activity-web repository path. Defaults to ACTIVITY_WEB_DIR, ./activity-web, or ../activity-web.
  --changed-files <csv>      comma/newline separated changed files relative to activity-web.
  --base <rev>               git diff base when --changed-files is omitted. Default origin/main.
  --head <rev>               git diff head when --changed-files is omitted. Default HEAD.
  --pretty                   print pretty JSON. Default true.
  --help                     show help.
`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--pretty") out.pretty = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      out[key] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function parseChangedFiles(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const activityWebDir = resolveActivityWebDir(repoRoot, args.activityWebDir || "");
  const changedFiles = args.changedFiles
    ? parseChangedFiles(args.changedFiles)
    : readChangedFilesFromGit(activityWebDir, {
      base: args.base || "origin/main",
      head: args.head || "HEAD",
    });

  const result = analyzeActivityWebImpact({
    repoRoot,
    activityWebDir,
    changedFiles,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 2;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
