#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-resource-card-from-scratch-fast-api.mjs --activity-type TRACE_PRO --count 3 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-resource-card-from-scratch-fast-api.mjs --activity-type TRACE_PRO --count 3 --confirm-create

Options:
  --activity-type <type>     required; e.g. BEGINNER_TASK | TRACE_PRO | RACE_COMPETITION ...
  --count <n>                default 1
  --name-prefix <text>       default 资源卡_从零
  --web-url <url>            default https://stg-www.weex.tech/
  --button-name <text>       default 立即查看
  --sub-title <text>         default 自动化子标题
  --show-introduction <0|1>  default 0
  --introduction <html>      optional; used when --show-introduction=1
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.activityType = args.activityType ? String(args.activityType) : "";
  args.count = args.count ? Number(args.count) : 1;
  args.count = Math.max(1, Math.min(20, Number.isFinite(args.count) ? args.count : 1));
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "资源卡_从零";
  args.webUrl = args.webUrl ? String(args.webUrl) : "https://stg-www.weex.tech/";
  args.buttonName = args.buttonName ? String(args.buttonName) : "立即查看";
  args.subTitle = args.subTitle ? String(args.subTitle) : "自动化子标题";
  args.showIntroduction = args.showIntroduction !== undefined ? Number(args.showIntroduction) : 0;
  args.introduction = args.introduction ? String(args.introduction) : "";
  return args;
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

function buildPayload({ activityType, name, args, imageUrl }) {
  const showIntroduction = Number(args.showIntroduction) ? 1 : 0;
  return {
    activityType,
    name,
    title: name,
    subTitle: args.subTitle,
    subTitleI18n: [],
    buttonName: args.buttonName,
    buttonNameI18n: [],
    titleI18n: [],
    showIntroduction,
    ...(showIntroduction === 1 ? { introduction: args.introduction || "<p>自动化介绍</p>", introductionI18n: [] } : {}),
    imageUrl,
    imageUrlI18n: [],
    webUrl: args.webUrl,
    webUrlI18n: [],
    appUrl: null,
    status: 1,
  };
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/resource/${encodeURIComponent(String(id))}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Resource card detail failed: ${id}`);
  return res.body.data;
}

async function listPage(api, { pageNum = 1, pageSize = 10, activityType = "", name = "" } = {}) {
  const qs = new URLSearchParams();
  qs.set("pageNum", String(pageNum));
  qs.set("pageSize", String(pageSize));
  if (activityType) qs.set("activityType", String(activityType));
  if (name) qs.set("name", String(name));
  return api.get(`/prod-api/activity/resource/list?${qs.toString()}`);
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.activityType) throw new Error("--activity-type is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = {
    mode: "headless_api",
    activityType: args.activityType,
    count: args.count,
    payloadPreview: { namePrefix: args.namePrefix, webUrl: args.webUrl, buttonName: args.buttonName, subTitle: args.subTitle, showIntroduction: Boolean(Number(args.showIntroduction)) },
    writes: { uploadImage: true, create: true },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建资源位信息卡片。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const imageUrl = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });
    const created = [];
    for (let i = 0; i < args.count; i += 1) {
      const name = `${args.namePrefix}_${timestamp()}_${i + 1}`.slice(0, 60);
      const payload = buildPayload({ activityType: args.activityType, name, args, imageUrl });
      const res = await api.post("/prod-api/activity/resource", payload);
      if (res.body?.code !== 200) throw new Error(`Create resource card failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
      const createdId = res.body?.data?.id ?? res.body?.data ?? res.body?.id ?? "";
      let det = null;
      if (createdId) det = await detail(api, createdId).catch(() => null);
      if (!det) {
        const list = await listPage(api, { pageNum: 1, pageSize: 5, activityType: args.activityType, name });
        const rows = Array.isArray(list.body?.rows) ? list.body.rows : Array.isArray(list.body?.data) ? list.body.data : [];
        const row = rows.find(item => String(item?.name || "") === name) || firstRow(list);
        if (!row?.id) throw new Error(`Created resource card not found in list: ${name}`);
        det = await detail(api, row.id);
      }
      created.push({ id: String(det.id), name: String(det.name || name), activityType: det.activityType ?? null, status: det.status ?? null, webUrl: det.webUrl ?? null });
    }
    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/resource`,
      created,
      uploadedImageUrl: imageUrl,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

