# Action Cache

The action cache is the first execution layer for frontend checks that have already been proven and scripted.

## Execution Policy

1. Before manual browser exploration, check `scripts/action-cache.json`.
2. If the user request matches a cached action and required parameters are available, run `scripts/run-cached-action.mjs --dry-run` first.
3. If the cached script succeeds, report the result and verification evidence.
4. If the cached script fails, preserve the failure output, fall back to browser automation, and update failure reviews.
5. Cache scripts must not print secrets, tokens, cookies, or private user data. Staging/test account emails and UIDs can be printed in full; production or unspecified-environment identifiers must still be redacted or avoided.

## Cached Actions

| Action ID | Script | Status | Purpose |
| --- | --- | --- | --- |
| `frontend_login_cookie` | `scripts/frontend-login-cookie.mjs` | candidate | Use runtime WEEX frontend credentials, loginTool token generation, and cookie injection to validate STG frontend login state; visible mode verified on 2026-05-08. |
| `frontend_register_api` | `scripts/frontend-register-api.mjs` | candidate | Create a STG email account through the validated test API path, inject the returned token cookie, and verify account overview; requires `--confirm-register`. |
| `frontend_register_batch_api` | `scripts/frontend-register-batch-api.mjs` | candidate | Create multiple STG email accounts through the validated registration API path, supports invite code, default concurrency equals count capped at 100, and backfills failed submissions with new emails; requires `--confirm-register`. |
| `frontend_assets_transfer` | `scripts/frontend-assets-transfer.mjs` | candidate | Use runtime frontend credentials and loginTool access token to call `POST /v1/assets/transfer`; requires dry-run first and `--confirm-transfer` for real transfer. |

## Natural-Language Matching

For frontend login:

- use `--action frontend_login_cookie` for explicit execution;
- default browser mode is invisible; pass `-- --visible` after the cached action command when the user asks for visible browser mode;
- visible mode still uses cookie injection and only shows the final logged-in page; it does not click through the login form unless the user asks to test login-form UI;
- screenshots are off by default; pass `-- --screenshot` only when the user asks for screenshot evidence;
- run `node scripts/run-cached-action.mjs --action frontend_login_cookie --dry-run` before execution;
- required runtime config lives in `skills/weex-frontend-ops/.env.local` or same-skill `WEEX_FRONTEND_*` environment variables.

For frontend registration:

- use `--action frontend_register_api` for explicit execution;
- always run `node scripts/run-cached-action.mjs --action frontend_register_api --dry-run` before creation;
- actual account creation must pass `-- --confirm-register`;
- default mode is invisible browser verification; pass `-- --visible` only when the user explicitly wants the final authenticated page shown;
- visible mode still uses the API registration path and cookie injection; it does not click through the register form unless the user asks to test register-form UI;
- email is auto-generated as `codexapi<timestamp>@weex.com` unless `-- --email <value>` is provided;
- optional invite code uses `-- --invite-code <value>`;
- screenshots are off by default.

For frontend batch registration:

- use `--action frontend_register_batch_api` for explicit execution;
- always dry-run first:
  `node scripts/run-cached-action.mjs --action frontend_register_batch_api -- --dry-run --count <N>`;
- actual account creation must pass `-- --confirm-register --count <N>`;
- optional invite code uses `-- --invite-code <code>`;
- default concurrency equals requested count, capped at `100`; override with `-- --concurrency <N>`;
- if `register/submit` returns `20105` or another transient failure without UID, the script generates new emails and backfills until the requested count is reached or `--max-attempts` is exceeded;
- optional `-- --output-csv <path>` writes `email,uid` only; never write passwords, tokens, cookies, or verification data.

For frontend asset transfer:

- use `--action frontend_assets_transfer` for explicit execution;
- always run `node scripts/run-cached-action.mjs --action frontend_assets_transfer --dry-run` first;
- real transfer must pass `-- --confirm-transfer`;
- default payload follows the provided STG example: `amount=1000`, `fromAccountType=10`, `toAccountType=8`, `transferCoinId=2`;
- override risky values explicitly with `-- --amount <value> --from-account-type <value> --to-account-type <value> --transfer-coin-id <value>`;
- this is API-only and keeps the login access token in memory; output must not include token, cookie, password, signature, or session values.

## Cache Graduation Rules

After a frontend workflow succeeds and is likely to repeat:

- Add a script under `scripts/`.
- Register it in `scripts/action-cache.json`.
- Add `--dry-run` when practical.
- Record route, viewport, required inputs, and success assertions.
- Keep screenshots optional unless the workflow itself is screenshot verification.
