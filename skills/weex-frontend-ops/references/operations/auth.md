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
- Credential source: `skills/weex-frontend-ops/.env.local` or runtime `WEEX_FRONTEND_*` variables.
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
- Password source: `WEEX_FRONTEND_COMMON_PASSWORD` or `WEEX_FRONTEND_PASSWORD` from `skills/weex-frontend-ops/.env.local` or runtime environment.
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
