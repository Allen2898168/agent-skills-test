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
    inferred: inferParams(args.query),
    score: candidates[0].score,
  };
}

function scoreAction(action, query) {
  let score = 0;
  if (hasAny(query, action.intentKeywords || [])) score += 2;
  if (hasAny(query, action.objectKeywords || [])) score += 2;
  if (hasAny(query, action.scopeKeywords || [])) score += 2;
  if (action.supportedCategories?.some(item => query.includes(item))) score += 1;
  if (action.supportedSubtypes?.some(item => query.toUpperCase().includes(String(item).toUpperCase()))) score += 1;
  return score;
}

function inferParams(query) {
  return {
    ...inferPrizeParams(query),
    ...inferRouletteParticipantParams(query),
    ...inferRegisterTemplateParams(query),
    prizeId: inferPrizeId(query),
  };
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

function inferPrizeId(query) {
  const match = query.match(/(?:奖品\s*(?:id|ID)|prize\s*id)\s*(?:为|是|=|:|：)?\s*(\d+)/i)
    || query.match(/\bID\s*(?:为|是|=|:|：)?\s*(\d+)/i);
  return match ? match[1] : undefined;
}

function inferRouletteParticipantParams(query) {
  if (!query.includes("转盘抽奖") && !query.includes("参与范围")) return {};
  const scopes = [];
  const scopeMap = [
    ["报名的所有用户", "all"],
    ["VIP", "vip"],
    ["注册新用户", "newuser"],
    ["未充值新用户", "nocharge"],
    ["老用户", "olduser"],
    ["指定代理", "agent"],
    ["指定用户", "user"],
    ["指定国家", "country"],
    ["指定国家或地区", "country"],
    ["国家或地区", "country"],
  ];
  for (const [word, scope] of scopeMap) {
    if (query.includes(word) && !scopes.includes(scope)) scopes.push(scope);
  }
  const uidMatch = query.match(/(?:uid|UID)\s*(?:暂时用|用|为|是|=|:|：)?\s*(\d+)/);
  const countryMatch = query.match(/(?:国家|地区)\s*(?:用|为|是|=|:|：)\s*([\u4e00-\u9fa5A-Za-z -]+)/);
  return {
    scopes: scopes.length ? scopes.join(",") : undefined,
    uid: uidMatch?.[1],
    country: countryMatch?.[1]?.trim(),
    countryFirst: /国家.*第一个|地区.*第一个|所有下拉第一个/.test(query),
    vipWhitelist: query.includes("同等级允许") ? "同等级允许" : undefined,
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferRegisterTemplateParams(query) {
  if (!query.includes("报名模板") && !query.includes("用户报名管理")) return {};
  const modes = [];
  const modeMap = [
    ["注册即报名", "auto"],
    ["用户手动点击报名", "manual"],
    ["团体报名", "team"],
    ["注册+手动点击报名", "auto_manual"],
  ];
  for (const [word, mode] of modeMap) {
    if (query.includes(word) && !modes.includes(mode)) modes.push(mode);
  }
  const minTeamMatch = query.match(/(?:最小团队人数|团队人数)\s*(?:用|为|是|=|:|：)?\s*(\d+)/);
  const permissions = [];
  if (query.includes("看到和进入页面")) permissions.push("view");
  const permissionTail = query.includes("限制用户权限") ? query.slice(query.indexOf("限制用户权限")) : "";
  if (/限制用户权限.{0,12}(?:选择|选|为|是|=|:|：)?\s*报名(?:$|[,，、和\s])/.test(permissionTail)) permissions.push("signup");
  const peopleLimitMatch = query.match(/(?:限制报名人数|报名人数限制|报名人数)\s*(?:用|为|是|=|:|：)?\s*(\d+)/);
  return {
    signupModes: modes.length ? modes.join(",") : undefined,
    minTeam: minTeamMatch?.[1],
    permissions: permissions.length ? [...new Set(permissions)].join(",") : undefined,
    peopleLimit: peopleLimitMatch?.[1],
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
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
