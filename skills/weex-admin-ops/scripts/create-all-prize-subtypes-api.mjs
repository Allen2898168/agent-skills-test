#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-all-prize-subtypes-api.mjs

Options:
  --dry-run                 Print planned prize keys only; no API writes
  --force                   Create even if alias already exists (not recommended)
  --cleanup-previous        Delete prizes created by the previous english-key run (VIRTUAL-*) and TEST_GIFT_CASH
  --drop-usdt               Also create DROP prize for USDT only (币种-USDT)
  --include-drop            Also create DROP prizes (币种). Not recommended without --drop-max.
  --drop-max <n>            When --include-drop, limit created DROP coins to first n items (default: 0)
  --help                    Show this help

Notes:
  - Creates 1 prize per (prizeType, prizeSubType) subtype.
  - Prize name + alias format (中文): <主类型>-<子类型>
  - DROP subtypes are derived from /asset/adjust/listSystemType (id=125, supportCoins).
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--force", "--include-drop", "--cleanup-previous", "--drop-usdt"] });
  args.dryRun = Boolean(args.dryRun);
  args.force = Boolean(args.force);
  args.includeDrop = Boolean(args.includeDrop);
  args.cleanupPrevious = Boolean(args.cleanupPrevious);
  args.dropUsdt = Boolean(args.dropUsdt);
  args.dropMax = args.dropMax === undefined ? 0 : Number(args.dropMax);
  if (!Number.isFinite(args.dropMax) || args.dropMax < 0) throw new Error("--drop-max must be a non-negative number");
  return args;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function prizeTypeLabel(prizeType) {
  const map = {
    DROP: "币种",
    GIFT_CASH: "赠金",
    PHYSICAL: "实物",
    VIRTUAL: "虚拟积分或资格",
  };
  return map[prizeType] || prizeType;
}

function virtualSubTypeLabel(prizeSubType) {
  const map = {
    LOTTERY_COUNT: "抽奖次数",
    INTEGRAL: "积分",
    FUTURES_COUPON: "合约抵扣金",
    POSITION_AIRDROP: "仓位空投",
    MULTIPLIER_COUPON: "膨胀券",
    DICE: "骰子",
    NO_REWARD: "无奖励",
    VIP: "VIP体验卡",
    MINING_LEVEL: "提升返还比例档位",
    FLIP_CARD: "小丑牌-抽牌次数",
    FLIP_INTEGRAL: "小丑牌-积分加成",
    DEMO_GIFT_CASH: "虚拟盘合约体验金",
    FINANCIAL_INTEREST_COUPON: "理财加息券",
    DAILY_FIXED_INCOME_COUPON: "每日固定收益券",
  };
  return map[prizeSubType] || prizeSubType;
}

function buildPrizeName({ prizeType, prizeSubType, dropCoins }) {
  const main = prizeTypeLabel(prizeType);
  let sub = "";
  if (prizeType === "DROP") {
    const coin = (dropCoins || []).find(item => String(item?.coinId) === String(prizeSubType));
    sub = String(coin?.coinName || prizeSubType);
  } else if (prizeType === "GIFT_CASH") {
    sub = "赠金";
  } else if (prizeType === "PHYSICAL") {
    sub = "实物";
  } else if (prizeType === "VIRTUAL") {
    sub = virtualSubTypeLabel(prizeSubType);
  } else {
    sub = String(prizeSubType);
  }
  return `${main}-${sub}`;
}

function buildDesiredPrizeSpecs({ includeDrop, dropMax, dropUsdt, dropCoins }) {
  const desired = [];

  desired.push({ prizeType: "GIFT_CASH", prizeSubType: "GIFT_CASH" });
  desired.push({ prizeType: "PHYSICAL", prizeSubType: "PHYSICAL" });

  if (dropUsdt) {
    const usdt = dropCoins.find(item => String(item?.coinName || "").toUpperCase() === "USDT");
    if (!usdt?.coinId) throw new Error("drop-usdt requested but USDT coinId not found in supportCoins");
    desired.push({ prizeType: "DROP", prizeSubType: String(usdt.coinId) });
  }

  if (includeDrop && dropMax > 0) {
    for (const coin of dropCoins.slice(0, dropMax)) {
      desired.push({ prizeType: "DROP", prizeSubType: String(coin.coinId) });
    }
  }

  for (const subtype of [
    "LOTTERY_COUNT",
    "INTEGRAL",
    "FUTURES_COUPON",
    "POSITION_AIRDROP",
    "MULTIPLIER_COUPON",
    "DICE",
    "NO_REWARD",
    "VIP",
    "MINING_LEVEL",
    "FLIP_CARD",
    "FLIP_INTEGRAL",
    "DEMO_GIFT_CASH",
    "FINANCIAL_INTEREST_COUPON",
    "DAILY_FIXED_INCOME_COUPON",
  ]) {
    desired.push({ prizeType: "VIRTUAL", prizeSubType: subtype });
  }

  return desired;
}

