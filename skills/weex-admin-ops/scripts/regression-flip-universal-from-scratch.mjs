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
  node skills/weex-admin-ops/scripts/regression-flip-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-flip-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 小丑牌通用回归
  --alias-prefix <text>       default flipr
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "小丑牌通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "flipr";
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

function buildCardTypes() {
  return [
    { type: "ROYAL_FLUSH", describe: "同一花色的 A-K-Q-J-10", describeI18: [], chip: 200, ratio: 12, balanceFactor: 1, penaltyMultiplier: 0.0004 },
    { type: "STRAIGHT_FLUSH", describe: "同一花色的连续五张牌", describeI18: [], chip: 100, ratio: 8, balanceFactor: 1, penaltyMultiplier: 0.0012 },
    { type: "FOUR_OF_A_KIND", describe: "五张牌有四张相同点数的牌", describeI18: [], chip: 60, ratio: 7, balanceFactor: 1, penaltyMultiplier: 0.0024 },
    { type: "FULL_HOUSE", describe: "三张相同点数 +两张相同点数", describeI18: [], chip: 40, ratio: 4, balanceFactor: 1, penaltyMultiplier: 0.0062 },
    { type: "FLUSH", describe: "五张同花色但不连续", describeI18: [], chip: 35, ratio: 4, balanceFactor: 1, penaltyMultiplier: 0.0071 },
    { type: "STRAIGHT", describe: "五张连续点数，花色不同", describeI18: [], chip: 30, ratio: 4, balanceFactor: 1, penaltyMultiplier: 0.0083 },
    { type: "THREE_OF_A_KIND", describe: "三张相同点数的牌", describeI18: [], chip: 30, ratio: 3, balanceFactor: 1, penaltyMultiplier: 0.011 },
    { type: "TWO_PAIR", describe: "两组对子", describeI18: [], chip: 20, ratio: 2, balanceFactor: 1, penaltyMultiplier: 0.0244 },
    { type: "ONE_PAIR", describe: "一组对子", describeI18: [], chip: 10, ratio: 2, balanceFactor: 1, penaltyMultiplier: 0.0476 },
    { type: "HIGH_CARD", describe: "无顺、无对子，按最大牌定胜负", describeI18: [], chip: 5, ratio: 1, balanceFactor: 0, penaltyMultiplier: null },
  ];
}

function buildFlipConfig({ cardTaskId, integralTaskId, giftCashPrizeId }) {
  return {
    inningDay: 1,
    inningPeriod: 0,
    jokerMultiplier: 1,
    channelType: "NONE",
    cardType: buildCardTypes(),
    cardTask: {
      introduction: "自动化-抽牌任务介绍",
      introductionI18: [{ lang: "zh_CN", name: "自动化-抽牌任务介绍" }],
      taskList: [{ taskId: Number(cardTaskId), sorted: 1 }],
    },
    integralTask: {
      introduction: "自动化-积分任务介绍",
      introductionI18: [{ lang: "zh_CN", name: "自动化-积分任务介绍" }],
      taskList: [{ taskId: Number(integralTaskId), sorted: 1 }],
    },
    prizeInfo: {
      tabName: "奖池",
      tabNameI18: [{ lang: "zh_CN", name: "奖池" }],
      items: [
        {
          name: "初级奖池",
          nameI18: [{ lang: "en_US", name: "Bronze pool" }],
          prizeId: Number(giftCashPrizeId),
          amount: 1000,
          showAmount: 100,
          verifyType: "GREATER_EQUAL",
          requiredVolume: 0,
          limit: 999999,
        },
      ],
    },
    luckyConfig: [],
    luckyPackage: null,
    buffConfig: [],
    criticalHit: { n: 0, tradingVolumeUpper: [] },
    rankInfo: {},
    playRules: { rules: "<p>自动化规则</p>", rulesI18: [] },
    descriptionContent: {},
  };
}

