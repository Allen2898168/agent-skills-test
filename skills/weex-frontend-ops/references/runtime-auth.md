# Runtime Auth

This file defines how WEEX frontend credentials are supplied at runtime.

## Session Start Check

- For frontend login or login-required operations, run `scripts/check-auth-config.mjs` first.
- Local runtime config should live in `skills/weex-frontend-ops/.env.local`.
- The committed `skills/weex-frontend-ops/.env.example` is only a placeholder template.
- Frontend browser scripts auto-install project Node dependencies from the repo root `package.json` when `playwright` is missing. Set `WEEX_AUTO_INSTALL_DEPS=false` to disable auto-install.
- Do not read frontend credentials or runtime config from root `.env.local`, other skill directories, `P2P_*`, generic `WEEX_*`, `WEEX_ADMIN_*`, or `WEEX_FIN_*` fallback variables.
- Do not write real passwords, tokens, cookies, TOTP secrets, sessions, or private user data to references, docs, cache files, screenshots summaries, or handoff records. Staging/test account emails and UIDs can be printed and recorded in full; production or unspecified-environment identifiers must still be redacted or avoided.
- If multiple frontend accounts are configured and the operation needs login, ask the tester which account alias to use before operating.

## Environment Variables

- `WEEX_FRONTEND_ENV`: target environment, for example `stg`.
- `WEEX_FRONTEND_URL`: frontend login entry URL.
- `WEEX_FRONTEND_ACCOUNT_URL`: account overview URL used to verify login state.
- `WEEX_FRONTEND_LOGIN_TOOL_DIR`: optional local loginTool override containing `lib/weex-login.mjs` and `lib/weex-auth-cookie.mjs`. Leave unset to use the bundled copy at `skills/weex-frontend-ops/vendor/loginTool`.
- `WEEX_FRONTEND_LOGIN_GATEWAY_BASE_URL`: optional login API base, defaults to `https://stg-gateway.weex.tech`.
- `WEEX_FRONTEND_ASSET_GATEWAY_BASE_URL`: optional asset API base, defaults to `https://stg-gateway2.weex.tech`.
- `WEEX_FRONTEND_COMMON_PASSWORD`: common password used when an account has no dedicated password.
- `WEEX_FRONTEND_DEFAULT_ACCOUNT`: default account alias, for example `DEFAULT`.
- `WEEX_FRONTEND_ACCOUNTS`: comma-separated account aliases, for example `DEFAULT,BUYER,SELLER`.
- `WEEX_FRONTEND_ACCOUNT_<ALIAS>_USERNAME`: required username for each account alias.
- `WEEX_FRONTEND_ACCOUNT_<ALIAS>_PASSWORD`: optional account-specific password. If configured, it overrides `WEEX_FRONTEND_COMMON_PASSWORD`.
- `WEEX_FRONTEND_ACCOUNT_<ALIAS>_DESCRIPTION`: optional account description used when asking the tester to choose an account.
- `WEEX_FRONTEND_ACCOUNT`: selected account alias for non-interactive scripts.
- `WEEX_FRONTEND_USERNAME`: optional one-off runtime account username.
- `WEEX_FRONTEND_PASSWORD`: optional one-off runtime password.
- `WEEX_FRONTEND_BROWSER_VISIBLE`: set `true` for visible browser mode.
- `WEEX_FRONTEND_SAVE_SCREENSHOT`: set `true` only when screenshot evidence is requested.
- `WEEX_AUTO_INSTALL_DEPS`: optional global switch; set `false` to prevent scripts from running `npm install` automatically when a project dependency is missing.

## STG Cookie Login

Status: candidate
Last verified: 2026-05-08

- Script: `scripts/frontend-login-cookie.mjs`.
- Cache action: `frontend_login_cookie`.
- Visible browser mode uses the same cookie-injection path and then shows the final logged-in page. Do not change to form clicking unless the user explicitly requests login-form UI testing.
- The runtime plaintext password is transformed in memory with `MD5` and `base64` before loginTool login.
- The script uses the bundled loginTool API login capability, then injects `WEEX_TOKEN_COOKIE_STAGING` into the `stg-www.weex.tech` browser context.
- The flow opens the login page first; if it still renders login form text, it navigates to `/zh-CN/account` to verify login state.
- Do not write plaintext password, encrypted password, token response, cookie value, or session details to files or logs.
- For login-required activity pages such as `/zh-CN/events/draw/<activity-alias>`, inject the cookie before navigation. Opening the page first and then logging in can leave the page in a guest or login-redirect state and is not a valid authenticated display check.

## Success Assertions

- `WEEX_TOKEN_COOKIE_STAGING` cookie is present in the page context.
- Login form text is absent.
- `账号总览`, `账户安全`, or `/account` URL is visible after cookie injection.
- Failed network responses are summarized without tokens or private data.

## Login-Required API Calls

Status: candidate
Last verified: 2026-05-08

- Script: `scripts/frontend-assets-transfer.mjs`.
- Cache action: `frontend_assets_transfer`.
- Use the same frontend account resolution rules as cookie login.
- The script logs in through the bundled loginTool runtime, keeps the access token in memory, and sends authenticated JSON with `U-Token`.
- Do not print access tokens, cookies, password values, signatures, or session data.
- Asset transfer is a state-changing financial operation. Always run dry-run first and require `--confirm-transfer` for the real request.
