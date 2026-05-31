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
  node skills/weex-admin-ops/scripts/regression-agent-tracepro-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-agent-tracepro-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 代理小活动通用回归
  --alias-prefix <text>       default atpr
  --required-volume <n>       default 1
  --resource-cards <n>        default 3
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "代理小活动通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "atpr";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.resourceCards = args.resourceCards !== undefined ? Number(args.resourceCards) : 3;
  args.resourceCards = Math.max(0, Math.min(5, Number.isFinite(args.resourceCards) ? args.resourceCards : 3));
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
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/payload-baselines/agent-trace-pro.activity-config.baseline.json");
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

function patchMiniActivityTaskConfigs(templateMiniActivity, createdTaskDetail) {
  const mini = Array.isArray(templateMiniActivity) ? JSON.parse(JSON.stringify(templateMiniActivity)) : [];
  if (!mini.length) return mini;
  if (!createdTaskDetail) return mini;
  mini[0].taskConfigs = [createdTaskDetail];
  mini[0].taskConfig = Number(createdTaskDetail?.id || createdTaskDetail?.taskId || mini[0].taskConfig || 0) || mini[0].taskConfig || null;
  if (typeof mini[0].completeTaskGroupCount !== "number") mini[0].completeTaskGroupCount = 1;
  return mini;
}

async function traceProOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/tracePro/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function traceProOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/tracePro/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function traceProDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/tracePro/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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

