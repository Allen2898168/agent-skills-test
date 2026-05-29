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
| `frontend_contract_place_order` | `scripts/frontend-contract-place-order.mjs` | candidate | Use skill-local `WEEX_FRONTEND_CONTRACT_*` credentials to call STG Contract Open API `POST /capi/v3/order`; requires `--confirm-order`. |
| `frontend_draw_signup_trade_close_verify` | `scripts/frontend-draw-signup-trade-close-verify.mjs` | candidate | For draw activities where trade tasks are valid only after signup: signup on draw page, place API order, one-key close on futures page, then verify `taskCompletions`/`frequency`; requires `--confirm-run`. |
| `frontend_draw_kafka_recharge_verify` | `scripts/frontend-draw-kafka-recharge-verify.mjs` | candidate | For internal STG recharge-task callback checks: signup if needed, send Kafka callback value in UI, then verify draw `taskCompletions`/`frequency`; requires `--confirm-run`. |
| `frontend_draw_weight_special_verify` | `scripts/frontend-draw-weight-special-verify.mjs` | candidate | For draw cumulative re-weighting checks: run visible single draws, capture each `恭喜你` popup, close via top-right `X`, and assert target draw prize text. |

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

For frontend contract API order placement:

- use `--action frontend_contract_place_order` for explicit execution;
- use `-- --ticker-only --symbol BTCUSDT` to verify the STG contract API base without credentials;
- use `-- --check-balance` to verify skill-local API credentials;
- always dry-run the order body before live placement;
- real order placement must pass `-- --confirm-order`;
- credentials must come only from `skills/weex-frontend-ops/.env.local` or current process `WEEX_FRONTEND_CONTRACT_*` variables.

For draw signup-then-trade task completion:

- use `--action frontend_draw_signup_trade_close_verify` for explicit execution;
- always dry-run first:
  `node scripts/run-cached-action.mjs --action frontend_draw_signup_trade_close_verify --dry-run -- --activity-alias <alias> --account-file <json>`;
- real execution must pass `-- --confirm-run`;
- for browser mode pass `-- --visible`;
- if task ID is known, pass `-- --task-id <id>` for strict completion assertion;
- account credential file must be local generated FIN system account json containing email/password/apiKey/secret/passphrase.

For draw recharge completion by Kafka callback:

- use `--action frontend_draw_kafka_recharge_verify` for explicit execution;
- always dry-run first:
  `node scripts/run-cached-action.mjs --action frontend_draw_kafka_recharge_verify --dry-run -- --activity-alias <alias> --activity-id <id> --email <email> --uid <uid>`;
- real execution must pass `-- --confirm-run`;
- for browser mode pass `-- --visible`;
- pass explicit `-- --task-id <id>` when task ID is known;
- callback value is written in Kafka UI `Value` editor only; script uses ACE editor write path and does not fill key/header by default.

For draw cumulative weight verification:

- use `--action frontend_draw_weight_special_verify` for explicit execution;
- always dry-run first:
  `node scripts/run-cached-action.mjs --action frontend_draw_weight_special_verify --dry-run -- --activity-alias <alias> --expected-prize-text <text> --draw-times 6`;
- for browser mode pass `-- --visible`;
- the script uses the default frontend test account unless `-- --account-alias <alias>` is provided;
- close each prize popup through the top-right `X`; do not close or reopen the page between draws.

## Cache Graduation Rules

After a frontend workflow succeeds and is likely to repeat:

- Add a script under `scripts/`.
- Register it in `scripts/action-cache.json`.
- Add `--dry-run` when practical.
- Record route, viewport, required inputs, and success assertions.
- Keep screenshots optional unless the workflow itself is screenshot verification.
