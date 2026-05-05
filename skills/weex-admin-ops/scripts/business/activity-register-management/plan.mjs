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

export function buildRegisterTemplatePlan(args) {
  const ts = timestamp();
  const modes = parseSignupModes(args.signupModes);
  const permissions = parsePermissions(args.permissions);
  return modes.map(mode => {
    const def = SIGNUP_MODE_DEFS[mode];
    return {
      signupMode: mode,
      signupModeLabel: def.label,
      name: `${args.namePrefix || "自动化报名模板"}_${mode}_${ts}`,
      platformScope: "全平台用户",
      restrictScope: "无",
      minTeam: args.minTeam || def.minTeam || "",
      peopleLimit: args.peopleLimit || "",
      permissions,
    };
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
