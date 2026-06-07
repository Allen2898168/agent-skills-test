#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config FLIP with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    optional; if omitted, auto-pick first FLIP activity as template baseline
  --title-prefix <text>       default 小丑牌活动全配
  --alias-prefix <text>       default flip
  --start-offset-seconds <n>  default 1800 (30min)
  --end-days <n>              default 30
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run", "--confirm-create", "--confirm-full-verify", "--cleanup", "--confirm-cleanup"],
  });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.confirmFullVerify = Boolean(args.confirmFullVerify);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.verifyLevel = args.verifyLevel ? String(args.verifyLevel) : "min";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "小丑牌活动全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "flip";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  return args;
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

function activityWindow(offsetSeconds = 1800, endDays = 30) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function runChildJson(commandArgs, { timeoutMs = 300000, envOverrides = {} } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, Math.max(30000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({ ok: code === 0 && Boolean(parsed?.ok !== false), code, killedByTimeout, stdout, stderr, json: parsed });
    });
  });
}

function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function rebindApplyTemplateToDefault(api, activityId, { defaultApplyConfigId = 2442 } = {}) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data || null;
  if (!item || detail.body?.code !== 200) return { ok: false, skipped: true, reason: "detail_unavailable", detail: { status: detail.status, code: detail.body?.code ?? null, msg: detail.body?.msg || "" } };
  const patched = { ...item, applyConfigId: Number(defaultApplyConfigId) };
  if ("registerTemplateId" in patched) patched.registerTemplateId = Number(defaultApplyConfigId);
  const put = await api.put("/prod-api/activity/config", patched);
  return { ok: put.body?.code === 200, status: put.status, body: { code: put.body?.code ?? null, msg: put.body?.msg || "" } };
}

