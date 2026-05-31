#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";
import { writeResultMarkdown } from "../../../tools/lib/result-md.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run (no writes)
  node skills/weex-admin-ops/scripts/regression-newbie-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-newbie-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 新手通用回归
  --alias-prefix <text>       default nbreg
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "新手通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "nbreg";
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

function complexityScore(detail) {
  const keyCount = detail && typeof detail === "object" ? Object.keys(detail).length : 0;
  const requirement = Array.isArray(detail?.requirement) ? detail.requirement : [];
  const requirementCount = requirement.length;
  const requirementKeySum = requirement.reduce((acc, item) => acc + (item && typeof item === "object" ? Object.keys(item).length : 0), 0);
  const taskRiskCount = Array.isArray(detail?.taskRisk) ? detail.taskRisk.length : 0;
  const taskAwardKeyCount = detail?.taskAward && typeof detail.taskAward === "object" ? Object.keys(detail.taskAward).length : 0;
  const dynamicAudit = detail?.dynamicAuditConfig && typeof detail.dynamicAuditConfig === "object" ? Object.keys(detail.dynamicAuditConfig).length : 0;
  const liveness = detail?.livenessConfig && typeof detail.livenessConfig === "object" ? Object.keys(detail.livenessConfig).length : 0;
  const i18nCount = [detail?.nameI18, detail?.contentI18, detail?.labelI18]
    .map(arr => (Array.isArray(arr) ? arr.length : 0))
    .reduce((a, b) => a + b, 0);
  const score = keyCount + requirementCount * 40 + requirementKeySum * 3 + taskAwardKeyCount * 5 + taskRiskCount * 10 + dynamicAudit * 8 + liveness * 8 + i18nCount * 2;
  return { score };
}

