import path from "node:path";
import { readJson, timestamp } from "../../lib/cli.mjs";

export function buildPrizePlan(args) {
  if (args.plan) {
    const parsed = readJson(path.resolve(args.plan));
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("--plan must contain a non-empty JSON array");
    return parsed.map((item, index) => normalizeReward(item, index + 1, timestamp()));
  }
  if (!args.category || !args.subtype) throw new Error("Either --plan or both --category and --subtype are required");
  const ts = timestamp();
  return Array.from({ length: args.count }, (_, index) => normalizeReward({
    category: args.category,
    subtype: args.subtype,
    name: args.namePrefix ? `${args.namePrefix}${args.count > 1 ? index + 1 : ""}_${ts}` : undefined,
    alias: args.aliasPrefix ? `${args.aliasPrefix}_${args.count > 1 ? `${index + 1}_` : ""}${ts}` : undefined,
  }, index + 1, ts));
}

function normalizeReward(item, index, ts) {
  if (!item.category || !item.subtype) throw new Error(`Plan item ${index} requires category and subtype`);
  const slug = slugFor(item.category, item.subtype);
  return {
    category: item.category,
    subtype: item.subtype,
    name: item.name || `${item.subtype}奖品${index}_${ts}`,
    alias: item.alias || `${slug}_${index}_${ts}`,
    enName: item.enName || `Auto ${slug} ${index} ${ts}`,
    unit: item.unit ?? "1",
    precision: item.precision ?? "2",
    validDays: item.validDays ?? "1",
    receiveDays: item.receiveDays ?? "1",
    issueDays: item.issueDays ?? "1",
    discountRatio: item.discountRatio ?? "1",
    color: item.color,
    coin: item.coin,
    tradePair: item.tradePair,
    marginMode: item.marginMode,
    leverage: item.leverage ?? "1",
    quantity: item.quantity ?? "1",
  };
}

function slugFor(category, subtype) {
  const map = {
    "赠金/赠金": "bonus",
    "币种/BTC": "coin_btc",
    "币种/ETH": "coin_eth",
    "实物/实物": "physical",
    "虚拟积分或资格/积分": "virtual_points",
    "虚拟积分或资格/抽奖次数": "virtual_draw",
    "虚拟积分或资格/无奖励": "virtual_none",
    "虚拟积分或资格/仓位空投": "virtual_position",
  };
  return map[`${category}/${subtype}`] || "prize";
}
