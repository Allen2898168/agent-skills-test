# Assertions

Do not consider an operation successful only because a click completed. Verify at least one durable signal.

## Login

Success:
- URL no longer contains `/login`.
- Page title is `活动管理系统`.
- The target page or a known redirected page is visible.

Failure or blocked:
- Still on `/login`.
- Visible toast/message reports credential, code, or permission failure.
- Redirects to `/user/profile?tab=googleBind` when the account must bind Google Authenticator.

## Offline User Manage / Fake Money Account

Success:
- Final URL path is `/activities/offline/userManage`.
- Page contains `假钱账户`.
- Page contains table headers including `UID`, `AccountId`, and `API Key`.

Optional screenshot:
- Save only when the user explicitly requests a screenshot.
- Directory: `artifacts/screenshots/假钱账户/`.
- Suggested file name: `offline-user-manage-loaded.png` or `weex-login-success.png`.
