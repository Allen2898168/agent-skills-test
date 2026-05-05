import { timestamp } from "../../lib/cli.mjs";

const SCOPE_DEFS = {
  all: { label: "报名的所有用户", slug: "all" },
  vip: { label: "VIP 等级", slug: "vip" },
  newuser: { label: "注册新用户", slug: "newuser" },
  nocharge: { label: "未充值新用户", slug: "nocharge" },
  olduser: { label: "老用户", slug: "olduser" },
  agent: { label: "指定代理", slug: "agent", requiresUid: true },
  user: { label: "指定用户", slug: "user", requiresUid: true },
  country: { label: "指定国家或地区", slug: "country", requiresCountry: true },
};

const DEFAULT_SCOPE_ORDER = ["all", "vip", "newuser", "nocharge", "olduser", "agent", "user", "country"];

export function buildRouletteParticipantPlan(args) {
  const ts = timestamp();
  const scopes = parseScopes(args.scopes);
  const uid = args.uid;
  const country = args.country;
  const useFirstCountry = Boolean(args.countryFirst);
  for (const scope of scopes) validateScopeArgs(scope, { uid, country, useFirstCountry });
  return scopes.map(scope => {
    const def = SCOPE_DEFS[scope];
    return {
      scope,
      scopeLabel: def.label,
      name: `${args.namePrefix || "转盘抽奖_scope"}_${def.slug}_${ts}`,
      content: args.content || "自动化转盘抽奖参与范围任务",
      tag: args.tag || `roulette_scope_${def.slug}`,
      remark: args.remark || `自动化不可见模式：参与范围-${def.label}`,
      enName: args.enName || `Roulette scope ${def.slug} ${ts}`,
      enContent: args.enContent || "Automated roulette participant scope task",
      enTag: args.enTag || `roulette_scope_${def.slug}`,
      uid,
      country,
      useFirstCountry,
      vipWhitelist: args.vipWhitelist || "同等级允许",
      rewardMin: args.rewardMin || "10",
      rewardMax: args.rewardMax || "",
      dailyLimit: args.dailyLimit || "5",
      totalLimit: args.totalLimit || "50",
    };
  });
}

export function participantScopeCatalog() {
  return DEFAULT_SCOPE_ORDER.map(scope => ({ scope, label: SCOPE_DEFS[scope].label }));
}

function parseScopes(value) {
  if (!value || value === "all-scopes") return DEFAULT_SCOPE_ORDER;
  const scopes = value.split(",").map(item => item.trim()).filter(Boolean);
  const bad = scopes.filter(scope => !SCOPE_DEFS[scope]);
  if (bad.length) throw new Error(`Unknown --scopes value: ${bad.join(", ")}`);
  return scopes;
}

function validateScopeArgs(scope, params) {
  const def = SCOPE_DEFS[scope];
  if (def.requiresUid && !params.uid) throw new Error(`Scope ${scope} requires --uid`);
  if (def.requiresCountry && !params.country && !params.useFirstCountry) {
    throw new Error("Scope country requires --country or --country-first");
  }
}