async function uploadDefaultPrizeImage({ baseUrl, authorization, imagePath }) {
  const fileBytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath) || "default.webp";
  const file = new File([fileBytes], fileName, { type: "image/webp" });
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${baseUrl}/prod-api/common/uploadImgReplace`, {
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

async function fetchDropCoins(session) {
  const res = await session.get("/prod-api/asset/adjust/listSystemType");
  if (res.status >= 400) throw new Error(`coin list HTTP ${res.status}`);
  const raw = res.body;
  const list = Array.isArray(raw)
    ? raw
    : (Number(raw?.code) === 200 && Array.isArray(raw?.data) ? raw.data : null);
  if (!list) throw new Error(`coin list failed: ${JSON.stringify({ code: raw?.code, msg: raw?.msg || raw?.message, kind: Array.isArray(raw) ? "array" : typeof raw })}`);
  const spotFilterCoinId = 125; // activity-web activity-ui/src/views/activity/const/whiteList.js
  const supportCoins = list.find(item => Number(item?.id) === spotFilterCoinId)?.supportCoins;
  return Array.isArray(supportCoins) ? supportCoins : [];
}

async function fetchContractList(session) {
  const res = await session.get("/prod-api/activity/productList");
  if (res.status >= 400) throw new Error(`contract list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`contract list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const list = Array.isArray(res.body?.data) ? res.body.data : [];
  return list.map(item => ({ name: String(item?.name || ""), value: String(item?.value || "") })).filter(item => item.name && item.value);
}

function findUsdtCoinId(dropCoins) {
  const usdt = dropCoins.find(item => String(item?.coinName || "").toUpperCase() === "USDT");
  if (!usdt) return null;
  const id = Number(usdt.coinId);
  return Number.isFinite(id) ? id : null;
}

function buildPrizePayload({ prizeType, prizeSubType, displayName, picture, contractList, usdtCoinId }) {
  const prizeName = String(displayName || "");
  if (!prizeName) throw new Error(`missing displayName for ${prizeType}/${prizeSubType}`);
  const base = {
    prizeType,
    prizeSubType,
    prizeName,
    prizeAlias: prizeName,
    prizeUnit: "1",
    prizeNameI18: [],
    picture,
    prizeScale: prizeType === "DROP" ? 8 : 2,
    efficientDay: 1,
    couponEfficientDay: undefined,
  };

  if (prizeType === "GIFT_CASH") {
    return {
      ...base,
      prizeScale: 2,
      efficientDay: 1,
      couponEfficientDay: 1,
      deductRatio: 1,
    };
  }

  if (prizeType === "DROP") {
    return {
      ...base,
      prizeScale: 8,
      efficientDay: 1,
    };
  }

  if (prizeType === "PHYSICAL") {
    return {
      ...base,
      prizeScale: 2,
      efficientDay: 1,
    };
  }

  if (prizeType !== "VIRTUAL") {
    return base;
  }

  if (prizeSubType === "LOTTERY_COUNT") {
    return {
      ...base,
      prizeThreeTierType: 1,
      prizeScale: 2,
      efficientDay: 1,
    };
  }

  if (prizeSubType === "FUTURES_COUPON") {
    return {
      ...base,
      prizeScale: 2,
      efficientDay: 1,
      couponEfficientDay: 1,
    };
  }

  if (prizeSubType === "POSITION_AIRDROP") {
    const firstContract = contractList[0] || null;
    if (!firstContract) throw new Error("POSITION_AIRDROP requires at least 1 contract product from /activity/productList");
    return {
      ...base,
      prizeUnit: undefined,
      prizeScale: undefined,
      efficientDay: 1,
      couponEfficientDay: 1,
      coinId: 2, // modal.vue currencyList default: USDT=2
      productCode: String(firstContract.value),
      productValues: [String(firstContract.name)],
      mode: 2, // modal.vue marginModeList default only: 2
      leverage: 1,
      rewardAmount: "1",
    };
  }

  if (prizeSubType === "MULTIPLIER_COUPON") {
    return {
      ...base,
      prizeScale: 0,
      efficientDay: 0,
      multiplier: 2,
    };
  }

  if (prizeSubType === "DICE") {
    return {
      ...base,
      prizeScale: 0,
      efficientDay: 0,
    };
  }

  if (prizeSubType === "VIP") {
    return {
      ...base,
      couponEfficientDay: 1,
      vipType: 1,
      vipLevel: 0,
      vipEfficientDay: 1,
      vipLinkUrl: "",
    };
  }

  if (prizeSubType === "MINING_LEVEL") {
    return {
      ...base,
      prizeScale: 0,
      efficientDay: 0,
    };
  }

  if (prizeSubType === "FINANCIAL_INTEREST_COUPON") {
    if (!usdtCoinId) throw new Error("FINANCIAL_INTEREST_COUPON requires USDT coinId from supportCoins");
    return {
      ...base,
      efficientDay: 1,
      couponEfficientDay: 1,
      applicableBizType: 1,
      applicableProductTermType: null,
      coinId: usdtCoinId,
      interestRate: "1",
      minInterestAsset: "",
      maxInterestAsset: "",
    };
  }

  if (prizeSubType === "DAILY_FIXED_INCOME_COUPON") {
    if (!usdtCoinId) throw new Error("DAILY_FIXED_INCOME_COUPON requires USDT coinId from supportCoins");
    return {
      ...base,
      efficientDay: 1,
      couponEfficientDay: 1,
      applicableBizType: 1,
      applicableProductTermType: null,
      coinId: usdtCoinId,
      interestAmount: "1",
      minInterestAsset: "",
      maxInterestAsset: "",
    };
  }

  if (prizeSubType === "DEMO_GIFT_CASH") {
    return {
      ...base,
      efficientDay: 1,
      prizeScale: 2,
    };
  }

  return base;
}

async function findExistingByAlias(session, alias) {
  const q = new URLSearchParams({
    pageNum: "1",
    pageSize: "1",
    prizeAlias: alias,
  });
  const res = await session.get(`/prod-api/activity/prize/list?${q.toString()}`);
  if (res.status >= 400) throw new Error(`prize list HTTP ${res.status}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows[0] || null;
}