function pickStableTaskIds(tasksAll, count = 3) {
  const candidates = (Array.isArray(tasksAll) ? tasksAll : [])
    .filter(item => item && (typeof item.id === "number" || typeof item.id === "string"))
    .filter(item => String(item.name || item.taskName || "").trim().length > 0);
  const scored = candidates.map(item => ({ id: Number(item.id), name: String(item.name || item.taskName || ""), score: complexityScore(item).score }));
  scored.sort((a, b) => a.score - b.score);
  const picked = [];
  for (const item of scored) {
    if (!Number.isFinite(item.id) || item.id <= 0) continue;
    picked.push(item);
    if (picked.length >= count) break;
  }
  if (!picked.length) throw new Error("未找到可用的新手活动任务（/activity/task/all?activityType=1 为空或结构异常）");
  return picked;
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteNewbieActivity(api, config, activityId) {
  const res = await api.post("/prod-api/activity/beginner/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteTaskPackage(api, config, id) {
  const res = await api.post("/prod-api/activity/taskPackage/remove", { id: Number(id), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteResourceCard(api, id) {
  const res = await api.delete(`/prod-api/activity/resource/${encodeURIComponent(String(id))}`);
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteMultilanguageTemplate(api, id) {
  const res = await api.delete(`/prod-api/activity/multiLanguageTemplate/${encodeURIComponent(String(id))}`);
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function findFallbackApplyConfigId(api) {
  const list = await api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent("自动化报名模板_auto")}&pageNum=1&pageSize=1`);
  const row = firstRow(list);
  const id = row?.id;
  if (!id) throw new Error("fallback applyConfigId not found by name prefix: 自动化报名模板_auto");
  return Number(id);
}

async function unbindNewbieActivityDependencies(api, activityId, fallbackApplyConfigId) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data;
  if (!item || detail.body?.code !== 200) throw new Error(`Activity detail failed: ${activityId}`);
  const patched = JSON.parse(JSON.stringify(item));
  patched.applyConfigId = Number(fallbackApplyConfigId);
  if ("applyConfig" in patched) patched.applyConfig = { id: Number(fallbackApplyConfigId) };
  patched.taskPackageId = null;
  patched.routineTaskPackageId = null;
  patched.taskConfig = [];
  patched.routineTaskConfig = [];
  patched.resourceConfig = [];
  patched.multiLanguageTemplateId = null;
  patched.activityConfigI18n = [];
  patched.questions = [];
  const put = await api.put("/prod-api/activity/config", patched);
  return { ok: put.body?.code === 200, status: put.status, body: { code: put.body?.code ?? null, msg: put.body?.msg || "" } };
}

async function attemptCleanup({ created, config }) {
  const cleanup = {
    activity: null,
    unbindActivities: [],
    taskPackage: null,
    routineTaskPackage: null,
    resourceCards: [],
    multilanguageTemplate: null,
    registerTemplate: null,
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const fallbackApplyConfigId = await findFallbackApplyConfigId(api).catch(() => null);
    const activityIds = Array.isArray(created.activityIds) && created.activityIds.length
      ? created.activityIds
      : created.activityId
        ? [created.activityId]
        : [];
    if (fallbackApplyConfigId && activityIds.length) {
      for (const id of activityIds) {
        cleanup.unbindActivities.push({
          id: String(id),
          ...(await unbindNewbieActivityDependencies(api, id, fallbackApplyConfigId).catch(err => ({ ok: false, error: err?.message || String(err) }))),
        });
      }
    }
    if (created.registerTemplateId) {
      cleanup.registerTemplate = await deleteRegisterTemplate(api, created.registerTemplateId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.taskPackageId) {
      cleanup.taskPackage = await deleteTaskPackage(api, config, created.taskPackageId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.routineTaskPackageId) {
      cleanup.routineTaskPackage = await deleteTaskPackage(api, config, created.routineTaskPackageId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (Array.isArray(created.resourceCardIds)) {
      for (const id of created.resourceCardIds) {
        if (!id) continue;
        const r = await deleteResourceCard(api, id).catch(err => ({ ok: false, error: err?.message || String(err) }));
        cleanup.resourceCards.push({ id: String(id), ...r });
      }
    }
    if (created.multilanguageTemplateId) {
      cleanup.multilanguageTemplate = await deleteMultilanguageTemplate(api, created.multilanguageTemplateId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (activityIds.length) {
      const deletes = [];
      for (const id of activityIds) deletes.push(await deleteNewbieActivity(api, config, id).catch(err => ({ ok: false, error: err?.message || String(err) })));
      cleanup.activity = { ok: deletes.every(v => v.ok), deletes };
    }
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
    activityType: "BEGINNER_TASK",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "多语言模板(从零)", "资源卡(从零)", "任务包(从零, 任务使用现有 all 列表)"],
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
    multilanguageTemplateId: "",
    resourceCardIds: [],
    taskPackageId: "",
    routineTaskPackageId: "",
    activityIds: [],
    activityId: "",
    activityAlias: "",
    activityTitle: "",
  };

  let api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  let uploadedBanner = "";
  try {
    uploadedBanner = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });

    // 1) create register template (from scratch)
    const reg = await runChildJson(["skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_register_template_from_scratch", ok: reg.ok, registerTemplateId: reg.json?.created?.id || null });
    if (!reg.ok) throw new Error(`register template create failed: ${reg.json?.error || "unknown"}`);
    created.registerTemplateId = String(reg.json?.created?.id || "");
    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 2) create multilanguage template (from scratch)
    const ml = await runChildJson(["skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs", "--action", "create-min-newbie", "--confirm-create"]);
    steps.push({ name: "create_multilanguage_template", ok: ml.ok, multilanguageTemplateId: ml.json?.created?.id || null });
    if (!ml.ok) throw new Error(`multilanguage template create failed: ${ml.json?.error || "unknown"}`);
    created.multilanguageTemplateId = String(ml.json?.created?.id || "");
    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 3) create resource cards (from scratch)
    const rc = await runChildJson(["skills/weex-admin-ops/scripts/resource-card-fast-api.mjs", "--action", "create-min-newbie", "--confirm-create", "--count", "3"]);
    const resourceCardIds = Array.isArray(rc.json?.created) ? rc.json.created.map(item => String(item?.id || "")).filter(Boolean) : [];
    steps.push({ name: "create_resource_cards", ok: rc.ok, resourceCardIds });
    if (!rc.ok) throw new Error(`resource cards create failed: ${rc.json?.error || "unknown"}`);
    created.resourceCardIds = resourceCardIds;
    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 4) pick stable task ids and create packages
    const tasksAllRes = await api.get("/prod-api/activity/task/all?activityType=1");
    const tasksAll = Array.isArray(tasksAllRes.body?.data) ? tasksAllRes.body.data : [];
    const picked = pickStableTaskIds(tasksAll, 6);
    const mainPicked = picked.slice(0, 3);
    const routinePicked = picked.slice(3, 6);
    if (routinePicked.length === 0) throw new Error("未找到足够的新手活动任务用于拆分两个不重复的任务包（需要至少 2 组任务）");
    steps.push({ name: "pick_task_ids", ok: true, picked, mainPicked, routinePicked });

    const packageName = `自动化_新手任务包_${Date.now()}`;
    const pkg = await runChildJson(["skills/weex-admin-ops/scripts/task-package-fast-api.mjs", "--action", "create", "--task-ids", mainPicked.map(v => v.id).join(","), "--name", packageName, "--confirm-create"]);
    steps.push({ name: "create_task_package", ok: pkg.ok, taskPackageId: pkg.json?.created?.id || null });
    if (!pkg.ok) throw new Error(`task package create failed: ${pkg.json?.error || "unknown"}`);
    created.taskPackageId = String(pkg.json?.created?.id || "");

    const routineName = `自动化_新手日常包_${Date.now()}`;
    const routine = await runChildJson(["skills/weex-admin-ops/scripts/task-package-fast-api.mjs", "--action", "create", "--task-ids", routinePicked.map(v => v.id).join(","), "--name", routineName, "--confirm-create"]);
    steps.push({ name: "create_routine_task_package", ok: routine.ok, routineTaskPackageId: routine.json?.created?.id || null });
    if (!routine.ok) throw new Error(`routine task package create failed: ${routine.json?.error || "unknown"}`);
    created.routineTaskPackageId = String(routine.json?.created?.id || "");
    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 5) create newbie activity (from scratch payload)
    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 32);
    const title = `${args.titlePrefix}${String(Date.now()).slice(-6)}`.slice(0, 60);
    const payload = {
      type: "BEGINNER_TASK",
      configType: 1,
      channelCategory: "UNIVERSAL",
      applicationMode: "MANUAL",
      title,
      subTitle: "自动化副标题",
      showUrl: alias,
      startTime: window.start,
      endTime: window.end,
      priority: 1,
      applyConfigId: Number(created.registerTemplateId),
      multiLanguageTemplateId: Number(created.multilanguageTemplateId),
      taskPackageId: Number(created.taskPackageId),
      routineTaskPackageId: Number(created.routineTaskPackageId),
      routineTitle: "自动化日常任务",
      routineSubTitle: "自动化日常任务副标题",
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      showCountdown: true,
      showActivityCalendar: 0,
      periodValidity: 0,
      resourceConfig: created.resourceCardIds.map(id => ({ id: Number(id) })),
      activityConfigI18n: [
        {
          lang: "zh_CN",
          title,
          subTitle: "自动化副标题",
          webBannerUrl: uploadedBanner,
          appBannerUrl: uploadedBanner,
          webShareUrl: uploadedBanner,
          appShareUrl: uploadedBanner,
          shareContent: "自动化分享文案",
          agentShareContent: "自动化代理分享文案",
          intro: "<p>自动化规则</p>",
          questions: [{ title: "常见问题", content: "自动化FAQ内容" }],
        },
        {
          lang: "en_US",
          title: "Automated newbie regression",
          subTitle: "Automated subtitle",
          webBannerUrl: uploadedBanner,
          appBannerUrl: uploadedBanner,
          webShareUrl: uploadedBanner,
          appShareUrl: uploadedBanner,
          shareContent: "Automated share content",
          agentShareContent: "Automated agent share content",
          intro: "<p>Automated rules</p>",
          questions: [{ title: "FAQ", content: "Automated FAQ content" }],
        },
      ],
      questions: [{ lang: "zh_CN", list: [{ title: "常见问题", content: "自动化FAQ内容" }] }],
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_newbie_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create newbie activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=BEGINNER_TASK&showUrl=${encodeURIComponent(alias)}`);
    const rows = Array.isArray(verifyList.body?.rows) ? verifyList.body.rows : [];
    const activityIds = Array.from(new Set(rows.map(item => String(item?.activityId || item?.id || "")).filter(Boolean)));
    const activityId = activityIds[0] || "";
    if (!activityId) throw new Error(`Created newbie activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityIds = activityIds;
    created.activityAlias = alias;
    created.activityTitle = title;

    // 6) draft checks + online/offline
    const checks = await runChildJson(["skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs", "--action", "draft-checks", "--activity-id", String(activityId)]);
    steps.push({ name: "draft_checks", ok: checks.ok, fullConfigChecks: checks.json?.fullConfigChecks || null });
    if (!checks.ok) throw new Error(`draft-checks failed: ${checks.json?.error || "unknown"}`);

    const on = await runChildJson(["skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs", "--action", "online", "--activity-id", String(activityId)]);
    steps.push({ name: "online", ok: on.ok, status: on.json?.verifyItem?.status || null });
    if (!on.ok) throw new Error(`online failed: ${on.json?.error || "unknown"}`);

    const off = await runChildJson(["skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs", "--action", "offline", "--activity-id", String(activityId)]);
    steps.push({ name: "offline", ok: off.ok, status: off.json?.verifyItem?.status || null });
    if (!off.ok) throw new Error(`offline failed: ${off.json?.error || "unknown"}`);

    // 7) cleanup
    let cleanup = null;
    if (args.cleanup) {
      cleanup = await attemptCleanup({ created: { ...created, activityId }, config });
      const ok = Boolean(
        cleanup.activity?.ok !== false
          && cleanup.taskPackage?.ok !== false
          && cleanup.routineTaskPackage?.ok !== false
          && cleanup.multilanguageTemplate?.ok !== false
          && cleanup.registerTemplate?.ok !== false
          && (cleanup.resourceCards || []).every(v => v.ok),
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "BEGINNER_TASK_universal_from_scratch",
      created,
      links: [
        { label: "后台新手活动列表", url: `${config.baseUrl}/activities/newbie` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "新手活动(BEGINNER_TASK) 通用回归（从零配置）",
      summary: {
        ok: true,
        activityId: created.activityId,
        activityAlias: created.activityAlias,
        startTime: plan.window.start,
        endTime: plan.window.end,
        cleanup: args.cleanup,
        uploadedBannerUrl: uploadedBanner,
      },
      links: result.links,
      steps,
      raw: { plan, created, cleanup },
    });

    printJson({ ...result, resultMd: md.filePath }, process.stdout);
    return 0;
  } catch (error) {
    const cleanup = args.cleanup ? await attemptCleanup({ created, config }).catch(err => ({ ok: false, error: err?.message || String(err) })) : null;
    if (cleanup) steps.push({ name: "cleanup_on_failure", ok: true, cleanup });
    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: "BEGINNER_TASK_universal_from_scratch_failed",
      title: "新手活动(BEGINNER_TASK) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, uploadedBannerUrl: uploadedBanner, cleanup: args.cleanup },
      links: [{ label: "后台新手活动列表", url: `${config.baseUrl}/activities/newbie` }],
      steps,
      raw: { error: error.message, created, steps, cleanup },
    });
    printJson({ ok: false, mode: "headless_api", error: error.message, created, resultMd: md.filePath }, process.stderr);
    return 1;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}
