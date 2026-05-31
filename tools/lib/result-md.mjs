import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function defaultResultRoot(repoRoot) {
  return path.join(repoRoot, "result");
}

export function timestampSlug(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function toMarkdownValue(value) {
  if (value === null || value === undefined) return "`null`";
  if (typeof value === "string") return value.includes("\n") ? `\n\n\`\`\`\n${value}\n\`\`\`\n` : `\`${value}\``;
  if (typeof value === "number" || typeof value === "boolean") return `\`${String(value)}\``;
  return `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
}

export function writeResultMarkdown({
  repoRoot,
  suite = "universal-regression",
  caseId,
  title,
  summary = {},
  steps = [],
  links = [],
  raw = {},
  now = new Date(),
} = {}) {
  if (!repoRoot) throw new Error("writeResultMarkdown requires repoRoot");
  if (!caseId) throw new Error("writeResultMarkdown requires caseId");
  const root = ensureDir(defaultResultRoot(repoRoot));
  const runDir = ensureDir(path.join(root, suite, timestampSlug(now)));
  const filePath = path.join(runDir, `${caseId}.md`);

  const lines = [];
  lines.push(`# ${title || caseId}`);
  lines.push("");
  lines.push(`- caseId: ${toMarkdownValue(caseId)}`);
  lines.push(`- suite: ${toMarkdownValue(suite)}`);
  lines.push(`- generatedAt: ${toMarkdownValue(now.toISOString())}`);
  lines.push("");

  const summaryKeys = summary && typeof summary === "object" ? Object.keys(summary) : [];
  if (summaryKeys.length) {
    lines.push("## Summary");
    for (const key of summaryKeys.sort()) {
      lines.push(`- ${key}: ${toMarkdownValue(summary[key]).trim()}`);
    }
    lines.push("");
  }

  if (Array.isArray(links) && links.length) {
    lines.push("## Links");
    for (const link of links) {
      if (!link) continue;
      const label = link.label ? String(link.label) : String(link.url || "");
      const url = link.url ? String(link.url) : "";
      if (!url) continue;
      lines.push(`- ${label}: ${url}`);
    }
    lines.push("");
  }

  if (Array.isArray(steps) && steps.length) {
    lines.push("## Steps");
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const name = String(step.name || step.step || "step");
      const ok = step.ok === undefined ? "" : (step.ok ? "✅" : "❌");
      lines.push(`### ${ok} ${name}`.trim());
      const fields = { ...step };
      delete fields.name;
      delete fields.step;
      const keys = Object.keys(fields);
      for (const key of keys.sort()) {
        lines.push(`- ${key}: ${toMarkdownValue(fields[key]).trim()}`);
      }
      lines.push("");
    }
  }

  const rawKeys = raw && typeof raw === "object" ? Object.keys(raw) : [];
  if (rawKeys.length) {
    lines.push("## Raw");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(raw, null, 2));
    lines.push("```");
    lines.push("");
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return { ok: true, filePath, runDir };
}