async function createPrize(session, payload) {
  const res = await session.post("/prod-api/activity/prize", payload);
  if (res.status >= 400) throw new Error(`create prize HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`create prize rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

async function deletePrizeById(session, id) {
  const res = await session.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`delete prize HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`delete prize rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return true;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  const { chromium } = loadPlaywright();
  const session = await createAdminApiSession({ chromium, config });

  try {
    const dropCoins = await fetchDropCoins(session);
    const contractList = await fetchContractList(session);
    const usdtCoinId = findUsdtCoinId(dropCoins);

    const desired = buildDesiredPrizeSpecs({ includeDrop: args.includeDrop, dropMax: args.dropMax, dropUsdt: args.dropUsdt, dropCoins });
    if (args.dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        count: desired.length,
        keys: desired.map(item => buildPrizeName({ ...item, dropCoins })),
      });
      return 0;
    }

    const picture = await uploadDefaultPrizeImage({
      baseUrl,
      authorization: session.authorization,
      imagePath: config.imagePath,
    });

    if (args.cleanupPrevious) {
    const oldAliases = [
      "TEST_GIFT_CASH",
      "undefined-undefined",
      "VIRTUAL-LOTTERY_COUNT",
      "VIRTUAL-INTEGRAL",
      "VIRTUAL-FUTURES_COUPON",
      "VIRTUAL-POSITION_AIRDROP",
        "VIRTUAL-MULTIPLIER_COUPON",
        "VIRTUAL-DICE",
        "VIRTUAL-NO_REWARD",
        "VIRTUAL-VIP",
        "VIRTUAL-MINING_LEVEL",
        "VIRTUAL-FLIP_CARD",
        "VIRTUAL-FLIP_INTEGRAL",
        "VIRTUAL-DEMO_GIFT_CASH",
        "VIRTUAL-FINANCIAL_INTEREST_COUPON",
        "VIRTUAL-DAILY_FIXED_INCOME_COUPON",
      ];
      const deleted = [];
      for (const alias of oldAliases) {
        const existing = await findExistingByAlias(session, alias);
        if (existing?.id) {
          await deletePrizeById(session, existing.id);
          deleted.push({ alias, id: existing.id });
        }
      }
      if (deleted.length) {
        // no-op: proceed to recreate using Chinese aliases
      }
    }

    const created = [];
    const skipped = [];

    for (const spec of desired) {
      const name = buildPrizeName({ ...spec, dropCoins });
      if (!args.force) {
        const existing = await findExistingByAlias(session, name);
        if (existing) {
          skipped.push({ prizeType: spec.prizeType, prizeSubType: spec.prizeSubType, id: existing.id });
          continue;
        }
      }
      const payload = buildPrizePayload({
        prizeType: spec.prizeType,
        prizeSubType: spec.prizeSubType,
        displayName: name,
        picture,
        contractList,
        usdtCoinId,
      });
      await createPrize(session, payload);
      const verify = await findExistingByAlias(session, name);
      if (!verify) throw new Error(`verify failed: created prize not found by alias ${name}`);
      created.push({ prizeType: spec.prizeType, prizeSubType: spec.prizeSubType, id: verify.id });
    }

    printJson({
      ok: true,
      baseUrl,
      totalDesired: desired.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}
