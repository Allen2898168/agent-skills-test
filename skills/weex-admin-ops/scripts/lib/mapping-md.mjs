import fs from "node:fs";
import path from "node:path";

export function parseMarkdownTableToMap(md, keyColumnName, valueColumnName) {
  const lines = String(md || "").split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes(`| ${keyColumnName} |`) && line.includes(`| ${valueColumnName} |`));
  if (headerIndex < 0) return {};
  const out = {};
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const key = parts[0].replace(/`/g, "");
    const value = parts[1];
    if (key && value) out[key] = value;
  }
  return out;
}

export function loadMarkdownTableMap({ repoRoot, fileRelPath, sourceRelPath, keyColumnName, valueColumnName }) {
  const absPath = path.join(repoRoot, fileRelPath);
  if (!fs.existsSync(absPath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(absPath, "utf8");
  return { source: sourceRelPath || fileRelPath, map: parseMarkdownTableToMap(md, keyColumnName, valueColumnName) };
}

