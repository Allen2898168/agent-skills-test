export function isLoginPageUrl(url) {
  return /\/login(?:[/?#]|$)/.test(String(url || ""));
}

export function shouldSearchLotteryListAfterSubmit({ currentUrl, authHeader }) {
  return !(authHeader && isLoginPageUrl(currentUrl));
}

export function isLotteryDraftCreateSuccessful({ createBody, verify }) {
  return createBody?.code === 200 || Number(verify?.total || 0) === 1;
}
