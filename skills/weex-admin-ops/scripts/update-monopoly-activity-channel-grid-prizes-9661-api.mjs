#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/update-monopoly-activity-channel-grid-prizes-9661-api.mjs

Options:
  --dry-run     Print plan only; no API writes
  --help        Show help

Behavior:
  - For Monopoly activityId=9661, updates CHANNEL config (channelType=CHANNEL) grid rewards (16 grids)
  - Replaces each grid's prizeId using prizes created in this conversation:
      - 1049 (币种-USDT)
      - 1040 (虚拟积分或资格-骰子)
      - 1037 (虚拟积分或资格-合约抵扣金)
      - 1036 (虚拟积分或资格-积分)
      - 1033 (赠金-赠金)
  - Preserves other grid fields (displayMin/displayMax/reward counts/labels).
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  return args;
}

const ACTIVITY_ID = 9661;
const TARGET_CHANNEL_TYPE = "CHANNEL";
const PRIZE_IDS = [1049, 1040, 1037, 1036, 1033];

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${activityId}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function assignPrizeIdsToGrids(grids) {
  const list = Array.isArray(grids) ? grids.map(g => ({ ...g })) : [];
  if (list.length !== 16) {
    throw new Error(`expected 16 grids, got ${list.length}`);
  }
  for (let i = 0; i < list.length; i++) {
    list[i].prizeId = PRIZE_IDS[i % PRIZE_IDS.length];
  }
  return list;
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
  const { chromium } = loadPlaywright();
  const session = await createAdminApiSession({ chromium, config });

  try {
    const detail = await getActivityDetail(session, ACTIVITY_ID);
    const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
    const idx = monopolyList.findIndex(v => String(v?.channelType) === TARGET_CHANNEL_TYPE);
    if (idx < 0) throw new Error(`channelType=${TARGET_CHANNEL_TYPE} not found in monopolyList`);

    const target = monopolyList[idx];
    const gridConfig = target?.gridConfig || {};
    const grids = gridConfig?.grids;
    const fallbackGrid = gridConfig?.fallbackGrid;

    const nextGrids = assignPrizeIdsToGrids(grids);
    const nextFallbackGrid = fallbackGrid ? { ...fallbackGrid, prizeId: PRIZE_IDS[1] } : fallbackGrid;

    const nextTarget = {
      ...target,
      gridConfig: {
        ...gridConfig,
        grids: nextGrids,
        ...(nextFallbackGrid ? { fallbackGrid: nextFallbackGrid } : {})
      }
    };
    const nextMonopolyList = [...monopolyList];
    nextMonopolyList[idx] = nextTarget;

    if (args.dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        activityId: ACTIVITY_ID,
        channelType: TARGET_CHANNEL_TYPE,
        prizeIds: PRIZE_IDS,
        gridPrizeIds: nextGrids.map(g => g.prizeId),
        fallbackPrizeId: nextFallbackGrid?.prizeId ?? null
      });
      return 0;
    }

    const updatePayload = {
      activityId: detail.activityId ?? ACTIVITY_ID,
      activityOwner: detail.activityOwner,
      configType: detail.configType,
      channelCategory: detail.channelCategory,
      guideTemplateId: detail.guideTemplateId,
      startTime: detail.startTime,
      endTime: detail.endTime,
      showUrl: detail.showUrl,
      applyConfigId: detail.applyConfigId,
      expanded: detail.expanded,
      showActivityCalendar: detail.showActivityCalendar,
      periodValidity: detail.periodValidity ?? null,
      periods: detail.periods ?? 0,
      syncCalendarFlag: detail.syncCalendarFlag ?? 0,
      syncCalendarDto: detail.syncCalendarDto ?? null,
      title: detail.title,
      subTitle: detail.subTitle,
      intro: detail.intro,
      shareContent: detail.shareContent,
      agentShareContent: detail.agentShareContent,
      type: detail.type,
      activityType: detail.activityType,
      contractTradingVolumeTaskId: detail.contractTradingVolumeTaskId ?? null,
      activityConfigI18n: detail.activityConfigI18n,
      monopolyList: nextMonopolyList
    };

    await updateActivity(session, updatePayload);

    const after = await getActivityDetail(session, ACTIVITY_ID);
    const afterTarget = (after?.monopolyList || []).find(v => String(v?.channelType) === TARGET_CHANNEL_TYPE);
    const afterPrizeIds = (afterTarget?.gridConfig?.grids || []).map(g => Number(g?.prizeId));
    if (afterPrizeIds.length !== 16) throw new Error(`verify failed: expected 16 grids after update, got ${afterPrizeIds.length}`);
    const allowed = new Set(PRIZE_IDS.map(Number));
    for (const pid of afterPrizeIds) {
      if (!allowed.has(Number(pid))) throw new Error(`verify failed: grid prizeId not in allowed set: ${pid}`);
    }

    printJson({ ok: true, activityId: ACTIVITY_ID, channelType: TARGET_CHANNEL_TYPE, updatedGridCount: afterPrizeIds.length });
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

