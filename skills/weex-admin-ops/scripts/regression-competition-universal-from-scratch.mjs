#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";
import { writeResultMarkdown } from "../../../tools/lib/result-md.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run (no writes)
  node skills/weex-admin-ops/scripts/regression-competition-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-competition-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 交易大赛通用回归
  --alias-prefix <text>       default tcr
  --required-volume <n>       default 1
  --start-offset-seconds <n>  default 120
  --end-days <n>              default 30
  --cleanup                   default true; 删除创建的活动与依赖
  --confirm-run
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-run", "--cleanup"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmRun = Boolean(args.confirmRun);
  args.cleanup = args.cleanup !== false;
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "交易大赛通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "tcr";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 120;
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

function activityWindow(offsetSeconds, endDays) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function runChildJson(commandArgs, { timeoutMs = 300000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
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

async function uploadImgReplace({ baseUrl, authorization, imagePath }) {
  const bytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath) || "default.webp";
  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: "image/webp" }));
  const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/prod-api/common/uploadImgReplace`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`uploadImgReplace failed: HTTP ${response.status}`);
  if (Number(body?.code) !== 200) throw new Error(`uploadImgReplace not accepted: ${JSON.stringify({ code: body?.code, msg: body?.msg || body?.message })}`);
  if (!body?.data) throw new Error("uploadImgReplace missing data");
  return String(body.data);
}

async function productList(api) {
  const res = await api.get("/prod-api/activity/productList");
  if (res.status >= 400) throw new Error(`productList HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`productList failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const list = Array.isArray(res.body?.data) ? res.body.data : [];
  return list.map(item => String(item?.value || "")).filter(Boolean);
}

function buildRequirements({ productCodes }) {
  const codes = Array.isArray(productCodes) ? productCodes.filter(Boolean).slice(0, 2) : [];
  if (!codes.length) {
    return [{ type: "BY_PRODUCT_CODE", currencySupportType: "ALL_SUPPORTED", productCodeList: [], minLeverage: null, maxLeverage: null, orderTypeList: ["MANUAL"] }];
  }
  return [
    {
      type: "BY_PRODUCT_CODE",
      currencySupportType: "PARTIALLY_NOT_SUPPORTED",
      productCodeList: codes,
      minLeverage: null,
      maxLeverage: null,
      orderTypeList: ["MANUAL"],
    },
  ];
}

function buildDynamicBonusPoolParams({ prizeIds, picture }) {
  const [p1, p2] = prizeIds;
  return [
    {
      stageId: 1,
      minParticipant: 0,
      maxParticipant: 9,
      prizeId: null,
      prizeList: [{ prizeId: Number(p1), bonusCount: 1 }],
      unlockType: "REPLACE",
      picture,
      bonusType: null,
      bonusCode: null,
      totalBonusAmount: 10,
      totalBonusCount: null,
      dynamicsPicture: "",
      coinId: null,
      coinName: null,
      showCoinType: false,
      coinTotalBonusAmount: null,
      usdtTotalBonusAmount: null,
      virtualApplyNum: null,
      virtualTradingVolume: null,
    },
    {
      stageId: 2,
      minParticipant: 10,
      maxParticipant: 19,
      prizeId: null,
      prizeList: [{ prizeId: Number(p1), bonusCount: 1 }],
      unlockType: "REPLACE",
      picture,
      bonusType: null,
      bonusCode: null,
      totalBonusAmount: 20,
      totalBonusCount: null,
      dynamicsPicture: "",
      coinId: null,
      coinName: null,
      showCoinType: false,
      coinTotalBonusAmount: null,
      usdtTotalBonusAmount: null,
      virtualApplyNum: null,
      virtualTradingVolume: null,
    },
    {
      stageId: 3,
      minParticipant: 20,
      maxParticipant: 999999,
      prizeId: null,
      prizeList: [{ prizeId: Number(p2), bonusCount: 1 }],
      unlockType: "REPLACE",
      picture,
      bonusType: null,
      bonusCode: null,
      totalBonusAmount: 30,
      totalBonusCount: null,
      dynamicsPicture: "",
      coinId: null,
      coinName: null,
      showCoinType: false,
      coinTotalBonusAmount: null,
      usdtTotalBonusAmount: null,
      virtualApplyNum: null,
      virtualTradingVolume: null,
    },
  ];
}

function buildDynamicBonusSharingParams({ prizeIds, taskId }) {
  const [p1, p2] = prizeIds;
  return [
    {
      rankType: "TRADING",
      rankProfitTypeList: [],
      minRank: 1,
      maxRank: 1,
      prize: [
        { stageId: 1, prizeId: Number(p1), partitionType: "RATIO", bonusAmount: 1, coinId: null, coinName: null, showCoinType: false, price: null, coinBonusAmount: null },
        { stageId: 2, prizeId: Number(p1), partitionType: "RATIO", bonusAmount: 1, coinId: null, coinName: null, showCoinType: false, price: null, coinBonusAmount: null },
        { stageId: 3, prizeId: Number(p2), partitionType: "FIXED", bonusAmount: 1, coinId: null, coinName: null, showCoinType: false, price: null, coinBonusAmount: null },
      ],
      requiredVolume: null,
      bonusRatio: null,
      taskConfig: [],
      taskConfigIds: [Number(taskId)],
      requirements: [],
    },
  ];
}

async function competitionOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/competition/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function competitionOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/competition/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function competitionDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/competition/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function unbindDependencies(api, activityId, { applyConfigId = 2442 } = {}) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data;
  if (!item || detail.body?.code !== 200) throw new Error(`Activity detail failed: ${activityId}`);
  const patched = JSON.parse(JSON.stringify(item));
  patched.applyConfigId = Number(applyConfigId);
  if ("applyConfig" in patched) patched.applyConfig = { id: Number(applyConfigId) };
  const put = await api.put("/prod-api/activity/config", patched);
  return { ok: put.body?.code === 200, status: put.status, body: { code: put.body?.code ?? null, msg: put.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function attemptCleanup({ config, created }) {
  const cleanup = {
    offline: null,
    unbindActivity: null,
    deleteActivity: null,
    deleteTask: null,
    deletePrizes: [],
    deleteRegisterTemplate: null,
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });
    if (created.activityId) {
      cleanup.offline = await competitionOffline(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.unbindActivity = await unbindDependencies(api, created.activityId, { applyConfigId: 2442 }).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.deleteActivity = await competitionDelete(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.taskId) cleanup.deleteTask = await deleteTask(api, created.taskId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    for (const id of created.prizeIds || []) {
      cleanup.deletePrizes.push({ id: String(id), ...(await deletePrize(api, id).catch(err => ({ ok: false, error: err?.message || String(err) }))) });
    }
    if (created.registerTemplateId) cleanup.deleteRegisterTemplate = await deleteRegisterTemplate(api, created.registerTemplateId).catch(err => ({ ok: false, error: err?.message || String(err) }));
  } finally {
    await api?.close?.().catch(() => {});
  }
  return cleanup;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = {
    mode: "headless_api",
    activityType: "TRADING_COMPETITION",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    requiredVolume: args.requiredVolume,
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "赠金奖品x2(从零)", "交易量任务(从零)", "图片上传(uploadImgReplace)"],
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmRun) throw new Error("需要用户确认：请加 --confirm-run 后才允许执行通用回归写操作。");
  assertAdminLoginConfig(config);

  const steps = [];
  const created = {
    registerTemplateId: "",
    prizeIds: [],
    taskId: "",
    activityId: "",
    activityAlias: "",
    activityTitle: "",
  };

  let api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  let uploadedBanner = "";
  try {
    uploadedBanner = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });

    const reg = await runChildJson(["skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_register_template_from_scratch", ok: reg.ok, registerTemplateId: reg.json?.created?.id || null });
    if (!reg.ok) throw new Error(`register template create failed: ${reg.json?.error || "unknown"}`);
    created.registerTemplateId = String(reg.json?.created?.id || "");

    const p1 = await runChildJson(["skills/weex-admin-ops/scripts/create-gift-cash-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_gift_cash_prize_1_from_scratch", ok: p1.ok, prizeId: p1.json?.created?.id || null });
    if (!p1.ok) throw new Error(`gift cash prize(1) create failed: ${p1.json?.error || "unknown"}`);
    const p1id = String(p1.json?.created?.id || "");

    const p2 = await runChildJson(["skills/weex-admin-ops/scripts/create-gift-cash-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_gift_cash_prize_2_from_scratch", ok: p2.ok, prizeId: p2.json?.created?.id || null });
    if (!p2.ok) throw new Error(`gift cash prize(2) create failed: ${p2.json?.error || "unknown"}`);
    const p2id = String(p2.json?.created?.id || "");

    created.prizeIds = [p1id, p2id].filter(Boolean);
    if (created.prizeIds.length < 2) throw new Error("missing prizeIds");

    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-competition-trading-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    steps.push({ name: "create_competition_trading_volume_task_from_scratch", ok: task.ok, taskId: task.json?.created?.id || null });
    if (!task.ok) throw new Error(`task create failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);
    const subTitle = `自动化副标题_${ts.slice(-6)}`.slice(0, 120);

    const codes = await productList(api);
    const requirements = buildRequirements({ productCodes: codes });

    const payload = {
      type: "TRADING_COMPETITION",
      configType: 1,
      channelCategory: "UNIVERSAL",
      activityOwner: "auto",
      title,
      subTitle,
      showUrl: alias,
      startTime: window.start,
      endTime: window.end,
      applyConfigId: Number(created.registerTemplateId),
      applyConfig: { id: Number(created.registerTemplateId) },
      isPreApply: 0,
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      activityConfigI18n: [
        { lang: "zh_CN", title, subTitle, webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "自动化分享文案", agentShareContent: "自动化代理分享文案", intro: "<p>自动化活动规则</p>" },
        { lang: "en_US", title: "Automated trading competition regression", subTitle: "Automated subtitle", webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "Automated share content", agentShareContent: "Automated agent share content", intro: "<p>Automated rules</p>" },
      ],
      requirements,
      bonusPoolType: "DYNAMIC_TRADING",
      dynamicBonusPoolParams: buildDynamicBonusPoolParams({ prizeIds: created.prizeIds, picture: uploadedBanner }),
      dynamicBonusSharingParams: buildDynamicBonusSharingParams({ prizeIds: created.prizeIds, taskId: created.taskId }),
      hasConsolationBonus: false,
      consolationBonusParams: { rankType: null, type: null, prizeId: null, minRank: null, maxRank: null, minAmount: null, maxAmount: null },
      prizePoolIds: created.prizeIds.map(v => Number(v)),
      rankingParams: { minRank: 1, maxRank: 100 },
      virtualRankingParams: [],
      tradingType: "PERSONAL",
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_competition_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create TRADING_COMPETITION activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=TRADING_COMPETITION&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created TRADING_COMPETITION activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const taskIdFromDetail = Number(d?.dynamicBonusSharingParams?.[0]?.taskConfigIds?.[0] || 0) || 0;
    const prizePoolCount = Array.isArray(d?.prizePoolIds) ? d.prizePoolIds.length : 0;
    const verify = {
      ok: d?.type === "TRADING_COMPETITION" && Number(d?.applyConfigId || 0) > 0 && taskIdFromDetail > 0 && prizePoolCount > 0,
      checks: { type: d?.type ?? null, applyConfigId: d?.applyConfigId ?? null, taskIdFromDetail: taskIdFromDetail || null, prizePoolCount },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await competitionOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await competitionOffline(api, config, activityId);
    steps.push({ name: "offline", ok: off.ok, response: off.body });
    if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);

    let cleanup = null;
    if (args.cleanup) {
      await api.close().catch(() => {});
      cleanup = await attemptCleanup({ config, created });
      const ok = Boolean(
        cleanup.deleteActivity?.ok !== false
          && cleanup.deleteTask?.ok !== false
          && (cleanup.deletePrizes || []).every(v => v.ok)
          && cleanup.deleteRegisterTemplate?.ok !== false,
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "TRADING_COMPETITION_universal_from_scratch",
      created,
      links: [
        { label: "后台交易大赛列表", url: `${config.baseUrl}/activities/competition` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "交易大赛(TRADING_COMPETITION) 通用回归（从零配置）",
      summary: {
        ok: true,
        activityId: created.activityId,
        activityAlias: created.activityAlias,
        startTime: plan.window.start,
        endTime: plan.window.end,
        requiredVolume: args.requiredVolume,
        cleanup: args.cleanup,
      },
      links: result.links,
      steps,
      raw: { plan, created, cleanup },
    });

    printJson({ ...result, resultMd: md.filePath }, process.stdout);
    return 0;
  } catch (error) {
    const cleanup = args.cleanup ? await attemptCleanup({ config, created }).catch(err => ({ ok: false, error: err?.message || String(err) })) : null;
    if (cleanup) steps.push({ name: "cleanup_on_failure", ok: true, cleanup });
    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: "TRADING_COMPETITION_universal_from_scratch_failed",
      title: "交易大赛(TRADING_COMPETITION) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台交易大赛列表", url: `${config.baseUrl}/activities/competition` }],
      steps,
      raw: { error: error.message, created, steps, cleanup },
    });
    printJson({ ok: false, mode: "headless_api", error: error.message, created, resultMd: md.filePath }, process.stderr);
    return 1;
  } finally {
    await api?.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

