# Frontend Authentication

## Authentication Browser Mode Rule

Status: verified
Last verified: 2026-05-08

For frontend login and registration, `浏览器模式` means the final authenticated frontend page must be visible or verifiable in a browser context. It does not require manually clicking the login or register form controls unless the user explicitly asks to test the form UI itself.

Required behavior:
- Login: use the proven token-cookie injection path, then open the final logged-in page.
- Registration: use the proven STG registration API path when the user asks for fast account creation, then inject the returned token cookie and open the final logged-in page.
- Do not ask for macOS Accessibility, local device, or computer-assistance permissions for these auth paths.
- If a visible browser is requested, open only the final authenticated page unless the user asks to inspect the captcha/form UI.
- Keep all password, token, cookie, verification-code, and full-account values redacted.

## STG Frontend Cookie Login-State Validation

Status: candidate
Last verified: 2026-05-08

Use when the user asks to log in to the WEEX frontend, open a frontend login state, or prepare a browser session for later frontend checks. In visible browser mode, this flow should still use cookie injection and then show the final logged-in page; do not switch to manual form clicking unless the user explicitly requests login-form UI testing.

### Required Inputs

- Environment: default `stg`.
- Credential source: `skills/weex-frontend-ops/.env.local` or same-skill runtime `WEEX_FRONTEND_*` variables.
- Account alias when multiple accounts are configured.
- Local loginTool path when the default is unavailable.

### Scripts

- Auth config check: `scripts/check-auth-config.mjs`.
- Login flow: `scripts/frontend-login-cookie.mjs`.
- Cached action: `frontend_login_cookie`.

### Steps

1. Run `node scripts/check-auth-config.mjs` from the skill root.
2. If config is missing, ask the tester to create `skills/weex-frontend-ops/.env.local` from `.env.example`.
3. If multiple accounts exist, ask which `WEEX_FRONTEND_ACCOUNT` alias to use.
4. Dry-run the cached action:
   `node scripts/run-cached-action.mjs --action frontend_login_cookie --dry-run`
5. Execute only after required config is present:
   `node scripts/run-cached-action.mjs --action frontend_login_cookie`
6. Add `-- --visible` after the cached action command when visible browser mode is requested.
7. Add `-- --screenshot` only when the user explicitly requests screenshot evidence.

### Success Assertions

- `WEEX_TOKEN_COOKIE_STAGING` cookie is present.
- Login form text is absent.
- `账号总览`, `账户安全`, or `/account` URL is visible.
- Final URL and viewport are reported.

### Evidence

- Final URL.
- Viewport: desktop `1440x1000` for the current script.
- Token cookie presence as boolean only; never print cookie value.
- Screenshot path only if requested.
- Failed response summary with sensitive query strings and headers omitted.

### Known Limits

- The script depends on a local loginTool checkout containing `lib/weex-login.mjs` and `lib/weex-auth-cookie.mjs`.
- This is a cookie-injection login-state validation path, not a manual form-fill login path.
- Current status is `candidate`; visible browser mode was verified in this project on 2026-05-08 without screenshot capture.

## STG Frontend Email Registration Through Test API

Status: candidate
Last verified: 2026-05-08

Use when the user asks to create a new STG frontend account quickly and explicitly allows API-layer registration. This is the preferred fast-registration path for internal STG testing because the browser register page can show dynamic captcha variants that are not stable for automation. In visible browser mode, create the account through the API path, then show the final logged-in account page.

### Required Inputs

- Environment: default `stg`.
- Password source: `WEEX_FRONTEND_COMMON_PASSWORD` or `WEEX_FRONTEND_PASSWORD` from `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` runtime environment variables.
- Email: generated as `codexapi<timestamp>@weex.com` unless `--email` is provided.
- Optional invite code: `--invite-code`.
- Explicit creation confirmation: `--confirm-register`.

### Scripts

- Cached action: `frontend_register_api`.
- Registration flow: `scripts/frontend-register-api.mjs`.

### Steps

1. Dry-run the cached action:
   `node scripts/run-cached-action.mjs --action frontend_register_api --dry-run`
2. Confirm the user has approved STG account creation.
3. Execute:
   `node scripts/run-cached-action.mjs --action frontend_register_api -- --confirm-register`
4. Add `-- --confirm-register --email <email>` only when the user provides a specific test email.
5. Add `-- --confirm-register --invite-code <code>` only when an invite code is required.
6. Add `-- --confirm-register --visible` only when the user explicitly wants the final authenticated page shown in a visible browser.

### API Path

1. `POST /v1/user/public/validate/config`
   - Payload includes `action: 3022`, `email`, and empty `mobile`.
   - Reads the dynamic captcha `channelName`.
2. `POST /v1/user/register/check`
   - Payload includes `type: "email"`, `loginName`, `channelName`, empty `paramMap`, and STG test validation result.
   - Success returns `serialNO`.
3. `POST /v1/user/register/submit`
   - Payload includes `pwd`, `rePwd`, `languageType`, `serialNO`, `email`, `type: "email"`, and `terminalCode`.
   - Password is transformed in memory with frontend-compatible MD5 base64.
4. Build `WEEX_TOKEN_COOKIE_STAGING` from returned token data and open `/zh-CN/account` for verification.

### Success Assertions

- `register/submit` returns business code `00000`.
- `WEEX_TOKEN_COOKIE_STAGING` cookie is present.
- Final URL is `/zh-CN/account` or account overview text is visible.
- Login form text is absent.
- Failed network responses are summarized without sensitive data.

