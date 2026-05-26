# STG Frontend Cookie Login-State Validation

Status: verified
Last verified: 2026-05-24

Use when the user asks to log in to the WEEX frontend, open a frontend login state, or prepare a browser session for later frontend checks. In visible browser mode, this flow should still use cookie injection and then show the final logged-in page; do not switch to manual form clicking unless the user explicitly requests login-form UI testing.

Stable rule:

- Do not inject the cookie and open `/zh-CN/login` or `/events/draw/<alias>` directly as the first page.
- The verified warm-up path is: inject `WEEX_TOKEN_COOKIE_STAGING` -> open `/zh-CN` -> open `/zh-CN/account` -> then navigate to the target frontend page.
- The account page is the source-of-truth login-state validator for this flow.

## Required Inputs

- Environment: default `stg`.
- Credential source: `skills/weex-frontend-ops/.env.local` or same-skill runtime `WEEX_FRONTEND_*` variables.
- Account alias when multiple accounts are configured.
- Optional local loginTool override only when the bundled skill copy is unavailable.

## Scripts

- Auth config check: `scripts/check-auth-config.mjs`.
- Login flow: `scripts/frontend-login-cookie.mjs`.
- Cached action: `frontend_login_cookie`.

## Steps

1. Run `node scripts/check-auth-config.mjs` from the skill root.
2. If config is missing, ask the tester to create `skills/weex-frontend-ops/.env.local` from `.env.example`.
3. If multiple accounts exist, ask which `WEEX_FRONTEND_ACCOUNT` alias to use.
4. Dry-run the cached action:
   `node scripts/run-cached-action.mjs --action frontend_login_cookie --dry-run`
5. Execute only after required config is present:
   `node scripts/run-cached-action.mjs --action frontend_login_cookie`
6. Add `-- --visible` after the cached action command when visible browser mode is requested.
7. Add `-- --screenshot` only when the user explicitly requests screenshot evidence.
8. When the final goal is an activity page or another business page, first validate `/zh-CN/account`, then continue from that same browser context to the target page.

## Success Assertions

- `WEEX_TOKEN_COOKIE_STAGING` cookie is present.
- Login form text is absent.
- `账号总览`, `账户安全`, or `/account` URL is visible.
- When continuing to a business page, the warmed browser context still shows logged-in business-state UI instead of guest CTA.
- Final URL and viewport are reported.

## Evidence

- Final URL.
- Viewport: desktop `1440x1000` for the current script.
- Token cookie presence as boolean only; never print cookie value.
- Screenshot path only if requested.
- Failed response summary with sensitive query strings and headers omitted.

## Known Limits

- The script uses the bundled `skills/weex-frontend-ops/vendor/loginTool` runtime and does not depend on `/Users/gabriel/Downloads/weexpr/loginTool`.
- This is a cookie-injection login-state validation path, not a manual form-fill login path.
- Directly opening `/zh-CN/login` or an activity page as the first navigation after cookie injection is not the preferred validation path; use `/zh-CN` -> `/zh-CN/account` first.

