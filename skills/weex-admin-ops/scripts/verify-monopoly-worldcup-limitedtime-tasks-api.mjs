#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/verify-monopoly-worldcup-limitedtime-tasks-api.mjs

Options:
  --help       Show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--help"] });
  args.help = Boolean(args.help);
  return args;
}

const DT_START = "2026-05-26 00:00:00";
const DT_END = "2026-06-30 23:59:59";
const MILESTONE_START = "2026-05-27 08:00:00";
const MILESTONE_END = "2026-06-02 23:59:59";

const TASKS = [
  { name: "报名(限时/活动开始)-虚资-骰子", requirementType: "APPLY", timeType: "DURING", awardPrizeId: 1040, verifyType: null, requiredVolume: null },
  { name: "注册(限时/活动开始)-虚资-骰子", requirementType: "REGISTER_PASS", timeType: "DURING", awardPrizeId: 1040, verifyType: null, requiredVolume: null },
  { name: "报名(限时/报名后)-虚资-骰子", requirementType: "APPLY", timeType: "AFTER", awardPrizeId: 1040, verifyType: null, requiredVolume: null },
  { name: "注册(限时/报名后)-虚资-骰子", requirementType: "REGISTER_PASS", timeType: "AFTER", awardPrizeId: 1040, verifyType: null, requiredVolume: null },
  { name: "充值(限时/报名后)-虚资-骰子", requirementType: "RECHARGE", timeType: "AFTER", awardPrizeId: 1040, verifyType: "GREATER_EQUAL", requiredVolume: 10 },
  { name: "合里程碑(基础限时/活动开始)-虚资-积分", requirementType: "TRADING_VOLUME", timeType: "DURING", awardPrizeId: 1036, verifyType: "GREATER_EQUAL", requiredVolume: 10, expectedStartTime: MILESTONE_START, expectedEndTime: MILESTONE_END },
  { name: "合里程碑(进阶限时/活动开始)-虚资-积分", requirementType: "TRADING_VOLUME", timeType: "DURING", awardPrizeId: 1036, verifyType: "GREATER_EQUAL", requiredVolume: 10, expectedStartTime: MILESTONE_START, expectedEndTime: MILESTONE_END },
  { name: "合里程碑(基础限时/报名后)-虚资-积分", requirementType: "TRADING_VOLUME", timeType: "AFTER", awardPrizeId: 1036, verifyType: "GREATER_EQUAL", requiredVolume: 10, expectedStartTime: MILESTONE_START, expectedEndTime: MILESTONE_END },
  { name: "合里程碑(进阶限时/报名后)-虚资-积分", requirementType: "TRADING_VOLUME", timeType: "AFTER", awardPrizeId: 1036, verifyType: "GREATER_EQUAL", requiredVolume: 10, expectedStartTime: MILESTONE_START, expectedEndTime: MILESTONE_END }
];

async function findTaskByName(session, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "5", activityType: "23", name });
  const res = await session.get(`/prod-api/activity/task/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`task list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows.find(row => String(row?.name || "") === String(name)) || null;
}

function assertEqual(path, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) throw new Error(`assert failed at ${path}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

function pick(obj, keys) {
  const out = {};
  for (const key of keys) out[key] = obj?.[key];
  return out;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const session = await createAdminApiSession({ config, requireApiLogin: true });

  try {
    const verified = [];
    for (const t of TASKS) {
      const row = await findTaskByName(session, t.name);
      if (!row) throw new Error(`task not found: ${t.name}`);

      const detailRes = await session.get(`/prod-api/activity/task/${row.id}`);
      if (detailRes.status >= 400) throw new Error(`task detail HTTP ${detailRes.status}`);
      if (Number(detailRes.body?.code) !== 200) throw new Error(`task detail failed: ${JSON.stringify({ id: row.id, code: detailRes.body?.code, msg: detailRes.body?.msg || detailRes.body?.message })}`);
      const data = detailRes.body?.data ?? detailRes.body;

      assertEqual("resetType", data?.resetType, "LIMITED_TIME");
      assertEqual("activityType", data?.activityType, "MONOPOLY_WORLD_CUP");
      assertEqual("allowRange", data?.allowRange, ["NONE"]);
      assertEqual("taskRisk", data?.taskRisk, ["AUTO"]);

      const req0 = Array.isArray(data?.requirement) ? data.requirement[0] : null;
      if (!req0) throw new Error(`task requirement missing: ${t.name}`);
      assertEqual("requirement[0].type", req0?.type, t.requirementType);
      assertEqual("requirement[0].timeType", req0?.timeType, t.timeType);
      const expectedStartTime = t.expectedStartTime ?? DT_START;
      const expectedEndTime = t.expectedEndTime ?? DT_END;
      assertEqual("requirement[0].startTime", req0?.startTime, expectedStartTime);
      assertEqual("requirement[0].endTime", req0?.endTime, expectedEndTime);
      assertEqual("requirement[0].verifyType", req0?.verifyType ?? null, t.verifyType);
      assertEqual("requirement[0].requiredVolume", req0?.requiredVolume ?? null, t.requiredVolume);

      if (t.requirementType === "TRADING_VOLUME") {
        assertEqual("requirement[0].volumeCountType", req0?.volumeCountType, ["FEE"]);
        assertEqual("requirement[0].orderTypeList", req0?.orderTypeList, []);
      }

      const award = data?.taskAward;
      if (!award) throw new Error(`taskAward missing: ${t.name}`);
      assertEqual("taskAward.awardPrizeId", Number(award?.awardPrizeId), t.awardPrizeId);
      assertEqual("taskAward.awardAmountMin", award?.awardAmountMin, 10);
      assertEqual("taskAward.awardAmountMax", award?.awardAmountMax, 100);

      verified.push({
        id: row.id,
        name: t.name,
        requirement: pick(req0, ["type", "timeType", "startTime", "endTime", "verifyType", "requiredVolume"]),
        award: pick(award, ["awardPrizeId", "awardAmountMin", "awardAmountMax"])
      });
    }

    printJson({ ok: true, total: TASKS.length, verifiedCount: verified.length, verified });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}
