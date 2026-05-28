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
  node skills/weex-admin-ops/scripts/create-position-airdrop-prize-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-position-airdrop-prize-fast-api.mjs --confirm-create --coin DOGE --required-amount 1 --leverage 1

Options:
  --coin <symbol>            default DOGE
  --contract-keyword <text>  default same as --coin
  --product-code <code>      optional override
  --required-amount <n>      default 1 (仓位数量)
  --leverage <n>             default 1
  --mode <n>                 default 2 (margin mode)
  --efficient-day <n>        default 1
  --coupon-efficient-day <n> default 1
  --name-prefix <text>       default 自动化-仓位空投
  --alias-prefix <text>      default api_pos
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.coin = args.coin ? String(args.coin) : "DOGE";
  args.contractKeyword = args.contractKeyword ? String(args.contractKeyword) : args.coin;
  args.productCode = args.productCode ? String(args.productCode) : "";
  args.requiredAmount = args.requiredAmount ? String(args.requiredAmount) : "1";
  args.leverage = Number(args.leverage || 1);
  args.mode = Number(args.mode || 2);
  args.efficientDay = Number(args.efficientDay || 1);
  args.couponEfficientDay = Number(args.couponEfficientDay || 1);
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "自动化-仓位空投";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "api_pos";
  return args;
}

async function fetchSupportCoins(session) {
  const res = await session.get("/prod-api/asset/adjust/listSystemType");
  if (res.status >= 400) throw new Error(`coin list HTTP ${res.status}`);
  const raw = res.body;
  const list = Array.isArray(raw)
    ? raw
    : (Number(raw?.code) === 200 && Array.isArray(raw?.data) ? raw.data : null);
  if (!list) throw new Error(`coin list failed: ${JSON.stringify({ code: raw?.code, msg: raw?.msg || raw?.message })}`);
  const spotFilterCoinId = 125;
  const supportCoins = list.find(item => Number(item?.id) === spotFilterCoinId)?.supportCoins;
  return Array.isArray(supportCoins) ? supportCoins : [];
}

function pickCoinId(supportCoins, symbol) {
  const upper = String(symbol || "").toUpperCase();
  const hit = supportCoins.find(item => String(item?.coinName || "").toUpperCase() === upper);
  const id = Number(hit?.coinId);
  return Number.isFinite(id) ? id : null;
}

async function fetchContractList(session) {
  const res = await session.get("/prod-api/activity/productList");
  if (res.status >= 400) throw new Error(`contract list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`contract list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const list = Array.isArray(res.body?.data) ? res.body.data : [];
  return list
    .map(item => ({ name: String(item?.name || ""), value: String(item?.value || "") }))
    .filter(item => item.name && item.value);
}

function pickContract(contractList, keyword) {
  const needle = String(keyword || "").toLowerCase();
  if (!needle) return contractList[0] || null;
  return contractList.find(item => item.name.toLowerCase().includes(needle)) || contractList[0] || null;
}

async function uploadPrizeImage({ baseUrl, authorization, imagePath }) {
  const fileBytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath) || "default.webp";
  const file = new File([fileBytes], fileName, { type: "image/webp" });
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/prod-api/common/uploadImgReplace`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`uploadImgReplace failed: HTTP ${response.status}`);
  if (Number(body?.code) !== 200) throw new Error(`uploadImgReplace not accepted: ${JSON.stringify({ code: body?.code, msg: body?.msg || body?.message })}`);
  if (!body?.data) throw new Error("uploadImgReplace missing data");
  return body.data;
}

function buildPrizePayload({ args, coinId, product }) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const prizeName = `${args.namePrefix}_${args.coin}_${ts}_${short}`.slice(0, 60);
  const prizeAlias = `${args.aliasPrefix}_${args.coin.toLowerCase()}_${short}`.slice(0, 60);
  return {
    prizeType: "VIRTUAL",
    prizeSubType: "POSITION_AIRDROP",
    prizeName,
    prizeAlias,
    prizeNameI18: [],
    picture: "",
    efficientDay: args.efficientDay,
    couponEfficientDay: args.couponEfficientDay,
    coinId: Number(coinId),
    productCode: String(product.value),
    productValues: [String(product.name)],
    mode: Number(args.mode),
    leverage: Number(args.leverage),
    rewardAmount: String(args.requiredAmount),
  };
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
    prize: { type: "VIRTUAL", subtype: "POSITION_AIRDROP", coin: args.coin, requiredAmount: args.requiredAmount, leverage: args.leverage, marginMode: args.mode },
    contractPick: { keyword: args.contractKeyword, productCodeOverride: args.productCode || null },
    writes: { create: true },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建仓位空投奖品。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const supportCoins = await fetchSupportCoins(api);
    const coinId = pickCoinId(supportCoins, args.coin);
    if (!coinId) throw new Error(`币种不存在或不在白名单：${args.coin}`);

    const contractList = await fetchContractList(api);
    const product = args.productCode
      ? contractList.find(item => item.value === args.productCode) || null
      : pickContract(contractList, args.contractKeyword);
    if (!product) throw new Error(`合约交易对不存在：keyword=${args.contractKeyword}`);

    const picture = await uploadPrizeImage({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });
    const payload = buildPrizePayload({ args, coinId, product });
    payload.picture = picture;

    const created = await api.post("/prod-api/activity/prize", payload);
    if (created.body?.code !== 200) throw new Error(`Create prize failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(payload.prizeAlias)}`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created prize not found by alias: ${payload.prizeAlias}`);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/prize`,
      created: {
        id: String(row.id),
        prizeName: row.prizeName || payload.prizeName,
        prizeAlias: row.prizeAlias || payload.prizeAlias,
        prizeType: payload.prizeType,
        prizeSubType: payload.prizeSubType,
        coinId: payload.coinId,
        productCode: payload.productCode,
        productValues: payload.productValues,
        leverage: payload.leverage,
        rewardAmount: payload.rewardAmount,
      },
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}
