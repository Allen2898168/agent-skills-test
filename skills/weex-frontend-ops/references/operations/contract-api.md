# Frontend Contract Open API Trading

## STG Contract PlaceOrder

Status: candidate
Last verified: 2026-05-12

Use when a frontend activity task requires contract trading volume but the browser trading page is not the verification target. This path places a contract order through WEEX Contract Open API instead of clicking the frontend trading page.

### Required Inputs

- API-enabled STG account with contract trading permission.
- Skill-local credentials in `skills/weex-frontend-ops/.env.local`:
  - `WEEX_FRONTEND_CONTRACT_API_BASE_URL`
  - `WEEX_FRONTEND_CONTRACT_API_KEY`
  - `WEEX_FRONTEND_CONTRACT_API_SECRET`
  - `WEEX_FRONTEND_CONTRACT_API_PASSPHRASE`
- Order parameters:
  - `symbol`, default example `BTCUSDT`
  - `side`: `BUY` or `SELL`
  - `positionSide`: `LONG` or `SHORT`
  - `type`: `MARKET` or `LIMIT`
  - `quantity`
  - `price` and `timeInForce` only for `LIMIT`

### API Path

- STG base observed for public contract API: `https://stg-api-contract.weex.tech`.
- Place order endpoint: `POST /capi/v3/order`.
- Public ticker endpoint for base verification: `GET /capi/v3/market/symbolPrice?symbol=BTCUSDT`.
- Private balance endpoint for credential verification: `GET /capi/v3/account/balance`.
- Signature message: `timestamp + method + requestPath + (?queryString) + body`.
- Signature algorithm: HMAC-SHA256 with base64 output.
- Auth headers: `ACCESS-KEY`, `ACCESS-PASSPHRASE`, `ACCESS-TIMESTAMP`, `ACCESS-SIGN`.

### Script

- `scripts/frontend-contract-place-order.mjs`
- Cached action: `frontend_contract_place_order`

### Steps

1. Verify public base:
   `node scripts/frontend-contract-place-order.mjs --ticker-only --symbol BTCUSDT`
2. Verify private credential and contract balance:
   `node scripts/frontend-contract-place-order.mjs --check-balance`
3. Dry-run order body:
   `node scripts/frontend-contract-place-order.mjs --dry-run --symbol BTCUSDT --side BUY --position-side LONG --type MARKET --quantity <qty>`
4. Execute only after the user has requested the trade-task API path and parameters are clear:
   `node scripts/frontend-contract-place-order.mjs --confirm-order --symbol BTCUSDT --side BUY --position-side LONG --type MARKET --quantity <qty>`
5. Recheck the activity task completion through the activity frontend task API or activity page, depending on the parent workflow.

### Success Assertions

- Public ticker returns HTTP 2xx.
- Private balance returns HTTP 2xx for the selected API-enabled account.
- PlaceOrder returns HTTP 2xx and a success payload.
- Activity task completion is verified after order placement.

### Known Limits

- Existing generated account xlsx may contain UID/email/contract account id but empty API key columns; do not assume it is API-order-ready.
- Do not read API credentials from other skills or from `weex-trader-skill`.
- Do not print API key, secret, passphrase, signature, token, cookie, password, or Google code.
- For requests that start with creating a new API-enabled account and then placing an order, use the FIN Admin compound playbook `skills/weex-fin-admin-ops/references/operations/api-account-contract-order.md`; this frontend script is only the downstream contract Open API executor.