async function resolveTemplate(api, templateAlias) {
  if (templateAlias) {
    const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=FLIP&showUrl=${encodeURIComponent(templateAlias)}`);
    const row = firstRow(list);
    const id = row?.activityId || row?.id;
    if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
    const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
    if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
    return { id: String(id), alias: templateAlias, detail: detail.body.data };
  }
  const list = await api.get("/prod-api/activity/config/list?pageNum=1&pageSize=1&type=FLIP");
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error("未找到可用于 clone 的 FLIP 活动模板（活动列表为空）；请先在后管创建至少 1 个小丑牌活动。");
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: String(detail.body.data?.showUrl || row?.showUrl || ""), detail: detail.body.data };
}

function patchTopLevelI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (Array.isArray(payload[i18Key])) {
    payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
  }
}

function patchIntro(payload, intro) {
  payload.intro = intro;
  patchTopLevelI18(payload, "intro", intro);
}

function patchFlips(payload, created) {
  const flips = Array.isArray(payload.flips) ? payload.flips : [];
  if (!flips.length) throw new Error("Template missing flips[]; cannot build FLIP payload");
  for (const flip of flips) {
    if (!flip || typeof flip !== "object") continue;
    if (!flip.channelType) flip.channelType = "NONE";
    if (typeof flip.jokerMultiplier === "number" && flip.jokerMultiplier <= 0) flip.jokerMultiplier = 1;
    if (flip.jokerMultiplier === null || flip.jokerMultiplier === undefined) flip.jokerMultiplier = 1;

    if (!flip.cardTask || typeof flip.cardTask !== "object") flip.cardTask = {};
    if (!flip.cardTask.introduction) flip.cardTask.introduction = "自动化-抽牌任务介绍";
    if (Array.isArray(flip.cardTask.introductionI18)) flip.cardTask.introductionI18 = flip.cardTask.introductionI18.map(item => ({ ...item, name: flip.cardTask.introduction }));
    flip.cardTask.taskList = [{ taskId: Number(created.cardTaskId), sorted: 1 }];

    if (!flip.integralTask || typeof flip.integralTask !== "object") flip.integralTask = {};
    if (!flip.integralTask.introduction) flip.integralTask.introduction = "自动化-积分任务介绍";
    if (Array.isArray(flip.integralTask.introductionI18)) flip.integralTask.introductionI18 = flip.integralTask.introductionI18.map(item => ({ ...item, name: flip.integralTask.introduction }));
    flip.integralTask.taskList = [{ taskId: Number(created.integralTaskId), sorted: 1 }];

    // prizeInfo: prefer keep template shape but bind a created gift-cash prize for explicit deps
    if (flip.prizeInfo && typeof flip.prizeInfo === "object") {
      if (Array.isArray(flip.prizeInfo.items) && flip.prizeInfo.items.length) {
        flip.prizeInfo.items = flip.prizeInfo.items.map((item, idx) => (idx === 0 ? { ...item, prizeId: Number(created.giftCashPrizeId) } : item));
      }
    }
  }
}

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const alias = String(`${args.aliasPrefix || "flip"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix || "小丑牌活动全配"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(templateDetail);
  payload.type = "FLIP";
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  payload.applyConfigId = Number(created.applyConfigId);
  payload.showActivityCalendar = payload.showActivityCalendar ?? 1;
  patchTopLevelI18(payload, "title", title);
  patchTopLevelI18(payload, "subTitle", subTitle);
  patchIntro(payload, payload.intro || "自动化-活动内容规则");
  patchFlips(payload, created);

  return { alias, title, subTitle, window, payload };
}

async function deleteFlipActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/flip/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function offlineFlipActivity(api, activityId, config) {
  const off = await api.post("/prod-api/activity/flip/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: off.body?.code === 200, status: off.status, body: { code: off.body?.code ?? null, msg: off.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const verifyLevel = String(args.verifyLevel || "min");
  if (!["min", "full"].includes(verifyLevel)) throw new Error(`--verify-level must be min|full, got: ${verifyLevel}`);

  const plan = {
    mode: "headless_api",
    templateAlias: args.templateAlias || null,
    dependencyCreates: {
      registerTemplate: "create-register-templates-fast-api.mjs (platformScope=all; signupMode=auto; permissions=signup,view)",
      giftCashPrize: "create-prizes-fast-api.mjs (赠金/赠金 x1)",
      virtualFlipPrizes: "create-flip-virtual-prizes-fast-api.mjs (FLIP_CARD + FLIP_INTEGRAL)",
      tasks: "create-flip-task-with-prize-fast-api.mjs (card + integral)",
    },
    activity: {
      titlePrefix: args.titlePrefix,
      aliasPrefix: args.aliasPrefix,
      window: activityWindow(args.startOffsetSeconds, args.endDays),
    },
    verify: { level: verifyLevel, includes: verifyLevel === "full" ? ["draft-checks", "online", "offline"] : ["draft-checks"] },
    writes: { create: true, fullVerify: verifyLevel === "full", cleanup: Boolean(args.cleanup) },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建小丑牌活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }
  if (args.cleanup && !args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要传 --confirm-cleanup（会删除活动与依赖项）。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = {
    applyConfigId: "",
    registerTemplateId: "",
    giftCashPrizeId: "",
    virtualFlipCardPrizeId: "",
    virtualFlipIntegralPrizeId: "",
    cardTaskId: "",
    integralTaskId: "",
    activityId: "",
    activityAlias: "",
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 0) resolve template (payload baseline only)
    const template = await resolveTemplate(api, args.templateAlias);

    // 1) register template (applyConfigId)
    const ts = timestamp().slice(-6);
    const registerTemplate = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
      "--signup-modes",
      "auto",
      "--permissions",
      "signup,view",
      "--name-prefix",
      `小丑牌报名模板_${ts}`,
    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!registerTemplate.ok) throw new Error(`create-register-templates-fast-api.mjs failed: ${registerTemplate.json?.error || "unknown"}`);
    const createdTemplates = Array.isArray(registerTemplate.json?.created) ? registerTemplate.json.created : [];
    created.registerTemplateId = String(createdTemplates[0]?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.registerTemplateId) throw new Error("No register template id returned from create-register-templates-fast-api.mjs");

    // 2) gift-cash prize (for rewardRule/prizeInfo)
    const prizeRes = await runChildJson([
      "skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs",
      "--category",
      "赠金",
      "--subtype",
      "赠金",
      "--count",
      "1",
      "--name-prefix",
      `小丑牌赠金_${ts}`,
      "--alias-prefix",
      `flip_bonus_${ts}`,
      "--confirm-create",
    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!prizeRes.ok) throw new Error(`create-prizes-fast-api.mjs failed: ${prizeRes.json?.error || "unknown"}`);
    const createdPrizes = Array.isArray(prizeRes.json?.created) ? prizeRes.json.created : [];
    created.giftCashPrizeId = String(createdPrizes[0]?.id || "");
    if (!created.giftCashPrizeId) throw new Error("No prize id returned from create-prizes-fast-api.mjs");

    // 3) virtual flip prizes
    const vprizeRes = await runChildJson([
      "skills/weex-admin-ops/scripts/create-flip-virtual-prizes-fast-api.mjs",
      "--confirm-create",
    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!vprizeRes.ok) throw new Error(`create-flip-virtual-prizes-fast-api.mjs failed: ${vprizeRes.json?.error || "unknown"}`);
    const vCreated = Array.isArray(vprizeRes.json?.created) ? vprizeRes.json.created : [];
    const cardPrize = vCreated.find(item => item?.subtype === "FLIP_CARD");
    const integralPrize = vCreated.find(item => item?.subtype === "FLIP_INTEGRAL");
    created.virtualFlipCardPrizeId = String(cardPrize?.id || "");
    created.virtualFlipIntegralPrizeId = String(integralPrize?.id || "");
    if (!created.virtualFlipCardPrizeId || !created.virtualFlipIntegralPrizeId) throw new Error("Virtual flip prize ids missing from create-flip-virtual-prizes-fast-api.mjs output");

    // 4) tasks (card + integral)
    const cardTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-flip-task-with-prize-fast-api.mjs",
      "--award-subtype",
      "FLIP_CARD",
      "--award-prize-id",
      created.virtualFlipCardPrizeId,
      "--name-prefix",
      `小丑牌抽牌任务_${ts}`,
      "--tag-prefix",
      "flipc",
      "--confirm-create",
    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!cardTask.ok) throw new Error(`create-flip-task-with-prize-fast-api.mjs(card) failed: ${cardTask.json?.error || "unknown"}`);
    created.cardTaskId = String(cardTask.json?.created?.id || "");
    if (!created.cardTaskId) throw new Error("No task id returned for card task");

    const integralTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-flip-task-with-prize-fast-api.mjs",
      "--award-subtype",
      "FLIP_INTEGRAL",
      "--award-prize-id",
      created.virtualFlipIntegralPrizeId,
      "--name-prefix",
      `小丑牌积分任务_${ts}`,
      "--tag-prefix",
      "flipi",
      "--confirm-create",
    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!integralTask.ok) throw new Error(`create-flip-task-with-prize-fast-api.mjs(integral) failed: ${integralTask.json?.error || "unknown"}`);
    created.integralTaskId = String(integralTask.json?.created?.id || "");
    if (!created.integralTaskId) throw new Error("No task id returned for integral task");

    // 5) create activity
    // Child scripts may perform API logins that invalidate previously issued tokens.
    // Refresh the session before creating the activity to avoid intermittent business code=401.
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create activity failed: ${JSON.stringify({ code: create.body?.code, msg: create.body?.msg || create.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=FLIP&showUrl=${encodeURIComponent(built.alias)}`);
    const row = firstRow(verifyList);
    const activityId = row?.activityId || row?.id;
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);
    created.activityId = String(activityId);
    created.activityAlias = built.alias;

    // 6) verify
    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    if (detailRes.body?.code !== 200 || !detailRes.body?.data) throw new Error("Verify detail failed");
    const verifyDetail = detailRes.body.data;
    const flips = Array.isArray(verifyDetail.flips) ? verifyDetail.flips : [];
    const draftChecks = [
      { ok: verifyDetail.type === "FLIP", key: "type", expected: "FLIP", actual: verifyDetail.type ?? null },
      { ok: Number(verifyDetail.applyConfigId) === Number(created.applyConfigId), key: "applyConfigId", expected: created.applyConfigId, actual: verifyDetail.applyConfigId ?? null },
      { ok: flips.length >= 1, key: "flips", expected: ">=1", actual: flips.length },
      { ok: Array.isArray(flips?.[0]?.cardTask?.taskList) && flips[0].cardTask.taskList.length >= 1, key: "flips[0].cardTask.taskList", expected: ">=1", actual: flips?.[0]?.cardTask?.taskList?.length ?? null },
      { ok: Array.isArray(flips?.[0]?.integralTask?.taskList) && flips[0].integralTask.taskList.length >= 1, key: "flips[0].integralTask.taskList", expected: ">=1", actual: flips?.[0]?.integralTask?.taskList?.length ?? null },
    ];
    const minVerifyOk = draftChecks.every(item => item.ok);
    if (!minVerifyOk) throw new Error(`draft-checks failed: ${JSON.stringify(draftChecks)}`);

    const fullVerify = { online: null, offline: null };
    if (verifyLevel === "full") {
      const on = await api.post("/prod-api/activity/flip/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.online = { ok: on.body?.code === 200, code: on.body?.code ?? null, msg: on.body?.msg || "" };
      if (!fullVerify.online.ok) throw new Error(`online failed: ${JSON.stringify(fullVerify.online)}`);
      const off = await api.post("/prod-api/activity/flip/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.offline = { ok: off.body?.code === 200, code: off.body?.code ?? null, msg: off.body?.msg || "" };
      if (!fullVerify.offline.ok) throw new Error(`offline failed: ${JSON.stringify(fullVerify.offline)}`);
    }

    const cleanup = { rebindApplyTemplate: null, activity: null, tasks: [], prizes: [], registerTemplate: null };
    if (args.cleanup) {
      cleanup.rebindApplyTemplate = await rebindApplyTemplateToDefault(api, activityId, { defaultApplyConfigId: 2442 }).catch(err => ({
        ok: false,
        error: err?.message || String(err),
      }));
      await offlineFlipActivity(api, activityId, config).catch(() => null);
      cleanup.activity = await deleteFlipActivity(api, activityId, config);
      cleanup.tasks.push(await deleteTask(api, created.cardTaskId));
      cleanup.tasks.push(await deleteTask(api, created.integralTaskId));
      cleanup.prizes.push(await deletePrize(api, created.virtualFlipCardPrizeId));
      cleanup.prizes.push(await deletePrize(api, created.virtualFlipIntegralPrizeId));
      cleanup.prizes.push(await deletePrize(api, created.giftCashPrizeId));
      let delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      for (let attempt = 1; !delRegister.ok && attempt <= 3; attempt++) {
        const msg = String(delRegister?.body?.msg || "");
        if (!msg.includes("该报名模版已经被(") || !msg.includes(")使用")) break;
        await sleepMs(1200 * attempt);
        delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      }
      cleanup.registerTemplate = delRegister;
      if (!cleanup.activity?.ok) throw new Error(`cleanup activity failed: ${JSON.stringify(cleanup.activity)}`);
    }

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/jokerCard/index`,
      plan,
      template: { id: template.id, alias: template.alias },
      created,
      draftChecks,
      fullVerify,
      cleanup,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    if (api) await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}
