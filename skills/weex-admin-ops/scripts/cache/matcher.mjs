export function matchAction(manifest, args) {
  if (args.action) {
    const action = manifest.actions.find(item => item.id === args.action);
    if (!action) throw new Error(`Cached action not found: ${args.action}`);
    return { action, inferred: {} };
  }
  if (!args.query) throw new Error("Provide --query or --action");
  const candidates = manifest.actions
    .map(action => ({ action, score: scoreAction(action, args.query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) throw new Error(`No cached action matched query: ${args.query}`);
  return {
    action: candidates[0].action,
    inferred: inferPrizeParams(args.query),
    score: candidates[0].score,
  };
}

function scoreAction(action, query) {
  let score = 0;
  if (hasAny(query, action.intentKeywords || [])) score += 2;
  if (hasAny(query, action.objectKeywords || [])) score += 2;
  if (action.supportedCategories?.some(item => query.includes(item))) score += 1;
  if (action.supportedSubtypes?.some(item => query.toUpperCase().includes(String(item).toUpperCase()))) score += 1;
  return score;
}

function inferPrizeParams(query) {
  const upper = query.toUpperCase();
  let category;
  let subtype;
  if (query.includes("赠金")) {
    category = "赠金";
    subtype = "赠金";
  } else if (query.includes("实物")) {
    category = "实物";
    subtype = "实物";
  } else if (query.includes("币种") || upper.includes("BTC") || upper.includes("ETH")) {
    category = "币种";
    if (upper.includes("ETH")) subtype = "ETH";
    else if (upper.includes("BTC")) subtype = "BTC";
  } else if (isVirtualQuery(query)) {
    category = "虚拟积分或资格";
    subtype = virtualSubtype(query);
  }
  return {
    category,
    subtype,
    count: chineseNumberToInt(query) || 1,
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
    namePrefix: subtype ? `${subtype}奖励` : undefined,
    aliasPrefix: subtype ? `cached_${subtype.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}` : undefined,
  };
}

function isVirtualQuery(query) {
  return ["虚拟积分", "资格", "积分", "抽奖次数", "无奖励", "仓位空投", "合约抵扣金"].some(word => query.includes(word));
}

function virtualSubtype(query) {
  if (query.includes("抽奖次数")) return "抽奖次数";
  if (query.includes("无奖励")) return "无奖励";
  if (query.includes("仓位空投")) return "仓位空投";
  if (query.includes("合约抵扣金")) return "合约抵扣金";
  return "积分";
}

function hasAny(text, words) {
  return words.some(word => text.toLowerCase().includes(String(word).toLowerCase()));
}

function chineseNumberToInt(text) {
  const map = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const digit = text.match(/(\d+)\s*个?/);
  if (digit) return Number(digit[1]);
  const zh = text.match(/([一两二三四五六七八九十])\s*个?/);
  return zh ? map[zh[1]] : undefined;
}
