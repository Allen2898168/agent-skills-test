import fs from "node:fs";
import path from "node:path";

function sanitize(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildMidsceneReportName(parts = []) {
  const tokens = Array.isArray(parts) ? parts : [parts];
  const base = tokens.map(sanitize).filter(Boolean).join("__") || "midscene";
  const stamp = String(Date.now());
  return `${base}__${stamp}`.slice(0, 120);
}

export async function createMidsceneRecorder(page, { reportName = "", groupName = "", groupDescription = "" } = {}) {
  const resolvedReportName = sanitize(reportName) || buildMidsceneReportName(["midscene"]);
  const dir = path.resolve("skills/weex-admin-ops/artifacts/midscene");
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${resolvedReportName}.jsonl`);
  const events = [];

  const record = async (title, detail = "") => {
    events.push({
      ts: new Date().toISOString(),
      title: String(title || ""),
      detail: String(detail || ""),
      groupName: String(groupName || ""),
      groupDescription: String(groupDescription || ""),
      url: page?.url ? String(page.url() || "") : "",
    });
  };

  const finalize = async () => {
    try {
      fs.writeFileSync(outPath, `${events.map(item => JSON.stringify(item)).join("\n")}\n`, "utf8");
    } catch {}
    return outPath;
  };

  return { record, finalize, reportPath: outPath };
}

