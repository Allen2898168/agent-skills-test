import { timestamp } from "../../lib/cli.mjs";

const SIGNUP_MODE_DEFS = {
  auto: { label: "注册即报名" },
  manual: { label: "用户手动点击报名" },
  team: { label: "团体报名方式", minTeam: "2" },
  auto_manual: { label: "注册+手动点击报名方式" },
};

const DEFAULT_SIGNUP_MODES = ["auto", "manual", "team", "auto_manual"];

const PERMISSION_DEFS = {
  signup: "报名",
  view: "看到和进入页面",
};

const PLATFORM_SCOPE_DEFS = {
  all: "全平台用户",
  agent_user: "指定参赛代理或用户",
  channel_invite: "指定渠道码或邀请码",
  natural: "自然流量",
  non_active: "非活跃用户",
  channel_only: "仅限渠道用户",
  mixed: "混合条件",
  chinese: "指定华语用户",
  overseas: "指定海外用户",
  fake_money: "假钱账户",
};

const DEFAULT_EXTENDED_PLATFORM_SCOPES = [
  "channel_invite",
  "natural",
  "non_active",
  "channel_only",
  "mixed",
  "chinese",
  "overseas",
  "fake_money",
];

const RESTRICT_SCOPE_DEFS = {
  none: "无",
  agent_direct: "代理及其直客",
  agent_tree: "代理+下级代理+所有直客",
  kyc: "KYC",
  vip: "VIP等级",
  risk: "风控标签",
  balance: "合约账户余额",
  gray_market: "灰：海外做市商户",
  non_kyc: "非KYC用户",
  unbound_phone: "非绑定手机号用户",
};

const DEFAULT_AGENT_USER_RESTRICT_SCOPES = [
  "none",
  "agent_direct",
  "agent_tree",
  "kyc",
  "vip",
  "risk",
  "balance",
  "gray_market",
  "non_kyc",
  "unbound_phone",
];

export function buildRegisterTemplatePlan(args) {
  const ts = timestamp();
  const platformScopes = parsePlatformScopes(args.platformScopes || args.platformScope);
  const hasCustomScopes = Boolean(args.platformScopes || args.platformScope || args.restrictScopes);
  const modes = parseSignupModes(args.signupModes || (hasCustomScopes ? "auto" : ""));
  const permissions = parsePermissions(args.permissions);
  const registerTimeRange = parseRegisterTimeRange(args);
  return platformScopes.flatMap(platformScope => {
    const scopes = hasCustomScopes
      ? parseRestrictScopes(args.restrictScopes, platformScope)
      : ["none"];
    return scopes.flatMap(scope => modes.map(mode => {
    const modeDef = SIGNUP_MODE_DEFS[mode];
    const restrictScope = RESTRICT_SCOPE_DEFS[scope];
    const platformLabel = PLATFORM_SCOPE_DEFS[platformScope];
    return {
      signupMode: mode,
      signupModeLabel: modeDef.label,
      name: buildName(args.namePrefix, mode, scope, platformScope, hasCustomScopes, ts),
      platformScopeKey: platformScope,
      platformScope: platformLabel,
      restrictScope,
      restrictScopeKey: scope,
      uid: args.uid || "9881271952",
      channelCode: args.channelCode || `auto_channel_${ts}`,
      inviteCode: args.inviteCode || `auto_invite_${ts}`,
      contractBalance: args.contractBalance || "0",
      vipWhitelistMode: args.vipWhitelistMode || "同等级限制",
      selectPartnerGroup: platformScope === "agent_user",
      agentRoleDetail: args.agentRoleDetail || (platformScope === "agent_user" ? "all" : "none"),
      minTeam: args.minTeam || modeDef.minTeam || "",
      peopleLimit: args.peopleLimit || "",
      permissions,
      registerTimeRange,
    };
    }));
  });
}

export function registerSignupModeCatalog() {
  return DEFAULT_SIGNUP_MODES.map(mode => ({
    mode,
    label: SIGNUP_MODE_DEFS[mode].label,
    defaultMinTeam: SIGNUP_MODE_DEFS[mode].minTeam || "",
  }));
}

export function registerPermissionCatalog() {
  return Object.entries(PERMISSION_DEFS).map(([permission, label]) => ({ permission, label }));
}

export function registerRestrictScopeCatalog() {
  return Object.entries(RESTRICT_SCOPE_DEFS).map(([scope, label]) => ({ scope, label }));
}

export function registerPlatformScopeCatalog() {
  return Object.entries(PLATFORM_SCOPE_DEFS).map(([scope, label]) => ({ scope, label }));
}

function buildName(prefix, mode, scope, platformScope, hasCustomScopes, ts) {
  if (!hasCustomScopes) return `${prefix || "自动化报名模板"}_${mode}_${ts}`;
  const platformLabel = PLATFORM_SCOPE_DEFS[platformScope].replace(/[：:+/\\s]/g, "");
  const scopeLabel = scope === "none" ? "" : `_${RESTRICT_SCOPE_DEFS[scope].replace(/[：:+/\\s]/g, "")}`;
  const modeSuffix = mode === "auto" ? "" : `_${mode}`;
  return `${prefix || "报名模板"}_${platformLabel}${scopeLabel}${modeSuffix}_${ts}`;
}

function parseSignupModes(value) {
  if (!value || value === "all") return DEFAULT_SIGNUP_MODES;
  const modes = value.split(",").map(item => item.trim()).filter(Boolean);
  const bad = modes.filter(mode => !SIGNUP_MODE_DEFS[mode]);
  if (bad.length) throw new Error(`Unknown --signup-modes value: ${bad.join(", ")}`);
  return modes;
}

function parsePermissions(value) {
  if (!value) return [];
  if (value === "none") return [];
  const permissions = value.split(",").map(item => item.trim()).filter(Boolean);
  const bad = permissions.filter(permission => !PERMISSION_DEFS[permission]);
  if (bad.length) throw new Error(`Unknown --permissions value: ${bad.join(", ")}`);
  return permissions.map(permission => PERMISSION_DEFS[permission]);
}

function parsePlatformScopes(value) {
  if (!value) return ["all"];
  if (value === "extended") return DEFAULT_EXTENDED_PLATFORM_SCOPES;
  if (value === "all_platforms") return Object.keys(PLATFORM_SCOPE_DEFS);
  const scopes = value.split(",").map(item => item.trim()).filter(Boolean);
  const bad = scopes.filter(scope => !PLATFORM_SCOPE_DEFS[scope]);
  if (bad.length) throw new Error(`Unknown --platform-scope value: ${bad.join(", ")}`);
  return scopes;
}

function parseRestrictScopes(value, platformScope) {
  const defaultScopes = platformScope === "agent_user" ? DEFAULT_AGENT_USER_RESTRICT_SCOPES : ["none"];
  if (!value || value === "default" || value === "all") return defaultScopes;
  const scopes = value.split(",").map(item => item.trim()).filter(Boolean);
  const bad = scopes.filter(scope => !RESTRICT_SCOPE_DEFS[scope]);
  if (bad.length) throw new Error(`Unknown --restrict-scopes value: ${bad.join(", ")}`);
  return scopes;
}

function parseRegisterTimeRange(args) {
  const start = args.registerStart || args.registerBegin;
  const end = args.registerEnd;
  if (!start && !end) return null;
  if (!start || !end) throw new Error("--register-start and --register-end must be provided together");
  return { start, end };
}