async function deleteResourceCard(api, id) {
  const del = await api.delete(`/prod-api/activity/resource/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function attemptCleanup({ config, created }) {
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const cleanup = {};
  try {
    if (created.activityId) {
      cleanup.unbind = await rebindApplyTemplateToDefault(api, created.activityId).catch(error => ({ ok: false, error: error.message }));
      cleanup.deleteActivity = await traceProDelete(api, config, created.activityId).catch(error => ({ ok: false, error: error.message }));
    }
    if (created.taskId) cleanup.deleteTask = await deleteTask(api, created.taskId).catch(error => ({ ok: false, error: error.message }));
    if (created.prizeId) cleanup.deletePrize = await deletePrize(api, created.prizeId).catch(error => ({ ok: false, error: error.message }));
    if (created.registerTemplateId) cleanup.deleteRegisterTemplate = await deleteRegisterTemplate(api, created.registerTemplateId).catch(error => ({ ok: false, error: error.message }));
    if (Array.isArray(created.resourceCardIds) && created.resourceCardIds.length) {
      cleanup.deleteResourceCards = [];
      for (const id of created.resourceCardIds) cleanup.deleteResourceCards.push(await deleteResourceCard(api, id).catch(error => ({ ok: false, error: error.message, id })));
    }
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
    activityType: "AGENT_TRACE_PRO",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    requiredVolume: args.requiredVolume,
    resourceCards: args.resourceCards,
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "赠金奖品(从零)", "ORDER_VOLUME任务(从零)", "资源卡(从零)", "图片上传(uploadImgReplace)"],
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
    taskId: "",
    resourceCardIds: [],
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
      "--allow-range",
      "ALLOW_ONLY_CHANNEL_USER",
      "--confirm-create",
    ]);
    steps.push({ name: "create_register_template_from_scratch", ok: reg.ok, registerTemplateId: reg.json?.created?.id || null });
    if (!reg.ok) throw new Error(`register template create failed: ${reg.json?.error || "unknown"}`);
    created.registerTemplateId = String(reg.json?.created?.id || "");

    const prize = await runChildJson(["skills/weex-admin-ops/scripts/create-gift-cash-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_gift_cash_prize_from_scratch", ok: prize.ok, prizeId: prize.json?.created?.id || null });
    if (!prize.ok) throw new Error(`gift cash prize create failed: ${prize.json?.error || "unknown"}`);
    created.prizeId = String(prize.json?.created?.id || "");

    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-agent-tracepro-order-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--award-prize-id",
      String(created.prizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_agent_tracepro_order_volume_task_from_scratch", ok: task.ok, taskId: task.json?.created?.id || null });
    if (!task.ok) throw new Error(`task create failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    const createdTaskDetail = task.json?.createdTaskDetail || null;
    if (!createdTaskDetail) throw new Error("missing createdTaskDetail from task script");

    let resourceCardIds = [];
    if (args.resourceCards > 0) {
      const cards = await runChildJson([
        "skills/weex-admin-ops/scripts/create-resource-card-from-scratch-fast-api.mjs",
        "--activity-type",
        "TRACE_PRO",
        "--count",
        String(args.resourceCards),
        "--confirm-create",
      ]);
      steps.push({ name: "create_resource_cards_from_scratch", ok: cards.ok, count: cards.json?.created?.length ?? null });
      if (!cards.ok) throw new Error(`resource cards create failed: ${cards.json?.error || "unknown"}`);
      resourceCardIds = Array.isArray(cards.json?.created) ? cards.json.created.map(v => String(v?.id || "")).filter(Boolean) : [];
      if (resourceCardIds.length < args.resourceCards) throw new Error(`missing resourceCardIds: got ${resourceCardIds.length}`);
      created.resourceCardIds = resourceCardIds;
    }

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });
    steps.push({ name: "refresh_api_session_before_activity_create", ok: true });

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);

    const baseline = loadBaselinePayload();
    const payload = JSON.parse(JSON.stringify(baseline));
    payload.type = "TRACE_PRO";
    payload.channelCategory = "AGENT";
    payload.title = title;
    payload.showUrl = alias;
    payload.startTime = window.start;
    payload.endTime = window.end;

    payload.applyConfigId = Number(created.registerTemplateId);
    const applyDetail = await api.get(`/prod-api/activity/apply/${encodeURIComponent(String(created.registerTemplateId))}`);
    if (applyDetail.body?.code !== 200 || !applyDetail.body?.data) throw new Error(`apply detail failed: ${JSON.stringify({ code: applyDetail.body?.code, msg: applyDetail.body?.msg || "" })}`);
    payload.applyConfig = applyDetail.body.data;

    if (resourceCardIds.length) {
      payload.resourceConfig = resourceCardIds.slice(0, 3).map(id => ({ id: Number(id) }));
      payload.showResource = 1;
    }
    payload.miniActivity = patchMiniActivityTaskConfigs(payload.miniActivity, createdTaskDetail);

    payload.webBannerUrl = uploadedBanner;
    payload.appBannerUrl = uploadedBanner;
    payload.webShareUrl = uploadedBanner;
    payload.appShareUrl = uploadedBanner;
    payload.ogImageUrl = uploadedBanner;
    if (Array.isArray(payload.materialInfoList)) {
      payload.materialInfoList = payload.materialInfoList.map(item => ({ ...item, url: uploadedBanner }));
    }
    if (Array.isArray(payload.activityConfigI18n)) {
      payload.activityConfigI18n = payload.activityConfigI18n.map(item => ({
        ...item,
        webBannerUrl: uploadedBanner,
        appBannerUrl: uploadedBanner,
        webShareUrl: uploadedBanner,
        appShareUrl: uploadedBanner,
      }));
    }

    const createRes = await createActivityConfigWithRetry(api, payload, { maxRetries: 4 });
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_agent_trace_pro_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create AGENT_TRACE_PRO activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=TRACE_PRO&showUrl=${encodeURIComponent(alias)}&channelCategory=AGENT`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created AGENT_TRACE_PRO activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const firstMiniTaskId = Number(d?.miniActivity?.[0]?.taskConfigs?.[0]?.id || 0) || 0;
    const resourceCount = Array.isArray(d?.resourceConfig) ? d.resourceConfig.length : 0;
    const verify = {
      ok: d?.type === "TRACE_PRO" && d?.channelCategory === "AGENT" && Number(d?.applyConfigId || 0) > 0 && firstMiniTaskId > 0 && (args.resourceCards <= 0 || resourceCount > 0),
      checks: { type: d?.type ?? null, channelCategory: d?.channelCategory ?? null, applyConfigId: d?.applyConfigId ?? null, firstMiniTaskId: firstMiniTaskId || null, resourceCount },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await traceProOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await traceProOffline(api, config, activityId);
    steps.push({ name: "offline", ok: off.ok, response: off.body });
    if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);

    let cleanup = null;
    if (args.cleanup) {
      await api.close().catch(() => {});
      cleanup = await attemptCleanup({ config, created });
      const ok = Boolean(
        cleanup.deleteActivity?.ok !== false
          && cleanup.deleteTask?.ok !== false
          && cleanup.deletePrize?.ok !== false
          && cleanup.deleteRegisterTemplate?.ok !== false
          && ((cleanup.deleteResourceCards || []).every(v => v.ok !== false)),
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "AGENT_TRACE_PRO_universal_from_scratch",
      created,
      links: [{ label: "后台代理小活动列表", url: `${config.baseUrl}/activities/copyTrading` }],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "代理小活动(AGENT_TRACE_PRO) 通用回归（从零配置）",
      summary: { ok: true, activityId: created.activityId, activityAlias: created.activityAlias, startTime: plan.window.start, endTime: plan.window.end, requiredVolume: args.requiredVolume, resourceCards: args.resourceCards, cleanup: args.cleanup },
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
      caseId: "AGENT_TRACE_PRO_universal_from_scratch_failed",
      title: "代理小活动(AGENT_TRACE_PRO) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台代理小活动列表", url: `${config.baseUrl}/activities/copyTrading` }],
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
