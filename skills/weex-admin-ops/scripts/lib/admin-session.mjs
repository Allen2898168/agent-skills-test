export function isExpiredSessionPromptText(text) {
  return /登录状态已过期/.test(String(text || ""));
}

export function isAdminLoginUrl(url) {
  return /\/login(?:[/?#]|$)/.test(String(url || ""));
}

export function resolveAdminRestorePath(currentUrl, fallbackPath = "/") {
  const fallback = String(fallbackPath || "/") || "/";
  try {
    const url = new URL(String(currentUrl || ""));
    const path = `${url.pathname || ""}${url.search || ""}${url.hash || ""}` || fallback;
    return path.startsWith("/") ? path : fallback;
  } catch {
    return fallback;
  }
}

export function shouldRestoreAdminSession({ currentUrl, dialogText }) {
  return isAdminLoginUrl(currentUrl) || isExpiredSessionPromptText(dialogText);
}
