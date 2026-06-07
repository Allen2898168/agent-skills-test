import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCatalog(repoRoot, relPath, fallback = null) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) return fallback;
  return { source: relPath.replace(/^skills\/weex-admin-ops\//, ""), data: readJson(abs) };
}

export function loadActivityTaskTypeCatalog(repoRoot) {
  const hit = loadCatalog(repoRoot, "skills/weex-admin-ops/references/catalogs/activity-task-types.json");
  if (!hit) return { source: "missing", list: [], mappingByValue: {} };
  const list = Array.isArray(hit.data?.list) ? hit.data.list : [];
  const mappingByValue = hit.data?.mappingByValue && typeof hit.data.mappingByValue === "object" ? hit.data.mappingByValue : {};
  return { source: hit.source, list, mappingByValue };
}

export function loadLotteryRaffleStyleCatalog(repoRoot) {
  const hit = loadCatalog(repoRoot, "skills/weex-admin-ops/references/catalogs/lottery-raffle-styles.json");
  const styles = Array.isArray(hit?.data?.styles) ? hit.data.styles : [];
  return { source: hit?.source || "missing", styles };
}

export function loadLotterySupportedTasksCatalog(repoRoot) {
  const hit = loadCatalog(repoRoot, "skills/weex-admin-ops/references/catalogs/lottery-supported-tasks.json");
  const tasks = Array.isArray(hit?.data?.tasks) ? hit.data.tasks : [];
  return { source: hit?.source || "missing", tasks };
}
