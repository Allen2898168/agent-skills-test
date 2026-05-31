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
  node skills/weex-admin-ops/scripts/regression-customized-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-customized-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 定制活动通用回归
  --alias-prefix <text>       default czr
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "定制活动通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "czr";
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

async function customizedOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/customized/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function customizedOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/customized/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function customizedDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/customized/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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
    deletePrize: null,
    deleteRegisterTemplate: null,
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });
    if (created.activityId) {
      cleanup.offline = await customizedOffline(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.unbindActivity = await unbindDependencies(api, created.activityId, { applyConfigId: 2442 }).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.deleteActivity = await customizedDelete(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.taskId) cleanup.deleteTask = await deleteTask(api, created.taskId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    if (created.prizeId) cleanup.deletePrize = await deletePrize(api, created.prizeId).catch(err => ({ ok: false, error: err?.message || String(err) }));
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
    activityType: "CUSTOMIZED",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    requiredVolume: args.requiredVolume,
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "奖品(仓位空投, 从零)", "任务(合约交易量, 从零)", "图片上传(uploadImgReplace)"],
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

    const prize = await runChildJson(["skills/weex-admin-ops/scripts/create-position-airdrop-prize-fast-api.mjs", "--coin", "DOGE", "--required-amount", "1", "--leverage", "1", "--confirm-create"]);
    steps.push({ name: "create_position_airdrop_prize", ok: prize.ok, prizeId: prize.json?.created?.id || null });
    if (!prize.ok) throw new Error(`prize create failed: ${prize.json?.error || "unknown"}`);
    created.prizeId = String(prize.json?.created?.id || "");
    if (!created.prizeId) throw new Error("missing prizeId");

    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-customized-trading-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--award-prize-id",
      String(created.prizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_customized_trading_volume_task_from_scratch", ok: task.ok, taskId: task.json?.created?.id || null });
    if (!task.ok) throw new Error(`task create failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    if (!created.taskId) throw new Error("missing taskId");

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const ts = buildSuffix();
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${ts.slice(-6)}`.slice(0, 120);
    const subTitle = `自动化副标题_${ts.slice(-6)}`.slice(0, 120);

    const payload = {
      type: "CUSTOMIZED",
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
      periods: 0,
      periodValidity: null,
      isPreApply: 0,
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      taskConfig: [{ id: Number(created.taskId) }],
      showResource: 0,
      showSchedule: "NO",
      applicationMode: "MANUAL",
      activityConfigI18n: [
        { lang: "zh_CN", title, subTitle, webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "自动化分享文案", agentShareContent: "自动化代理分享文案", intro: "<p>自动化活动规则</p>" },
        { lang: "en_US", title: "Automated customized regression", subTitle: "Automated subtitle", webBannerUrl: uploadedBanner, appBannerUrl: uploadedBanner, shareContent: "Automated share content", agentShareContent: "Automated agent share content", intro: "<p>Automated rules</p>" },
      ],
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_customized_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create customized activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CUSTOMIZED&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created CUSTOMIZED activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const taskIdFromDetail = Number(d?.taskConfigIds?.[0] || d?.taskConfig?.[0]?.id || 0) || 0;
    const verify = {
      ok: d?.type === "CUSTOMIZED" && Number(d?.applyConfigId || 0) > 0 && taskIdFromDetail > 0,
      checks: { type: d?.type ?? null, applyConfigId: d?.applyConfigId ?? null, taskIdFromDetail: taskIdFromDetail || null },
    };
    steps.push({ name: "draft_checks", ok: verify.ok, verify });
    if (!verify.ok) throw new Error(`draft-checks failed: ${JSON.stringify(verify.checks)}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await customizedOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await customizedOffline(api, config, activityId);
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
          && cleanup.deleteRegisterTemplate?.ok !== false,
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "CUSTOMIZED_universal_from_scratch",
      created,
      links: [
        { label: "后台定制化列表", url: `${config.baseUrl}/activities/commission` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "定制化活动(CUSTOMIZED) 通用回归（从零配置）",
      testCase: {
        number: `UR-ADMIN-${result.caseId}`,
        description: "验证定制化活动(CUSTOMIZED)在 staging 环境从零创建依赖与活动，完成草稿检查、上线/下线，并按需清理创建物。",
        preconditions: [
          "环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）",
          "已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）",
          "账号具备活动/任务/奖品/资源等配置权限",
          "如启用 --cleanup：账号具备删除/解绑权限",
        ],
        tags: ["admin", "universal-regression", "from-scratch", "CUSTOMIZED"],
      },
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
      caseId: "CUSTOMIZED_universal_from_scratch_failed",
      title: "定制化活动(CUSTOMIZED) 通用回归（失败）",
      testCase: {
        number: "UR-ADMIN-CUSTOMIZED_universal_from_scratch",
        description: "验证定制化活动(CUSTOMIZED)在 staging 环境从零创建依赖与活动，完成草稿检查、上线/下线，并按需清理创建物（失败场景输出）。",
        preconditions: [
          "环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）",
          "已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）",
          "账号具备活动/任务/奖品/资源等配置权限",
          "如启用 --cleanup：账号具备删除/解绑权限",
        ],
        tags: ["admin", "universal-regression", "from-scratch", "CUSTOMIZED"],
      },
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台定制化列表", url: `${config.baseUrl}/activities/commission` }],
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
