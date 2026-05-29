#!/usr/bin/env node
import fs from "node:fs";
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config GUESS with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    optional; payload baseline only. If omitted, script will build a minimal payload and upload an image for required i18n assets.
  --title-prefix <text>       default 竞猜大赛全配
  --alias-prefix <text>       default guess
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "竞猜大赛全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "guess";
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

async function uploadImgReplace({ baseUrl, authorization, filePath }) {
  if (!fs.existsSync(filePath)) throw new Error(`upload image not found: ${filePath}`);
  const base = String(baseUrl).replace(/\/+$/, "");
  const form = new FormData();
  form.append("file", new File([fs.readFileSync(filePath)], "upload.webp", { type: "image/webp" }));
  const response = await fetch(`${base}/prod-api/common/uploadImgReplace`, {
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

async function resolveTemplate(api, templateAlias) {
  if (!templateAlias) return { id: null, alias: null, detail: null };
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=GUESS&showUrl=${encodeURIComponent(templateAlias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: templateAlias, detail: detail.body.data };
}

function patchActivityI18n(payload, zh) {
  const list = Array.isArray(payload.activityConfigI18n) ? payload.activityConfigI18n : [];
  payload.activityConfigI18n = list.map(item => {
    if (item?.lang !== "zh_CN") return item;
    return { ...item, title: zh.title, subTitle: zh.subTitle };
  });
}

function buildMinimalI18n({ title, subTitle, uploadedImageUrl }) {
  return [
    {
      lang: "zh_CN",
      title,
      subTitle,
      prizePoolIntro: "奖池展示",
      demoPrizePoolIntro: "",
      shareContent: "分享文案",
      agentShareContent: "代理分享文案",
      raceShareContent: "",
      webBannerUrl: uploadedImageUrl,
      appBannerUrl: uploadedImageUrl,
      webShareUrl: uploadedImageUrl,
      appShareUrl: uploadedImageUrl,
      webScoreUrl: uploadedImageUrl,
      appScoreUrl: uploadedImageUrl,
      webMp4Files: "",
      appMp4Files: "",
      intro: "<p>活动规则</p>",
    },
  ];
}

function buildActivityPayload({ templateDetail, args, created, uploadedImageUrl }) {
  const ts = buildSuffix();
  const alias = String(`${args.aliasPrefix || "guess"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix || "竞猜大赛全配"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = templateDetail ? stripCloneFields(templateDetail) : {};
  payload.type = "GUESS";
  payload.activityType = 22;
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  payload.startTime = window.start;
  payload.endTime = window.end;
  payload.configType = payload.configType ?? 1;
  payload.activityOwner = payload.activityOwner ?? "auto";
  payload.channelCategory = payload.channelCategory || "UNIVERSAL";
  payload.guessActivityType = payload.guessActivityType || "INTEGRAL_MODE";
  payload.isPreApply = payload.isPreApply ?? 0;
  payload.periods = payload.periods ?? 0;
  payload.applyConfigId = Number(created.applyConfigId);
  payload.showActivityCalendar = payload.showActivityCalendar ?? 1;
  payload.syncCalendarFlag = payload.syncCalendarFlag ?? 0;

  payload.requirement = [{ type: "GUESS", guessTaskType: "INTEGRAL_MODE" }];
  payload.taskAward = { awardMode: "PARTITION" };

  payload.activityConfigI18n = Array.isArray(payload.activityConfigI18n) && payload.activityConfigI18n.length
    ? payload.activityConfigI18n
    : buildMinimalI18n({ title, subTitle, uploadedImageUrl });
  payload.ogImageUrl = payload.ogImageUrl || uploadedImageUrl;
  payload.questions = Array.isArray(payload.questions) ? payload.questions : [];

  patchActivityI18n(payload, { title, subTitle });

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

  const prizeConfig = {
    showFlag: "NO",
    exchangeStartTime: null,
    exchangeEndTime: null,
    prize: [
      {
        prizeId: Number(created.prizeId),
        integralCount: 1,
        prizeCount: 1,
        prizeLimit: null,
        userLimit: null,
        label: "SMALL",
      },
    ],
  };

  payload.guessList = [
    {
      channelType: "OFFICIAL_WEBSITE",
      taskConfig: [{ id: Number(created.integralTaskId), order: 1 }],
      guessPeriod,
      guessTicket: [],
      prizeConfig,
    },
  ];

  return { alias, title, subTitle, window, payload };
}

async function online(api, activityId, config) {
  const res = await api.post("/prod-api/activity/guess/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function offline(api, activityId, config) {
  const res = await api.post("/prod-api/activity/guess/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteActivity(api, activityId, config) {
  const res = await api.post("/prod-api/activity/guess/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteIntegralTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteGuessTask(api, id) {
  const del = await api.delete(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
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
      registerTemplate: "create-register-templates-fast-api.mjs (platformScope=all; signupMode=auto)",
      prize: "create-prizes-fast-api.mjs (bonus)",
      integralTask: "create-guess-integral-task-fast-api.mjs",
      guessTask: "create-guessing-task-fast-api.mjs",
    },
    activity: { titlePrefix: args.titlePrefix, aliasPrefix: args.aliasPrefix, window: activityWindow(args.startOffsetSeconds, args.endDays) },
    verify: { level: verifyLevel, includes: verifyLevel === "full" ? ["draft-checks", "online", "offline"] : ["draft-checks"] },
    writes: { create: true, fullVerify: verifyLevel === "full", cleanup: Boolean(args.cleanup) },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建竞猜大赛活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  if (args.cleanup && !args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要传 --confirm-cleanup（会删除活动与依赖项）。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = { registerTemplateId: "", applyConfigId: "", prizeId: "", integralTaskId: "", guessTaskId: "", activityId: "", activityAlias: "" };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const uploadedImageUrl = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, filePath: config.imagePath });

    const template = await resolveTemplate(api, args.templateAlias).catch(() => ({ id: null, alias: null, detail: null }));

    // 1) register template
    const registerOut = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
      "--dry-run",
    ]);
    if (!registerOut.ok) throw new Error("register template dry-run failed unexpectedly");
    const createdRegister = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
    ]);
    if (!createdRegister.ok) throw new Error(`create register template failed: ${createdRegister.json?.error || createdRegister.stderr}`);
    const rt = createdRegister.json?.created?.[0];
    created.registerTemplateId = String(rt?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.applyConfigId) throw new Error("missing applyConfigId from created register template");

    // 2) prize
    const createdPrize = await runChildJson([
      "skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs",
      "--count",
      "1",
    ]);
    if (!createdPrize.ok) throw new Error(`create prize failed: ${createdPrize.json?.error || createdPrize.stderr}`);
    created.prizeId = String(createdPrize.json?.created?.[0]?.id || "");
    if (!created.prizeId) throw new Error("missing prizeId from created prize");

    // 3) integral task
    const createdIntegralTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-guess-integral-task-fast-api.mjs",
      "--confirm-create",
    ]);
    if (!createdIntegralTask.ok) throw new Error(`create integral task failed: ${createdIntegralTask.json?.error || createdIntegralTask.stderr}`);
    created.integralTaskId = String(createdIntegralTask.json?.created?.id || "");
    if (!created.integralTaskId) throw new Error("missing integralTaskId");

    // 4) guessing task
    const createdGuessTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-guessing-task-fast-api.mjs",
      "--confirm-create",
    ]);
    if (!createdGuessTask.ok) throw new Error(`create guess task failed: ${createdGuessTask.json?.error || createdGuessTask.stderr}`);
    created.guessTaskId = String(createdGuessTask.json?.created?.id || "");
    if (!created.guessTaskId) throw new Error("missing guessTaskId");

    // 5) create activity
    const built = buildActivityPayload({ templateDetail: template.detail, args, created, uploadedImageUrl });
    const createdActivity = await api.post("/prod-api/activity/config", built.payload);
    if (createdActivity.body?.code !== 200) throw new Error(`Create GUESS activity failed: ${JSON.stringify({ code: createdActivity.body?.code, msg: createdActivity.body?.msg || createdActivity.body?.message })}`);

    const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=GUESS&showUrl=${encodeURIComponent(built.alias)}`);
    const row = firstRow(list);
    const activityId = row?.activityId || row?.id;
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);
    created.activityId = String(activityId);
    created.activityAlias = built.alias;

    // 6) min verify: draft-checks
    const draftChecks = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = draftChecks.body?.data || {};
    const minOk =
      d?.type === "GUESS" &&
      Boolean(d?.applyConfigId) &&
      Array.isArray(d?.guessList) &&
      d.guessList.length >= 1;
    const verify = { ok: Boolean(minOk), checks: { type: d?.type, applyConfigId: d?.applyConfigId ?? null, guessListCount: Array.isArray(d?.guessList) ? d.guessList.length : null } };

    let fullVerify = null;
    if (verifyLevel === "full") {
      const on = await online(api, activityId, config);
      if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);
      const off = await offline(api, activityId, config);
      if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);
      fullVerify = { ok: true, online: on.body, offline: off.body };
    }

    let cleanedUp = null;
    if (args.cleanup) {
      await offline(api, activityId, config).catch(() => {});
      const delAct = await deleteActivity(api, activityId, config);
      const delIntegral = await deleteIntegralTask(api, created.integralTaskId);
      const delGuessTask = await deleteGuessTask(api, created.guessTaskId);
      const delPrize = await deletePrize(api, created.prizeId);
      const delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      cleanedUp = { activity: delAct, integralTask: delIntegral, guessTask: delGuessTask, prize: delPrize, registerTemplate: delRegister };
    }

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/guessCompetition`,
      template: { alias: template.alias, id: template.id },
      created,
      uploadedImageUrl,
      verify,
      fullVerify,
      cleanedUp,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api?.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

