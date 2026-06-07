#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/configure-monopoly-9930-board-dice1000-api.mjs

Options:
  --activity-id <id>       default 9930
  --channels <list>        comma-separated channelType list (default: OFFICIAL_WEBSITE,CHANNEL)
  --prize-name <name>      default 自动化_骰子1000
  --display <n>            default 1000 (displayMin/displayMax/rewardDisplayCount)
  --stock <n>              default 300 (rewardRealCount)
  --daily-move-limit <n>   default 9999
  --dry-run                plan only; no writes
  --online                 also online after save (requires google code in env)
  --help                   show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help", "--online"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  args.online = Boolean(args.online);
  args.activityId = args.activityId != null ? Number(args.activityId) : 9930;
  args.prizeName = String(args.prizeName || "自动化_骰子1000").trim();
  args.channels = String(args.channels || "OFFICIAL_WEBSITE,CHANNEL")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  args.display = args.display == null ? 1000 : Number(args.display);
  args.stock = args.stock == null ? 300 : Number(args.stock);
  args.dailyMoveLimit = args.dailyMoveLimit == null ? 9999 : Number(args.dailyMoveLimit);
  if (!args.help) {
    if (!Number.isFinite(args.activityId) || args.activityId <= 0) throw new Error("--activity-id invalid");
    if (!args.prizeName || !args.prizeName.startsWith("自动化_")) throw new Error("--prize-name must start with 自动化_");
    if (!Number.isFinite(args.display) || args.display <= 0) throw new Error("--display must be > 0");
    if (!Number.isFinite(args.stock) || args.stock <= 0) throw new Error("--stock must be > 0");
    if (!Number.isFinite(args.dailyMoveLimit) || args.dailyMoveLimit <= 0) throw new Error("--daily-move-limit must be > 0");
    if (!args.channels.length) throw new Error("--channels empty");
  }
  return args;
}

