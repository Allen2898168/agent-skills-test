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
  node skills/weex-admin-ops/scripts/regression-guess-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-guess-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>         default 竞猜大赛通用回归
  --alias-prefix <text>         default gcr
  --required-volume <n>         default 1 (积分任务交易量阈值)
  --required-integral <n>       default 1 (竞猜任务积分阈值)
  --start-offset-seconds <n>    default 120
  --end-days <n>                default 30
  --cleanup                     default true; 删除创建的活动与依赖
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "竞猜大赛通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "gcr";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.requiredIntegral = args.requiredIntegral ? Number(args.requiredIntegral) : 1;
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

function parseShanghaiDateTime(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const iso = `${s.replace(" ", "T")}+08:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function guessTaskWindowFromActivityWindow(window) {
  const startDate = parseShanghaiDateTime(window?.start);
  const endDate = parseShanghaiDateTime(window?.end);
  if (!startDate || !endDate) return null;
  const maxEndMs = endDate.getTime();
  const startMs = startDate.getTime();
  const endMs = Math.min(maxEndMs, startMs + 72 * 60 * 60 * 1000);
  const deadlineMs = Math.min(endMs - 60 * 60 * 1000, startMs + 48 * 60 * 60 * 1000);
  return {
    startTime: formatDateTimeInTimeZone(new Date(startMs), "Asia/Shanghai"),
    deadlineTime: formatDateTimeInTimeZone(new Date(Math.max(startMs, deadlineMs)), "Asia/Shanghai"),
    endTime: formatDateTimeInTimeZone(new Date(Math.max(startMs + 60 * 60 * 1000, endMs)), "Asia/Shanghai"),
  };
}

function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
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

function loadBaselinePayload() {
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/payload-baselines/guess.activity-config.baseline.json");
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("baseline payload json is not an object");
  return parsed;
}

function isSystemBusyResponse(res) {
  const code = res?.body?.code ?? null;
  const msg = String(res?.body?.msg || res?.body?.message || "");
  return Number(code) === 500 && /系统繁忙|busy/i.test(msg);
}

async function createActivityConfigWithRetry(api, payload, { maxRetries = 4 } = {}) {
  const backoffsMs = [1200, 2500, 5000, 9000, 15000, 20000];
  let last = null;
  for (let attempt = 0; attempt <= Math.max(0, Number(maxRetries) || 0); attempt += 1) {
    const res = await api.post("/prod-api/activity/config", payload);
    last = res;
    if (!isSystemBusyResponse(res)) return res;
    const waitMs = backoffsMs[Math.min(attempt, backoffsMs.length - 1)] || 2000;
    await sleepMs(waitMs);
  }
  return last;
}

async function guessOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/guess/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function guessOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/guess/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function guessDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/guess/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function rebindApplyTemplateToDefault(api, activityId, { defaultApplyConfigId = 2442 } = {}) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data || null;
  if (!item || detail.body?.code !== 200) return { ok: false, skipped: true, reason: "detail_unavailable", detail: { status: detail.status, code: detail.body?.code ?? null, msg: detail.body?.msg || "" } };
  const patched = JSON.parse(JSON.stringify(item));
  patched.applyConfigId = Number(defaultApplyConfigId);
  if ("applyConfig" in patched) patched.applyConfig = { id: Number(defaultApplyConfigId) };
  if ("registerTemplateId" in patched) patched.registerTemplateId = Number(defaultApplyConfigId);
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

async function deleteGuessTask(api, id) {
  const del = await api.delete(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function attemptCleanup({ config, created }) {
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const cleanup = {};
  try {
    if (created.activityId) {
      cleanup.unbind = await rebindApplyTemplateToDefault(api, created.activityId).catch(error => ({ ok: false, error: error.message }));
      cleanup.deleteActivity = await guessDelete(api, config, created.activityId).catch(error => ({ ok: false, error: error.message }));
    }
    if (created.integralTaskId) cleanup.deleteIntegralTask = await deleteTask(api, created.integralTaskId).catch(error => ({ ok: false, error: error.message }));
    if (created.guessTaskId) cleanup.deleteGuessTask = await deleteGuessTask(api, created.guessTaskId).catch(error => ({ ok: false, error: error.message }));
    if (created.prizeId) cleanup.deletePrize = await deletePrize(api, created.prizeId).catch(error => ({ ok: false, error: error.message }));
    if (created.registerTemplateId) cleanup.deleteRegisterTemplate = await deleteRegisterTemplate(api, created.registerTemplateId).catch(error => ({ ok: false, error: error.message }));
    return cleanup;
  } finally {
    await api.close().catch(() => {});
  }
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
    activityType: "GUESS",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    requiredVolume: args.requiredVolume,
    requiredIntegral: args.requiredIntegral,
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "赠金奖品(从零)", "积分任务(TRADING_VOLUME，从零)", "竞猜任务(guessTask，从零)", "图片上传(uploadImgReplace)"],
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
    prizeId: "",
    integralTaskId: "",
    guessTaskId: "",
    activityId: "",
    activityAlias: "",
    activityTitle: "",
  };

  let api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  let uploadedBanner = "";
  try {
    uploadedBanner = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });
    steps.push({ name: "upload_banner", ok: Boolean(uploadedBanner), url: uploadedBanner || null });

    const reg = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs",
      "--participant-mode",
      "MANUAL",
      "--confirm-create",
    ]);
    steps.push({ name: "create_register_template_from_scratch", ok: reg.ok, registerTemplateId: reg.json?.created?.id || null });
    if (!reg.ok) throw new Error(`register template create failed: ${reg.json?.error || "unknown"}`);
    created.registerTemplateId = String(reg.json?.created?.id || "");

    const prize = await runChildJson(["skills/weex-admin-ops/scripts/create-gift-cash-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_gift_cash_prize_from_scratch", ok: prize.ok, prizeId: prize.json?.created?.id || null });
    if (!prize.ok) throw new Error(`gift cash prize create failed: ${prize.json?.error || "unknown"}`);
    created.prizeId = String(prize.json?.created?.id || "");

    const integralTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-guess-trading-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    steps.push({ name: "create_guess_trading_volume_task_from_scratch", ok: integralTask.ok, taskId: integralTask.json?.created?.id || null });
    if (!integralTask.ok) throw new Error(`integral task create failed: ${integralTask.json?.error || "unknown"}`);
    created.integralTaskId = String(integralTask.json?.created?.id || "");
    const integralTaskDetail = integralTask.json?.createdTaskDetail || null;
    if (!integralTaskDetail) throw new Error("missing createdTaskDetail from integral task script");

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const guessTaskWindow = guessTaskWindowFromActivityWindow(window);
    if (!guessTaskWindow) throw new Error("failed to build guessTaskWindow from activity window");

    const guessTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-guessing-task-from-scratch-fast-api.mjs",
      "--required-integral",
      String(args.requiredIntegral),
      "--start-time",
      guessTaskWindow.startTime,
      "--deadline-time",
      guessTaskWindow.deadlineTime,
      "--end-time",
      guessTaskWindow.endTime,
      "--confirm-create",
    ]);
    steps.push({ name: "create_guess_task_from_scratch", ok: guessTask.ok, guessTaskId: guessTask.json?.created?.id || null });
    if (!guessTask.ok) throw new Error(`guessTask create failed: ${guessTask.json?.error || "unknown"}`);
    created.guessTaskId = String(guessTask.json?.created?.id || "");

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });
    steps.push({ name: "refresh_api_session_before_activity_create", ok: true });

    // reuse the same activity window already computed for guessTask time alignment
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);
    const subTitle = `自动化副标题_${ts.slice(-6)}`.slice(0, 120);

    const baseline = loadBaselinePayload();
    const payload = JSON.parse(JSON.stringify(baseline));
    payload.type = "GUESS";
    payload.activityType = 22;
    payload.title = title;
    payload.subTitle = subTitle;
    payload.showUrl = alias;
    payload.startTime = window.start;
    payload.endTime = window.end;
    payload.channelCategory = payload.channelCategory || "UNIVERSAL";
    payload.guessActivityType = payload.guessActivityType || "INTEGRAL_MODE";
    payload.isPreApply = payload.isPreApply ?? 0;
    payload.periods = payload.periods ?? 0;
    payload.configType = payload.configType ?? 1;
    payload.activityOwner = payload.activityOwner ?? "auto";

    payload.applyConfigId = Number(created.registerTemplateId);
    const applyDetail = await api.get(`/prod-api/activity/apply/${encodeURIComponent(String(created.registerTemplateId))}`);
    if (applyDetail.body?.code !== 200 || !applyDetail.body?.data) throw new Error(`apply detail failed: ${JSON.stringify({ code: applyDetail.body?.code, msg: applyDetail.body?.msg || "" })}`);
    payload.applyConfig = applyDetail.body.data;

    payload.ogImageUrl = uploadedBanner;
    if (Array.isArray(payload.activityConfigI18n)) {
      payload.activityConfigI18n = payload.activityConfigI18n.map(item => ({
        ...item,
        title: item?.lang === "zh_CN" ? title : (item?.title || title),
        subTitle: item?.lang === "zh_CN" ? subTitle : (item?.subTitle || subTitle),
        webBannerUrl: uploadedBanner,
        appBannerUrl: uploadedBanner,
        webShareUrl: uploadedBanner,
        appShareUrl: uploadedBanner,
        webScoreUrl: uploadedBanner,
        appScoreUrl: uploadedBanner,
      }));
    }

    const seasonTitle = "赛期1";
    const guessPeriod = [
      {
        periodId: 1,
        priority: 1,
        startTime: window.start,
        title: seasonTitle,
        titleI18: [{ lang: "zh_CN", name: seasonTitle }],
        taskConfig: [{ id: Number(created.guessTaskId), order: 1, toTopFlag: 0 }],
      },
    ];

    payload.guessList = [
      {
        channelType: "OFFICIAL_WEBSITE",
        taskConfig: [{ id: Number(created.integralTaskId), order: 1 }],
        guessPeriod,
        guessTicket: [],
        prizeConfig: {
          showFlag: "NO",
          exchangeStartTime: null,
          exchangeEndTime: null,
          prize: [{ prizeId: Number(created.prizeId), integralCount: 1, prizeCount: 1, prizeLimit: null, userLimit: null, label: "SMALL" }],
        },
      },
    ];

    payload.requirement = [{ type: "GUESS", guessTaskType: "INTEGRAL_MODE" }];
    payload.taskAward = { awardMode: "PARTITION" };

    const createRes = await createActivityConfigWithRetry(api, payload, { maxRetries: 4 });
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_guess_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create GUESS activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=GUESS&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created GUESS activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const integralIdFromDetail = Number(d?.guessList?.[0]?.taskConfig?.[0]?.id || 0) || 0;
    const guessIdFromDetail = Number(d?.guessList?.[0]?.guessPeriod?.[0]?.taskConfig?.[0]?.id || 0) || 0;
    const verify = {
      ok: d?.type === "GUESS" && Number(d?.applyConfigId || 0) > 0 && integralIdFromDetail > 0 && guessIdFromDetail > 0,
      checks: { type: d?.type ?? null, applyConfigId: d?.applyConfigId ?? null, integralTaskId: integralIdFromDetail || null, guessTaskId: guessIdFromDetail || null },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await guessOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await guessOffline(api, config, activityId);
    steps.push({ name: "offline", ok: off.ok, response: off.body });
    if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);

    let cleanup = null;
    if (args.cleanup) {
      await api.close().catch(() => {});
      cleanup = await attemptCleanup({ config, created });
      const ok = Boolean(
        cleanup.deleteActivity?.ok !== false
          && cleanup.deleteIntegralTask?.ok !== false
          && cleanup.deleteGuessTask?.ok !== false
          && cleanup.deletePrize?.ok !== false
          && cleanup.deleteRegisterTemplate?.ok !== false,
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "GUESS_universal_from_scratch",
      created,
      links: [{ label: "后台竞猜大赛列表", url: `${config.baseUrl}/activities/guessCompetition` }],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "竞猜大赛(GUESS) 通用回归（从零配置）",
      testCase: {
        number: `UR-ADMIN-${result.caseId}`,
        description: "验证竞猜大赛(GUESS)在 staging 环境从零创建依赖与活动（含积分任务/竞猜任务与奖品），完成草稿检查、上线/下线，并按需清理创建物。",
        preconditions: [
          "环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）",
          "已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）",
          "账号具备活动/任务/奖品/资源等配置权限",
          "如启用 --cleanup：账号具备删除/解绑权限",
        ],
        tags: ["admin", "universal-regression", "from-scratch", "GUESS"],
      },
      summary: { ok: true, activityId: created.activityId, activityAlias: created.activityAlias, startTime: plan.window.start, endTime: plan.window.end, requiredVolume: args.requiredVolume, requiredIntegral: args.requiredIntegral, cleanup: args.cleanup },
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
      caseId: "GUESS_universal_from_scratch_failed",
      title: "竞猜大赛(GUESS) 通用回归（失败）",
      testCase: {
        number: "UR-ADMIN-GUESS_universal_from_scratch",
        description: "验证竞猜大赛(GUESS)在 staging 环境从零创建依赖与活动（含积分任务/竞猜任务与奖品），完成草稿检查、上线/下线，并按需清理创建物（失败场景输出）。",
        preconditions: [
          "环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）",
          "已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）",
          "账号具备活动/任务/奖品/资源等配置权限",
          "如启用 --cleanup：账号具备删除/解绑权限",
        ],
        tags: ["admin", "universal-regression", "from-scratch", "GUESS"],
      },
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台竞猜大赛列表", url: `${config.baseUrl}/activities/guessCompetition` }],
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
