export function matchAction(manifest, args) {
  if (args.action) {
    const action = manifest.actions.find(item => item.id === args.action);
    if (!action) throw new Error(`Cached action not found: ${args.action}`);
    return { action, inferred: {} };
  }
  if (!args.query) throw new Error("Provide --query or --action");
  if (isFinAdminQuery(args.query)) {
    throw new Error("FIN Admin request belongs to skills/weex-fin-admin-ops; use that skill's run-cached-action.mjs.");
  }
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

function isFinAdminQuery(query) {
  return /FIN|财务|空投奖励|产品化活动|stg-admin-web-fin|airdropRewardProd/i.test(query);
}

function scoreAction(action, query) {
  let score = 0;
  if (hasAny(query, action.intentKeywords || [])) score += 2;
  if (hasAny(query, action.objectKeywords || [])) score += 2;
  if (hasAny(query, action.scopeKeywords || [])) score += 2;
  if (hasAny(query, action.filterKeywords || [])) score += 3;
  if (action.supportedActions?.some(item => query.includes(item))) score += 3;
  if (action.id === "verify_register_template_row_actions" && query.includes("操作列")) score += 3;
  if (action.id === "delete_register_templates_by_operator" && query.includes("最近编辑人") && query.includes("删除")) score += 4;
  if (action.id === "create_guide_templates" && /活动.*引导.*配置|引导.*流程.*配置|流程.*引导.*配置|活动流程引导配置/.test(query)) score += 8;
  if (action.id === "verify_guide_template_row_actions" && /活动.*引导.*配置|引导.*流程.*配置|流程.*引导.*配置|活动流程引导配置/.test(query) && query.includes("操作列")) score += 12;
  if (action.id === "create_lottery_activity_draft" && /活动列表/.test(query) && /转盘抽奖/.test(query) && /新增|创建|草稿|配置|走一下|尝试/.test(query)) score += 14;
  if (action.id === "create_lottery_activity_draft" && /转盘抽奖.{0,8}活动|活动.{0,8}转盘抽奖/.test(query) && /新增|创建|生成|草稿|配置|全配置|权重配置|走一下|尝试/.test(query)) score += 14;
  if (action.supportedCategories?.some(item => query.includes(item))) score += 1;
  if (action.supportedSubtypes?.some(item => query.toUpperCase().includes(String(item).toUpperCase()))) score += 1;
  return score;
}

function inferParams(query) {
  return {
    ...inferPrizeParams(query),
    ...inferRouletteParticipantParams(query),
    ...inferRegisterTemplateParams(query),
    ...inferRegisterRowActionParams(query),
    ...inferRegisterDeleteByOperatorParams(query),
    ...inferGuideTemplateParams(query),
    ...inferGuideRowActionParams(query),
    ...inferLotteryActivityDraftParams(query),
    prizeId: inferPrizeId(query),
  };
}

function inferLotteryActivityDraftParams(query) {
  if (!/转盘抽奖/.test(query) || (!/活动列表/.test(query) && !/活动|草稿|全配置|权重配置/.test(query))) return {};
  const titlePrefixMatch = query.match(/(?:标题前缀|活动标题前缀)\s*(?:用|为|是|=|:|：)?\s*([\u4e00-\u9fa5A-Za-z0-9_.-]+)/);
  const aliasPrefixMatch = query.match(/(?:别名前缀|活动别名前缀)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9_.-]+)/);
  return {
    titlePrefix: titlePrefixMatch?.[1],
    aliasPrefix: aliasPrefixMatch?.[1],
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferGuideRowActionParams(query) {
  if (!/活动.*引导.*配置|引导.*流程.*配置|流程.*引导.*配置|活动流程引导配置/.test(query)) return {};
  if (!query.includes("操作列") && !query.includes("查看") && !query.includes("修改") && !query.includes("复制") && !query.includes("删除")) return {};
  return {
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferGuideTemplateParams(query) {
  if (!/活动.*引导.*配置|引导.*流程.*配置|流程.*引导.*配置|活动流程引导配置/.test(query)) return {};
  return {
    activityTypes: inferGuideActivityType(query),
    frequencies: inferGuideFrequency(query),
    steps: inferGuideSteps(query),
    includeNone: /暂无特殊配置|NONE|所有活动类型/.test(query),
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferGuideActivityType(query) {
  const map = [
    ["交易竞速赛", "race_competition"],
    ["交易大赛", "trading_competition"],
    ["新手活动", "beginner_task"],
    ["转盘抽奖", "lottery"],
    ["小活动型活动", "trace_pro"],
    ["定制化活动", "customized"],
    ["充值交易活动", "recharge_trans_task"],
    ["人人代理活动", "agent"],
    ["合约挖矿活动", "contract_mining"],
    ["小丑牌活动", "flip"],
    ["竞猜大赛", "guess"],
    ["代理小活动", "agent_trace_pro"],
    ["暂无特殊配置", "none"],
  ];
  return map.find(([word]) => query.includes(word))?.[1];
}

function inferGuideFrequency(query) {
  if (query.includes("每日首次访问")) return "daily_first";
  if (query.includes("用户首次访问")) return "user_first";
  if (query.includes("每次访问") || query.includes("第一个频率") || query.includes("第一个选项")) return "every_visit";
  return undefined;
}

function inferGuideSteps(query) {
  const digit = query.match(/(\d+)\s*(?:个)?步骤/);
  if (digit) return digit[1];
  const map = { 一: 1, 二: 2, 两: 2, 三: 3 };
  const zh = query.match(/([一二两三])\s*(?:个)?步骤/);
  return zh ? String(map[zh[1]]) : undefined;
}

function inferRegisterDeleteByOperatorParams(query) {
  if (!query.includes("删除") || !/报名模板|活动用户报名管理/.test(query)) return {};
  if (!/最近编辑人|编辑人|operator/i.test(query)) return {};
  const operatorMatch = query.match(/(?:最近编辑人|编辑人|operator)\s*(?:是|为|=|:|：)?\s*([A-Za-z0-9_.-]+)/i);
  return {
    operator: operatorMatch?.[1] || "auto",
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
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
  const platformScope = inferRegisterPlatformScope(query);
  const dateRange = inferRegisterDateRange(query);
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
    platformScopes: platformScope,
    minTeam: minTeamMatch?.[1],
    permissions: permissions.length ? [...new Set(permissions)].join(",") : undefined,
    peopleLimit: peopleLimitMatch?.[1],
    registerStart: dateRange?.start,
    registerEnd: dateRange?.end,
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferRegisterRowActionParams(query) {
  if (!query.includes("活动用户报名管理") && !query.includes("报名模板")) return {};
  if (!query.includes("操作列") && !query.includes("查看") && !query.includes("修改") && !query.includes("删除")) return {};
  return {
    namePrefix: "操作列临时模板",
    visible: /浏览器模式|可见|打开浏览器|让我看着/.test(query),
  };
}

function inferRegisterPlatformScope(query) {
  const map = [
    ["非活跃用户", "non_active"],
    ["自然流量", "natural"],
    ["指定渠道码", "channel_invite"],
    ["邀请码", "channel_invite"],
    ["仅限渠道用户", "channel_only"],
    ["混合条件", "mixed"],
    ["指定华语用户", "chinese"],
    ["指定海外用户", "overseas"],
    ["假钱账户", "fake_money"],
    ["全平台用户", "all"],
    ["指定参赛代理或用户", "agent_user"],
  ];
  return map.find(([word]) => query.includes(word))?.[1];
}

function inferRegisterDateRange(query) {
  if (!/可参与注册时间范围|注册时间范围|报名时间范围/.test(query)) return null;
  if (/今天.{0,6}明天|今明/.test(query)) {
    const today = localDateParts(new Date());
    const tomorrow = localDateParts(new Date(Date.now() + 24 * 60 * 60 * 1000));
    return {
      start: `${today} 00:00:00`,
      end: `${tomorrow} 23:59:59`,
    };
  }
  const explicit = query.match(/(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}:\d{2})?.{0,12}(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}:\d{2})?/);
  if (!explicit) return null;
  return {
    start: `${explicit[1]} 00:00:00`,
    end: `${explicit[2]} 23:59:59`,
  };
}

function localDateParts(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
