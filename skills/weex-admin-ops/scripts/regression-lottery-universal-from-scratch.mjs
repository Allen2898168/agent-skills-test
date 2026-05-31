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
  node skills/weex-admin-ops/scripts/regression-lottery-universal-from-scratch.mjs --dry-run

  # run (writes)
  node skills/weex-admin-ops/scripts/regression-lottery-universal-from-scratch.mjs --confirm-run

Options:
  --title-prefix <text>       default 转盘通用回归
  --alias-prefix <text>       default lr
  --raffle-style <value>      default EASTER_EGG
  --contract-required-volume <n> default 1
  --spot-required-volume <n>     default 1
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "转盘通用回归";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "lr";
  args.raffleStyle = args.raffleStyle ? String(args.raffleStyle) : "EASTER_EGG";
  args.contractRequiredVolume = args.contractRequiredVolume ? Number(args.contractRequiredVolume) : 1;
  args.spotRequiredVolume = args.spotRequiredVolume ? Number(args.spotRequiredVolume) : 1;
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

async function lotteryOnline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/lottery/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function lotteryOffline(api, config, activityId) {
  const res = await api.post("/prod-api/activity/lottery/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function lotteryDelete(api, config, activityId) {
  const res = await api.post("/prod-api/activity/lottery/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function unbindLotteryDependencies(api, activityId, { applyConfigId = 2442 } = {}) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data;
  if (!item || detail.body?.code !== 200) throw new Error(`Activity detail failed: ${activityId}`);
  const patched = JSON.parse(JSON.stringify(item));
  patched.applyConfigId = Number(applyConfigId);
  if ("applyConfig" in patched) patched.applyConfig = { id: Number(applyConfigId) };
  const put = await api.put("/prod-api/activity/config", patched);
  return { ok: put.body?.code === 200, status: put.status, body: { code: put.body?.code ?? null, msg: put.body?.msg || "" } };
}

function buildPrizeSlots({ linkPrizeId, prizeName, picture, raffleStyle }) {
  const slots = [];
  const labels = ["GRAND", "MIDDLE", "SMALL", "MIDDLE", "SMALL", "MIDDLE", "SMALL", "MIDDLE"];
  for (let i = 1; i <= 8; i += 1) {
    slots.push({
      prizeId: i,
      linkPrizeId: Number(linkPrizeId),
      prizeType: 4,
      prizeName: String(prizeName || `POSITION_${linkPrizeId}`),
      rewardAmount: 1,
      inventoryQuantity: 100,
      weight: 12.5,
      picture: String(picture || ""),
      order: i,
      label: labels[i - 1] || "MIDDLE",
      easterEggType: raffleStyle === "EASTER_EGG" ? 1 : null,
      shareList: [],
    });
  }
  return slots;
}

async function attemptCleanup({ config, created }) {
  const cleanup = {
    unbindActivity: null,
    offline: null,
    deleteActivity: null,
    deleteTasks: [],
    deletePrize: null,
    deleteLotteryCountPrize: null,
    deleteRegisterTemplate: null,
  };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });
    if (created.activityId) {
      cleanup.offline = await lotteryOffline(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.unbindActivity = await unbindLotteryDependencies(api, created.activityId, { applyConfigId: 2442 }).catch(err => ({ ok: false, error: err?.message || String(err) }));
      cleanup.deleteActivity = await lotteryDelete(api, config, created.activityId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    }
    if (created.taskIds?.length) {
      for (const id of created.taskIds) cleanup.deleteTasks.push({ id: String(id), ...(await deleteTask(api, id).catch(err => ({ ok: false, error: err?.message || String(err) }))) });
    }
    if (created.prizeId) cleanup.deletePrize = await deletePrize(api, created.prizeId).catch(err => ({ ok: false, error: err?.message || String(err) }));
    if (created.lotteryCountPrizeId) cleanup.deleteLotteryCountPrize = await deletePrize(api, created.lotteryCountPrizeId).catch(err => ({ ok: false, error: err?.message || String(err) }));
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
    activityType: "LOTTERY",
    raffleStyle: args.raffleStyle,
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    writes: { create: true, online: true, offline: true, cleanup: args.cleanup },
    dependencies: ["报名模板(从零)", "奖品(仓位空投, 从零)", "奖品(抽奖次数, 从零)", "任务(合约/现货, 从零)", "图片上传(uploadImgReplace)"],
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
    lotteryCountPrizeId: "",
    taskIds: [],
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

    const countPrize = await runChildJson(["skills/weex-admin-ops/scripts/create-lottery-count-prize-from-scratch-fast-api.mjs", "--confirm-create"]);
    steps.push({ name: "create_lottery_count_prize_from_scratch", ok: countPrize.ok, prizeId: countPrize.json?.created?.id || null });
    if (!countPrize.ok) throw new Error(`lottery count prize create failed: ${countPrize.json?.error || "unknown"}`);
    created.lotteryCountPrizeId = String(countPrize.json?.created?.id || "");
    if (!created.lotteryCountPrizeId) throw new Error("missing lotteryCountPrizeId");

    const contractTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-roulette-contract-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.contractRequiredVolume),
      "--lottery-count-prize-id",
      String(created.lotteryCountPrizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_contract_volume_task_from_scratch", ok: contractTask.ok, taskId: contractTask.json?.created?.id || null });
    if (!contractTask.ok) throw new Error(`contract task create failed: ${contractTask.json?.error || "unknown"}`);
    const contractTaskId = String(contractTask.json?.created?.id || "");
    if (!contractTaskId) throw new Error("missing contractTaskId");

    const spotTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-roulette-spot-volume-task-from-scratch-fast-api.mjs",
      "--required-volume",
      String(args.spotRequiredVolume),
      "--lottery-count-prize-id",
      String(created.lotteryCountPrizeId),
      "--confirm-create",
    ]);
    steps.push({ name: "create_spot_volume_task_from_scratch", ok: spotTask.ok, taskId: spotTask.json?.created?.id || null });
    if (!spotTask.ok) throw new Error(`spot task create failed: ${spotTask.json?.error || "unknown"}`);
    const spotTaskId = String(spotTask.json?.created?.id || "");
    if (!spotTaskId) throw new Error("missing spotTaskId");

    created.taskIds = [contractTaskId, spotTaskId];

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const prizeDetail = await api.get(`/prod-api/activity/prize/${encodeURIComponent(created.prizeId)}`);
    if (prizeDetail.body?.code !== 200 || !prizeDetail.body?.data) throw new Error(`prize detail failed: ${created.prizeId}`);
    const prizeName = prizeDetail.body.data?.prizeName || `POSITION_${created.prizeId}`;
    const prizePicture = prizeDetail.body.data?.picture || uploadedBanner;

    const window = activityWindow(args.startOffsetSeconds, args.endDays);
    const alias = `${args.aliasPrefix}${Date.now().toString().slice(-8)}`.slice(0, 10);
    const title = `${args.titlePrefix}${String(Date.now()).slice(-6)}`.slice(0, 15);

    const payload = {
      type: "LOTTERY",
      configType: 1,
      channelCategory: "UNIVERSAL",
      activityOwner: "auto",
      title,
      subTitle: "自动化副标题",
      showUrl: alias,
      startTime: window.start,
      endTime: window.end,
      applyConfigId: Number(created.registerTemplateId),
      raffleStyle: String(args.raffleStyle),
      periods: 0,
      periodValidity: null,
      webBannerUrl: uploadedBanner,
      appBannerUrl: uploadedBanner,
      webShareUrl: uploadedBanner,
      appShareUrl: uploadedBanner,
      shareContent: "自动化分享文案",
      agentShareContent: "自动化代理分享文案",
      intro: "<p>自动化活动规则</p>",
      prize: buildPrizeSlots({ linkPrizeId: created.prizeId, prizeName, picture: prizePicture, raffleStyle: String(args.raffleStyle) }),
      taskConfig: [
        { id: Number(contractTaskId), order: 1 },
        { id: Number(spotTaskId), order: 2 },
      ],
      showBeginnerTaskConfig: [],
      activityConfigI18n: [],
      questions: [],
    };

    const createRes = await api.post("/prod-api/activity/config", payload);
    const createOk = createRes.body?.code === 200;
    steps.push({ name: "create_lottery_activity", ok: createOk, response: { code: createRes.body?.code ?? null, msg: createRes.body?.msg || "" }, alias, title });
    if (!createOk) throw new Error(`Create lottery activity failed: ${JSON.stringify({ code: createRes.body?.code, msg: createRes.body?.msg || createRes.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`);
    const row = firstRow(verifyList);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created lottery activity not found by alias: ${alias}`);
    created.activityId = activityId;
    created.activityAlias = alias;
    created.activityTitle = title;

    const checks = await runChildJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "draft-checks", "--activity-id", String(activityId)]);
    steps.push({ name: "draft_checks", ok: checks.ok, checks: checks.json?.searchChecks || null });
    if (!checks.ok) throw new Error(`draft-checks failed: ${checks.json?.error || "unknown"}`);

    await api.close().catch(() => {});
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const on = await lotteryOnline(api, config, activityId);
    steps.push({ name: "online", ok: on.ok, response: on.body });
    if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);

    const off = await lotteryOffline(api, config, activityId);
    steps.push({ name: "offline", ok: off.ok, response: off.body });
    if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);

    let cleanup = null;
    if (args.cleanup) {
      await api.close().catch(() => {});
      cleanup = await attemptCleanup({ config, created });
      const ok = Boolean(
        cleanup.deleteActivity?.ok !== false
          && (cleanup.deleteTasks || []).every(v => v.ok)
          && cleanup.deletePrize?.ok !== false
          && cleanup.deleteLotteryCountPrize?.ok !== false
          && cleanup.deleteRegisterTemplate?.ok !== false,
      );
      steps.push({ name: "cleanup", ok, cleanup });
    }

    const result = {
      ok: true,
      caseId: "LOTTERY_universal_from_scratch",
      created,
      links: [
        { label: "后台转盘抽奖列表", url: `${config.baseUrl}/activities/lottery` },
        { label: "前台转盘抽奖页", url: `https://stg-www.weex.tech/zh-CN/events/draw/${created.activityAlias}` },
      ],
      durationMs: Date.now() - startedAt,
      cleanup,
    };

    const md = writeResultMarkdown({
      repoRoot,
      suite: "universal-regression",
      caseId: result.caseId,
      title: "转盘抽奖(LOTTERY) 通用回归（从零配置）",
      summary: {
        ok: true,
        activityId: created.activityId,
        activityAlias: created.activityAlias,
        startTime: plan.window.start,
        endTime: plan.window.end,
        raffleStyle: args.raffleStyle,
        contractRequiredVolume: args.contractRequiredVolume,
        spotRequiredVolume: args.spotRequiredVolume,
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
      caseId: "LOTTERY_universal_from_scratch_failed",
      title: "转盘抽奖(LOTTERY) 通用回归（失败）",
      summary: { ok: false, error: error.message, created, cleanup: args.cleanup },
      links: [{ label: "后台转盘抽奖列表", url: `${config.baseUrl}/activities/lottery` }],
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