### Evidence

- Final URL.
- Page title.
- Viewport: desktop `1440x1000`.
- Token cookie presence as boolean only.
- Masked generated email only; never print full email when avoidable.
- Screenshot path only if requested.

### Known Limits

- Email registration is verified; phone registration and country-code selector are page behavior only and are not yet scripted.
- Browser page registration may show image-selection captcha while hidden Aliyun slider DOM exists; do not rely on slider selectors for this flow unless the task is specifically captcha/form UI testing.
- Actual account creation is blocked unless `--confirm-register` is passed.

## STG Frontend Batch Email Registration Through Test API

Status: candidate
Last verified: 2026-05-08

Use when the user asks to create multiple STG frontend accounts, optionally with an invite code. This uses the same validated registration API path as single-account registration, but skips browser account-page verification for each account to avoid opening many browser contexts. Success is verified by `register/submit` business code `00000` and returned UID per account.

### Required Inputs

- Environment: default `stg`.
- Count: `--count <N>`.
- Password source: `WEEX_FRONTEND_COMMON_PASSWORD` or `WEEX_FRONTEND_PASSWORD` from `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` runtime environment variables.
- Optional invite code: `--invite-code`.
- Explicit creation confirmation: `--confirm-register`.

### Script

- Batch registration flow: `scripts/frontend-register-batch-api.mjs`.
- Cached action: `frontend_register_batch_api`.

### Steps

1. Dry-run:
   `node scripts/run-cached-action.mjs --action frontend_register_batch_api -- --dry-run --count <N> --invite-code <code>`
2. Execute after the user has approved account creation:
   `node scripts/run-cached-action.mjs --action frontend_register_batch_api -- --count <N> --invite-code <code> --confirm-register --output-csv <path>`
3. Default concurrency equals count, capped at `100`. Use `--concurrency <N>` only when overriding.
4. If an account fails before UID is returned, the script creates a replacement with a new email. It does not retry the same email.

### Success Assertions

- Exactly requested count of accounts return UID.
- Each success has an email and UID.
- Optional CSV contains only `email,uid`.

### Known Limits

- API-only, no browser viewport.
- The script does not save login token cookies for all accounts.
- High-concurrency registration can return `20105`; the fixed path is automatic backfill with new emails up to `--max-attempts`.

## STG Frontend Authenticated Asset Transfer API

Status: candidate
Last verified: 2026-05-08

Use when the user asks to move funds from the spot account to the contract account through the frontend login state. This is an API-only frontend-auth capability, not a page-click workflow. It is state-changing and financial, so the script refuses to execute unless the user has confirmed the target environment, account, amount, coin id, direction, and the command includes `--confirm-transfer`.

### Required Inputs

- Environment: default `stg`.
- Credential source: `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` variables.
- Account alias when multiple accounts are configured.
- Amount: default follows the provided STG example `1000`, override with `--amount`.
- From account type: default `10` for the provided spot source example, override with `--from-account-type`.
- To account type: default `8` for the provided contract target example, override with `--to-account-type`.
- Transfer coin id: default `2`, override with `--transfer-coin-id`.
- Explicit transfer confirmation: `--confirm-transfer`.

### Scripts

- Auth config check: `scripts/check-auth-config.mjs`.
- Transfer flow: `scripts/frontend-assets-transfer.mjs`.
- Cached action: `frontend_assets_transfer`.

### Steps

1. Run `node scripts/check-auth-config.mjs` from the skill root.
2. Dry-run the cached action:
   `node scripts/run-cached-action.mjs --action frontend_assets_transfer --dry-run`
3. If the user confirms the financial transfer, execute with explicit parameters:
   `node scripts/run-cached-action.mjs --action frontend_assets_transfer -- --confirm-transfer --amount 1000 --from-account-type 10 --to-account-type 8 --transfer-coin-id 2`
4. For non-default amount, account type, or coin id, pass explicit values instead of relying on defaults.

### API Path

- Login API base: `WEEX_FRONTEND_LOGIN_GATEWAY_BASE_URL`, default `https://stg-gateway.weex.tech`.
- Transfer API base: `WEEX_FRONTEND_ASSET_GATEWAY_BASE_URL`, default `https://stg-gateway2.weex.tech`.
- Endpoint: `POST /v1/assets/transfer`.
- Payload shape:
  `{ "amount": 1000, "fromAccountType": 10, "toAccountType": 8, "transferCoinId": "2" }`
- Auth header: `U-Token`, generated by loginTool and kept in memory only.

### Success Assertions

- loginTool returns a valid access token without printing it.
- Transfer HTTP status is 2xx.
- Transfer response business code is `00000`.

### Evidence

- Endpoint URL.
- Account alias, username, and staging/test UID can be reported in full.
- Payload values.
- Response HTTP status, business code, and message.
- Never print token, cookie, password, signature, or session data.

### Known Limits

- The source account must already have enough transferable balance. A newly registered account can authenticate but may return business code `70008` with message `超出可划转的最大金额`.
- If the user's target is a new account with funds in contract, do not use this transfer-only script by itself. Route the request through FIN `register_recharge_transfer_contract`, which registers the account, recharges spot through FIN, then calls this transfer API and reports the per-account business response.
- It does not verify resulting balances yet. Add a balance query assertion before marking the flow verified.
