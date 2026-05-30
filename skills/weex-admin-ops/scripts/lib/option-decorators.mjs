function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function resolveOptionValue(value, options) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  const token = normalizeToken(raw);
  const list = Array.isArray(options) ? options : [];

  for (const item of list) {
    if (!item) continue;
    const optValue = String(item.value ?? item.key ?? "").trim();
    if (optValue && normalizeToken(optValue) === token) return optValue;
  }
  for (const item of list) {
    if (!item) continue;
    const label = String(item.label ?? "").trim();
    const optValue = String(item.value ?? item.key ?? "").trim();
    if (label && optValue && normalizeToken(label) === token) return optValue;
  }
  return raw;
}

export function decorateValue(value, options) {
  const v = String(value ?? "").trim();
  if (!v) return v;
  const list = Array.isArray(options) ? options : [];
  const hit = list.find(item => String(item?.value ?? item?.key ?? "").trim() === v);
  const label = String(hit?.label ?? "").trim();
  return label && label !== v ? `${v}(${label})` : v;
}

export function decorateCsvValues(value, options) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  return raw
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => decorateValue(resolveOptionValue(item, options), options))
    .join(",");
}

