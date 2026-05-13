# FIN API 账号创建并合约下单

## STG 创建带 API 账号并下合约单

Status: verified
Last verified: 2026-05-12

Use when the tester asks for a new API-enabled account and an immediate contract Open API order, for example `创建个带api账号 下个10u eth多单`.

## Standard Flow

1. Create one FIN system/API account through `system-account.md`.
2. Save generated password, Google code, API key, secret, and passphrase only to ignored local `generated/fin-system-accounts/`.
3. Use FIN `空投奖励(产品化活动)` to grant USDT to the generated UID.
4. Use the generated frontend email/password to transfer spot account type `10` to contract account type `8`.
5. Use the generated API credentials to query contract balance.
6. If explicit quantity is omitted, query ticker and calculate `quantity = orderNotional / price`.
7. Place order through frontend contract Open API script:
   - `side=BUY`, `positionSide=LONG` for 多单/开多.
   - `side=SELL`, `positionSide=SHORT` for 空单/开空.
8. Verify order response and balance after order.

## Script

- `scripts/create-api-account-fund-contract-order.mjs`
- Cached action: `create_api_account_fund_contract_order`

Dry-run:

```bash
node skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs --dry-run --symbol ETHUSDT --order-notional 10
```

Actual run:

```bash
node skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs --confirm-create-account --confirm-recharge --confirm-transfer --confirm-order --fund-amount 20 --symbol ETHUSDT --side BUY --position-side LONG --order-notional 10
```

Default `userType` and `remark` are `codex_api_order`; override them only when the tester requires a specific FIN system-account label.

## Verified Example

- Request: create an API account and place a 10 USDT ETH long.
- Account: `1752792315@weex.com` / UID `1752792315`.
- Contract account id: `748959187416908410`.
- FIN grant: 20 USDT, approval verified.
- Frontend transfer: `POST /v1/assets/transfer`, spot `10` to contract `8`, business code `00000`.
- Ticker price: `2311.026875`.
- Calculated order quantity: `0.0043 ETH`.
- Contract order: `POST /capi/v3/order`, order id `748959975606321786`, success `true`.
- Balance after order: `balance=19.99661646`, `availableBalance=19.50004171`.

## Output Rules

- Final user-facing output can include staging/test email, UID, contract account id, order id, quantity, and verification values.
- Do not print API key, secret, passphrase, account password, Google code, token, cookie, or signature.
- Generated credential files remain local and ignored; never commit them.