async function getPrizeDetail(session, id) {
  const res = await session.get(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`prize detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`prize detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function findPrizeByName(session, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", prizeName: name });
  const res = await session.get(`/prod-api/activity/prize/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`prize list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`prize list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows.find(r => String(r?.prizeName || "") === String(name)) || null;
}

async function createPrize(session, payload) {
  const res = await session.post("/prod-api/activity/prize", payload);
  if (res.status >= 400) throw new Error(`create prize HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`create prize rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function buildPrizePayloadFromTemplate(template, { prizeName }) {
  const payload = JSON.parse(JSON.stringify(template || {}));
  for (const k of ["id", "status", "operator", "createTime", "updateTime", "onLineUsed"]) delete payload[k];
  payload.prizeName = prizeName;
  payload.prizeAlias = prizeName;
  payload.prizeNameI18 = payload.prizeNameI18 || [];
  return payload;
}

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ activityId, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function buildUpdatePayload(detail, nextMonopolyList) {
  return {
    activityId: detail.activityId,
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
    monopolyList: nextMonopolyList,
  };
}

function formatDateTimeInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function addMinutesInShanghai(minutes) {
  const ms = Date.now() + Math.max(0, Number(minutes) || 0) * 60 * 1000;
  return formatDateTimeInTimeZone(new Date(ms), "Asia/Shanghai");
}

function addDaysFromShanghaiDateTime(startText, days) {
  const m = String(startText || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const base = Date.UTC(y, mo - 1, d, h, mi, s);
  const next = new Date(base + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000);
  return formatDateTimeInTimeZone(next, "Asia/Shanghai");
}

function buildGrid(existing, { prizeId, display, stock, gridNo }) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const prizeLabel = base.prizeLabel ?? "MIDDLE";
  return {
    ...base,
    gridNo,
    prizeId: Number(prizeId),
    displayMin: Number(display),
    displayMax: Number(display),
    rewardDisplayCount: Number(display),
    rewardRealCount: Number(stock),
    prizeLabel,
    blankGridFlag: false,
  };
}

function patchBoard(item, { prizeId, display, stock, dailyMoveLimit }) {
  const next = { ...(item || {}) };
  next.boardSize = 16;
  next.startPosition = next.startPosition ?? 1;
  next.dailyMoveLimit = Number(dailyMoveLimit);
  next.maxDicePoint = next.maxDicePoint ?? 6;

  const gridConfig = next.gridConfig || {};
  const grids = Array.isArray(gridConfig.grids) ? gridConfig.grids : [];
  const patchedGrids = Array.from({ length: 16 }, (_, i) => buildGrid(grids[i], { prizeId, display, stock, gridNo: i + 1 }));
  const fallbackGrid = buildGrid(gridConfig.fallbackGrid || {}, { prizeId, display, stock, gridNo: gridConfig.fallbackGrid?.gridNo ?? 0 });

  next.gridConfig = {
    ...gridConfig,
    autoRewardEnabled: true,
    grids: patchedGrids,
    fallbackGrid,
  };
  return next;
}

async function onlineActivity(session, activityId, totp) {
  const res = await session.post("/prod-api/activity/monopoly/online", { activityId: Number(activityId), totp: String(totp || "") });
  if (res.status >= 400) throw new Error(`online HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`online rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
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
    // 1) ensure prize template exists
    let prizeId = null;
    const existing = await findPrizeByName(session, args.prizeName);
    if (existing?.id) {
      prizeId = Number(existing.id);
    } else {
      const template = await getPrizeDetail(session, 1040); // DICE template
      const payload = buildPrizePayloadFromTemplate(template, { prizeName: args.prizeName });
      if (args.dryRun) {
        // In dry-run, we don't write; keep prizeId null to indicate "will create".
        prizeId = null;
      } else {
        await createPrize(session, payload);
        const created = await findPrizeByName(session, args.prizeName);
        if (!created?.id) throw new Error("failed to create/find prize after creation");
        prizeId = Number(created.id);
      }
    }

    // 2) patch board
    const detail = await getActivityDetail(session, args.activityId);
    const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
    if (!monopolyList.length) throw new Error("monopolyList empty");

    // If we are going to online, ensure startTime is in the future (backend rejects otherwise).
    const nowShanghai = formatDateTimeInTimeZone(new Date(), "Asia/Shanghai");
    const adjustedStartTime = args.online && String(detail.startTime || "") <= nowShanghai
      ? addMinutesInShanghai(10)
      : String(detail.startTime || "");
    const adjustedEndTime = args.online && String(detail.endTime || "") && String(detail.endTime || "") <= adjustedStartTime
      ? addDaysFromShanghaiDateTime(adjustedStartTime, 30)
      : String(detail.endTime || "");

    const nextMonopolyList = monopolyList.map(item => {
      const channelType = String(item?.channelType || "");
      if (!args.channels.includes(channelType)) return item;
      return patchBoard(item, { prizeId, display: args.display, stock: args.stock, dailyMoveLimit: args.dailyMoveLimit });
    });

    const plan = {
      ok: true,
      dryRun: args.dryRun,
      activityId: args.activityId,
      showUrl: detail.showUrl || "",
      prize: { id: prizeId, name: args.prizeName, prizeSubType: "DICE" },
      channels: args.channels,
      board: { grids: 16, display: args.display, stock: args.stock, dailyMoveLimit: args.dailyMoveLimit, autoRewardEnabled: true },
      online: args.online,
      activityTime: { startTime: adjustedStartTime, endTime: adjustedEndTime },
    };

    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    const nextDetail = { ...detail, startTime: adjustedStartTime, endTime: adjustedEndTime, monopolyList: nextMonopolyList };
    await updateActivity(session, buildUpdatePayload(nextDetail, nextMonopolyList));

    // verify
    const after = await getActivityDetail(session, args.activityId);
    const verifyList = Array.isArray(after?.monopolyList) ? after.monopolyList : [];
    for (const channelType of args.channels) {
      const item = verifyList.find(v => String(v?.channelType) === String(channelType));
      if (!item) throw new Error(`verify failed: channelType missing: ${channelType}`);
      const grids = item?.gridConfig?.grids || [];
      if (!Array.isArray(grids) || grids.length !== 16) throw new Error(`verify failed: grids length != 16 for ${channelType}`);
      if (item?.gridConfig?.autoRewardEnabled !== true) throw new Error(`verify failed: autoRewardEnabled not true for ${channelType}`);
      for (const g of grids) {
        if (Number(g?.prizeId) !== Number(prizeId)) throw new Error(`verify failed: grid prizeId mismatch for ${channelType}`);
        if (Number(g?.displayMin) !== args.display || Number(g?.displayMax) !== args.display) throw new Error(`verify failed: display mismatch for ${channelType}`);
        if (Number(g?.rewardDisplayCount) !== args.display) throw new Error(`verify failed: rewardDisplayCount mismatch for ${channelType}`);
        if (Number(g?.rewardRealCount) !== args.stock) throw new Error(`verify failed: rewardRealCount mismatch for ${channelType}`);
        if (Boolean(g?.blankGridFlag) !== false) throw new Error(`verify failed: blankGridFlag mismatch for ${channelType}`);
      }
      const fb = item?.gridConfig?.fallbackGrid;
      if (!fb) throw new Error(`verify failed: fallbackGrid missing for ${channelType}`);
      if (Number(fb?.prizeId) !== Number(prizeId)) throw new Error(`verify failed: fallback prizeId mismatch for ${channelType}`);
    }

    if (args.online) {
      await onlineActivity(session, args.activityId, config.googleCode);
    }

    printJson({ ...plan, saved: true, onlined: args.online || false });
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
