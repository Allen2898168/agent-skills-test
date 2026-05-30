#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "../lib/cli.mjs";
import { parseLastJson } from "../../../../tools/lib/parse-last-json.mjs";

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/maintenance/audit-activity-nl-action-cache-match.mjs

Options:
  --help
`;
}

function parseArgs() {
  return parseFlags(process.argv.slice(2), { booleans: ["--help"] });
}

function runQuery({ repoRoot, query }) {
  const out = spawnSync(
    process.execPath,
    ["skills/weex-admin-ops/scripts/run-cached-action.mjs", "--dry-run", "--query", query],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );
  const stdout = String(out.stdout || "");
  const stderr = String(out.stderr || "");
  const json = parseLastJson(stdout) || parseLastJson(stderr) || null;
  return {
    ok: (out.status ?? 1) === 0 && Boolean(json?.ok),
    status: out.status ?? 1,
    json,
    stderrTail: stderr.trim().split("\n").slice(-3).join("\n"),
  };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const __filename = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(__filename), "../../../..");

  const cases = [
    { type: "BEGINNER_TASK", label: "新手活动", query: "给我全量配置一个新手活动", expect: ["configure_newbie_activity", "configure_beginner_task_activity"] },
    { type: "LOTTERY", label: "转盘抽奖", query: "创建一个转盘抽奖活动并全量配置", expect: ["configure_lottery_activity"] },
    { type: "TRADING_COMPETITION", label: "交易大赛", query: "配置一个交易大赛活动 全量", expect: ["configure_trading_competition_activity"] },
    { type: "RACE_COMPETITION", label: "交易竞速赛", query: "配置一个交易竞速赛活动 全量", expect: ["configure_race_competition_activity", "configure_race_activity"] },
    { type: "TRACE_PRO", label: "小活动型活动", query: "配置一个小活动型活动 全量", expect: ["configure_trace_pro_activity"] },
    { type: "CUSTOMIZED", label: "定制化活动", query: "配置一个定制化活动 全量", expect: ["configure_customized_activity"] },
    { type: "RECHARGE_TRANS_TASK", label: "充值交易活动", query: "配置一个充值交易活动 全量", expect: ["configure_recharge_trans_task_activity"] },
    { type: "AGENT", label: "人人代理活动", query: "配置一个人人代理活动 全量", expect: ["configure_agent_activity"] },
    { type: "CONTRACT_MINING", label: "合约挖矿活动", query: "配置一个合约挖矿活动 全量", expect: ["configure_contract_mining_activity"] },
    { type: "FLIP", label: "小丑牌活动", query: "配置一个小丑牌活动 全量", expect: ["configure_flip_activity"] },
    { type: "GUESS", label: "竞猜大赛", query: "配置一个竞猜大赛活动 全量", expect: ["configure_guess_activity"] },
    { type: "MONOPOLY_WORLD_CUP", label: "大富翁世界杯", query: "配置一个大富翁世界杯活动 全量", expect: ["configure_monopoly_world_cup_activity"] },
    { type: "AGENT_TRACE_PRO", label: "代理小活动", query: "配置一个代理小活动 全量", expect: ["configure_agent_trace_pro_activity"] },
  ];

  const results = [];
  for (const c of cases) {
    const r = runQuery({ repoRoot, query: c.query });
    const hit = String(r.json?.cachedAction || "");
    results.push({
      type: c.type,
      label: c.label,
      query: c.query,
      ok: r.ok && c.expect.includes(hit),
      hit,
      expect: c.expect,
      score: r.json?.score ?? null,
      stderrTail: r.ok ? null : r.stderrTail,
    });
  }

  const ok = results.every(r => r.ok);
  printJson({ ok, mode: "headless_api", results });
  return ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}
