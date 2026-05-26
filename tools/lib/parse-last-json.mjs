export function parseLastJson(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  const lines = source.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trimStart();
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    const candidate = lines.slice(index).join("\n").trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

