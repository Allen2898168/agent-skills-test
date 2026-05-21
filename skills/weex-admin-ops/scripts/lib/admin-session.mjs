export function isExpiredSessionPromptText(text) {
  return /登录状态已过期/.test(String(text || ""));
}

export function isAdminLoginUrl(url) {
  return /\/login(?:[/?#]|$)/.test(String(url || ""));
}

export function shouldRestoreAdminSession({ currentUrl, dialogText }) {
  return isAdminLoginUrl(currentUrl) || isExpiredSessionPromptText(dialogText);
}
