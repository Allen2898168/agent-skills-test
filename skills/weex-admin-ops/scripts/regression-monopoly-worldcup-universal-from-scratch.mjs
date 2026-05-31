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
  node skills/weex-admin-ops/scripts/regression-monopoly-worldcup-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-monopoly-worldcup-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 大富翁通用回归
  --alias-prefix <text>       default mwcr
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "大富翁通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "mwcr";
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

function buildMonopolyList({ dailyDiceTaskId, integralPrizeId, noRewardPrizeId }) {
  const grids = Array.from({ length: 16 }, (_, i) => ({
    gridNo: i + 1,
    prizeId: Number(noRewardPrizeId),
    displayMin: 0,
    displayMax: 0,
    rewardDisplayCount: 0,
    rewardRealCount: 0,
    prizeLabel: "",
    blankGridFlag: true,
  }));
  return [
    {
      channelType: 1,
      boardSize: 16,
      startPosition: 1,
      dailyMoveLimit: 20,
      maxDicePoint: 6,
      gridConfig: {
        autoRewardEnabled: true,
        grids,
        fallbackGrid: { prizeId: Number(noRewardPrizeId), displayMin: 0, displayMax: 0, rewardDisplayCount: 0, rewardRealCount: 0, prizeLabel: "", blankGridFlag: true },
      },
      pointPoolPrizeList: [{ prizeId: Number(integralPrizeId), total: 1, sort: 1 }],
      taskConfig: {
        dailyTask: { moduleIntro: "", moduleIntroI18: [], tasks: [{ taskId: Number(dailyDiceTaskId), sort: 1 }] },
      },
      riskConfig: { thresholds: [{ minValue: 40, maxValue: 40, ratio: 10 }] },
      extraInfo: { descriptionContent: {} },
    },
  ];
}

async function online(api, config, activityId) {
  const res = await api.post("/prod-api/activity/monopoly/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function offline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/monopoly/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteActivity(api, config, activityId) {
  const res = await api.post("/prod-api/activity/monopoly/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
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
      cleanup.offline = await offline(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.unbindActivity = await unbindDependencies(api, created.activityId, { applyConfigId: 2442 }).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.deleteActivity = await deleteActivity(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.dailyDiceTaskId) cleanup.deleteTask = await deleteTask(api, created.dailyDiceTaskId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    for (const id of [created.dicePrizeId, created.integralPrizeId, created.noRewardPrizeId]) {
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
    activityType: "MONOPOLY_WORLD_CUP",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    requiredVolume: args.requiredVolume,
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "虚拟奖品(从零)", "每日合约交易任务(从零)", "图片上传(uploadImgReplace)"],
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
    dicePrizeId: "",
    integralPrizeId: "",
    noRewardPrizeId: "",
    dailyDiceTaskId: "",
    activityId: "",
    activityAlias: "",
    activityTitle: "",
  };

  let api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  let uploadedBanner = "";
  try {
    uploadedBanner = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });

    const reg = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs",
      "--participant-mode",
      "MANUAL",
      "--confirm-create",
    ]);
    steps.push({ name: "create_register_template_from_scratch", ok: reg.ok, registerTemplateId: reg.json?.created?.id || null });
    if (!reg.ok) throw new Error(`register template create failed: ${reg.json?.error || "unknown"}`);
    created.registerTemplateId = String(reg.json?.created?.id || "");

    const prizes = await runChildJson(["skills/weex-admin-ops/scripts/create-monopoly-worldcup-virtual-prizes-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_virtual_prizes", ok: prizes.ok, created: prizes.json?.created || null });
    if (!prizes.ok) throw new Error(`prizes create failed: ${prizes.json?.error || "unknown"}`);
    const bySubtype = {};
    for (const item of (prizes.json?.created || [])) bySubtype[String(item?.prizeSubType || "")] = String(item?.id || "");
    created.dicePrizeId = bySubtype.DICE || "";
    created.integralPrizeId = bySubtype.INTEGRAL || "";
    created.noRewardPrizeId = bySubtype.NO_REWARD || "";
    if (!created.dicePrizeId || !created.integralPrizeId || !created.noRewardPrizeId) throw new Error("missing created prize ids (DICE/INTEGRAL/NO_REWARD)");

    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-monopoly-worldcup-daily-dice-task-from-scratch-fast-api.mjs",
      "--dice-prize-id",
      String(created.dicePrizeId),
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    steps.push({ name: "create_daily_dice_task_from_scratch", ok: task.ok, taskId: task.json?.created?.id || null });
    if (!task.ok) throw new Error(`task create failed: ${task.json?.error || "unknown"}`);
    created.dailyDiceTaskId = String(task.json?.created?.id || "");

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);
    const subTitle = `自动化副标题_${ts.slice(-6)}`.slice(0, 120);

    const payload = {
      type: "MONOPOLY_WORLD_CUP",
      activityType: 23,
      configType: 1,
      channelCategory: "UNIVERSAL",
      title,
      subTitle,
      showUrl: alias,
      startTime: window.start,
      endTime: window.end,
      applyConfigId: Number(created.registerTemplateId),
      showActivityCalendar: 0,
      syncCalendarFlag: 0,
      contractTradingVolumeTaskId: Number(created.dailyDiceTaskId),
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      activityConfigI18n: [
        { lang: "zh_CN", title, subTitle, webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "自动化分享文案", agentShareContent: "自动化代理分享文案", intro: "<p>自动化活动规则</p>" },
        { lang: "en_US", title: "Automated monopoly regression", subTitle: "Automated subtitle", webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "Automated share content", agentShareContent: "Automated agent share content", intro: "<p>Automated rules</p>" },
      ],
      monopolyList: buildMonopolyList({
        dailyDiceTaskId: created.dailyDiceTaskId,
        integralPrizeId: created.integralPrizeId,
        noRewardPrizeId: created.noRewardPrizeId,
      }),
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_monopoly_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=MONOPOLY_WORLD_CUP&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const dailyTaskIdFromDetail =
      Number(d?.contractTradingVolumeTaskId || 0)
      || Number(d?.monopolyList?.[0]?.taskConfig?.dailyTask?.tasks?.[0]?.taskId || 0)
      || 0;
    const verify = {
      ok: d?.type === "MONOPOLY_WORLD_CUP" && Boolean(d?.applyConfigId) && Array.isArray(d?.monopolyList) && dailyTaskIdFromDetail > 0,
      checks: {
        type: d?.type ?? null,
        applyConfigId: d?.applyConfigId ?? null,
        monopolyListCount: Array.isArray(d?.monopolyList) ? d.monopolyList.length : null,
        dailyTaskIdFromDetail: dailyTaskIdFromDetail || null,
      },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await online(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await offline(api, config, activityId);
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
      caseId: "MONOPOLY_WORLD_CUP_universal_from_scratch",
      created,
      links: [
        { label: "后台大富翁列表", url: `${config.baseUrl}/activities/monopoly` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（从零配置）",
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
      caseId: "MONOPOLY_WORLD_CUP_universal_from_scratch_failed",
      title: "大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台大富翁列表", url: `${config.baseUrl}/activities/monopoly` }],
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