async function flipOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/flip/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function flipOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/flip/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function flipDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/flip/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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
    deleteTasks: [],
    deletePrizes: [],
    deleteRegisterTemplate: null,
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });
    if (created.activityId) {
      cleanup.offline = await flipOffline(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.unbindActivity = await unbindDependencies(api, created.activityId, { applyConfigId: 2442 }).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.deleteActivity = await flipDelete(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    for (const id of [created.cardTaskId, created.integralTaskId]) {
      if (!id) continue;
      cleanup.deleteTasks.push({ id: String(id), ...(await deleteTask(api, id).catch(err => ({ ok: false, error: err?.message || String(err) }))) });
    }
    for (const id of [created.giftCashPrizeId, created.virtualFlipCardPrizeId, created.virtualFlipIntegralPrizeId]) {
      if (!id) continue;
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
    activityType: "FLIP",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "赠金奖品(从零)", "小丑牌虚拟奖品(从零)", "小丑牌邀请任务(从零)", "图片上传(uploadImgReplace)"],
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
    applyConfigId: "",
    giftCashPrizeId: "",
    virtualFlipCardPrizeId: "",
    virtualFlipIntegralPrizeId: "",
    cardTaskId: "",
    integralTaskId: "",
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
    created.applyConfigId = created.registerTemplateId;

    const giftCash = await runChildJson(["skills/weex-admin-ops/scripts/create-gift-cash-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_gift_cash_prize_from_scratch", ok: giftCash.ok, prizeId: giftCash.json?.created?.id || null });
    if (!giftCash.ok) throw new Error(`gift cash prize create failed: ${giftCash.json?.error || "unknown"}`);
    created.giftCashPrizeId = String(giftCash.json?.created?.id || "");
    if (!created.giftCashPrizeId) throw new Error("missing giftCashPrizeId");

    const vprizes = await runChildJson(["skills/weex-admin-ops/scripts/create-flip-virtual-prizes-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_flip_virtual_prizes", ok: vprizes.ok, created: vprizes.json?.created || null });
    if (!vprizes.ok) throw new Error(`virtual prizes create failed: ${vprizes.json?.error || "unknown"}`);
    const vCreated = Array.isArray(vprizes.json?.created) ? vprizes.json.created : [];
    created.virtualFlipCardPrizeId = String(vCreated.find(item => item?.subtype === "FLIP_CARD")?.id || "");
    created.virtualFlipIntegralPrizeId = String(vCreated.find(item => item?.subtype === "FLIP_INTEGRAL")?.id || "");
    if (!created.virtualFlipCardPrizeId || !created.virtualFlipIntegralPrizeId) throw new Error("missing virtual flip prize ids");

    const cardTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-flip-invite-task-from-scratch-fast-api.mjs",
      "--award-subtype",
      "FLIP_CARD",
      "--award-prize-id",
      String(created.virtualFlipCardPrizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_flip_card_task_from_scratch", ok: cardTask.ok, taskId: cardTask.json?.created?.id || null });
    if (!cardTask.ok) throw new Error(`flip card task create failed: ${cardTask.json?.error || "unknown"}`);
    created.cardTaskId = String(cardTask.json?.created?.id || "");

    const integralTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-flip-invite-task-from-scratch-fast-api.mjs",
      "--award-subtype",
      "FLIP_INTEGRAL",
      "--award-prize-id",
      String(created.virtualFlipIntegralPrizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_flip_integral_task_from_scratch", ok: integralTask.ok, taskId: integralTask.json?.created?.id || null });
    if (!integralTask.ok) throw new Error(`flip integral task create failed: ${integralTask.json?.error || "unknown"}`);
    created.integralTaskId = String(integralTask.json?.created?.id || "");

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);
    const subTitle = `自动化副标题_${ts.slice(-6)}`.slice(0, 120);

    const payload = {
      type: "FLIP",
      configType: 1,
      channelCategory: "UNIVERSAL",
      activityOwner: "auto",
      title,
      subTitle,
      showUrl: alias,
      startTime: window.start,
      endTime: window.end,
      applyConfigId: Number(created.applyConfigId),
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      activityConfigI18n: [
        { lang: "zh_CN", title, subTitle, webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "自动化分享文案", agentShareContent: "自动化代理分享文案", intro: "<p>自动化活动规则</p>" },
        { lang: "en_US", title: "Automated flip regression", subTitle: "Automated subtitle", webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "Automated share content", agentShareContent: "Automated agent share content", intro: "<p>Automated rules</p>" },
      ],
      flips: [buildFlipConfig({ cardTaskId: created.cardTaskId, integralTaskId: created.integralTaskId, giftCashPrizeId: created.giftCashPrizeId })],
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_flip_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create flip activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=FLIP&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created flip activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const flips = Array.isArray(d?.flips) ? d.flips : [];
    const flip0 = flips[0] || null;
    const cardTaskIdFromDetail = Number(flip0?.cardTask?.taskList?.[0]?.taskId || 0) || 0;
    const integralTaskIdFromDetail = Number(flip0?.integralTask?.taskList?.[0]?.taskId || 0) || 0;
    const prizeIdFromDetail = Number(flip0?.prizeInfo?.items?.[0]?.prizeId || 0) || 0;
    const verify = {
      ok: d?.type === "FLIP" && Boolean(d?.applyConfigId) && flips.length > 0 && cardTaskIdFromDetail > 0 && integralTaskIdFromDetail > 0 && prizeIdFromDetail > 0,
      checks: {
        type: d?.type ?? null,
        applyConfigId: d?.applyConfigId ?? null,
        flipsCount: flips.length,
        cardTaskIdFromDetail: cardTaskIdFromDetail || null,
        integralTaskIdFromDetail: integralTaskIdFromDetail || null,
        prizeIdFromDetail: prizeIdFromDetail || null,
      },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await flipOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await flipOffline(api, config, activityId);
    steps.push({ name: "offline", ok: off.ok, response: off.body });
    if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);

    let cleanup = null;
    if (args.cleanup) {
      await api.close().catch(() => {});
      cleanup = await attemptCleanup({ config, created });
      const ok = Boolean(
        cleanup.deleteActivity?.ok !== false
          && (cleanup.deleteTasks || []).every(v => v.ok)
          && (cleanup.deletePrizes || []).every(v => v.ok)
          && cleanup.deleteRegisterTemplate?.ok !== false,
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "FLIP_universal_from_scratch",
      created,
      links: [
        { label: "后台小丑牌列表", url: `${config.baseUrl}/activities/jokerCard/index` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "小丑牌(FLIP) 通用回归（从零配置）",
      summary: {
        ok: true,
        activityId: created.activityId,
        activityAlias: created.activityAlias,
        startTime: plan.window.start,
        endTime: plan.window.end,
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
      caseId: "FLIP_universal_from_scratch_failed",
      title: "小丑牌(FLIP) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台小丑牌列表", url: `${config.baseUrl}/activities/jokerCard/index` }],
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

