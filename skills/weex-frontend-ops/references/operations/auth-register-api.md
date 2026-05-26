# STG Frontend Email Registration Through Test API

Status: candidate
Last verified: 2026-05-08

Use when the user asks to create a new STG frontend account quickly and explicitly allows API-layer registration. This is the preferred fast-registration path for internal STG testing because the browser register page can show dynamic captcha variants that are not stable for automation. In visible browser mode, create the account through the API path, then show the final logged-in account page.

## Required Inputs

- Environment: default `stg`.
- Password source: `WEEX_FRONTEND_COMMON_PASSWORD` or `WEEX_FRONTEND_PASSWORD` from `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` runtime environment variables.
- Email: generated as `codexapi<timestamp>@weex.com` unless `--email` is provided.
- Optional invite code: `--invite-code`.
- Explicit creation confirmation: `--confirm-register`.

## Scripts

- Cached action: `frontend_register_api`.
- Registration flow: `scripts/frontend-register-api.mjs`.

## Steps

1. Dry-run the cached action:
   `node scripts/run-cached-action.mjs --action frontend_register_api --dry-run`
2. Confirm the user has approved STG account creation.
3. Execute:
   `node scripts/run-cached-action.mjs --action frontend_register_api -- --confirm-register`
4. Add `-- --confirm-register --email <email>` only when the user provides a specific test email.
5. Add `-- --confirm-register --invite-code <code>` only when an invite code is required.
6. Add `-- --confirm-register --visible` only when the user explicitly wants the final authenticated page shown in a visible browser.

## API Path

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

## Success Assertions

- `register/submit` returns business code `00000`.
- `WEEX_TOKEN_COOKIE_STAGING` cookie is present.
- Final URL is `/zh-CN/account` or account overview text is visible.
- Login form text is absent.
- Failed network responses are summarized without sensitive data.

## Evidence

- Final URL.
- Page title.
- Viewport: desktop `1440x1000`.
- Token cookie presence as boolean only.
- Masked generated email only; never print full email when avoidable.
- Screenshot path only if requested.

## Known Limits

- Email registration is verified; phone registration and country-code selector are page behavior only and are not yet scripted.
- Browser page registration may show image-selection captcha while hidden Aliyun slider DOM exists; do not rely on slider selectors for this flow unless the task is specifically captcha/form UI testing.
- Actual account creation is blocked unless `--confirm-register` is passed.

---

# STG Frontend Batch Email Registration Through Test API

Status: candidate
Last verified: 2026-05-08

Use when the user asks to create multiple STG frontend accounts, optionally with an invite code. This uses the same validated registration API path as single-account registration, but skips browser account-page verification for each account to avoid opening many browser contexts. Success is verified by `register/submit` business code `00000` and returned UID per account.

## Required Inputs

- Environment: default `stg`.
- Count: `--count <N>`.
- Password source: `WEEX_FRONTEND_COMMON_PASSWORD` or `WEEX_FRONTEND_PASSWORD` from `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` runtime environment variables.
- Optional invite code: `--invite-code`.
- Explicit creation confirmation: `--confirm-register`.

## Script

- Batch registration flow: `scripts/frontend-register-batch-api.mjs`.
- Cached action: `frontend_register_batch_api`.

## Steps

1. Dry-run:
   `node scripts/run-cached-action.mjs --action frontend_register_batch_api -- --dry-run --count <N> --invite-code <code>`
2. Execute after the user has approved account creation:
   `node scripts/run-cached-action.mjs --action frontend_register_batch_api -- --count <N> --invite-code <code> --confirm-register --output-csv <path>`
3. Default concurrency equals count, capped at `100`. Use `--concurrency <N>` only when overriding.
4. If an account fails before UID is returned, the script creates a replacement with a new email. It does not retry the same email.

## Success Assertions

- Exactly requested count of accounts return UID.
- Each success has an email and UID.
- Optional CSV contains only `email,uid`.

## Known Limits

- API-only, no browser viewport.
- The script does not save login token cookies for all accounts.
- High-concurrency registration can return `20105`; the fixed path is automatic backfill with new emails up to `--max-attempts`.

