# FIN Admin Action Cache

The FIN Admin action cache is the first execution layer for FIN workflows that have already been scripted.

## Execution Policy

1. Before any cached FIN action, run `scripts/fin-auth-check.mjs` to verify persistent CDP login state and the basic FIN interface.
2. If no FIN tab exists but the persistent profile has a valid login state, scripts must read auth from the Chrome profile Local Storage files and must not open a new FIN tab/target.
3. If the base check fails, open the persistent CDP FIN page visibly only in the explicit login recovery flow, verify that a FIN page target actually exists in CDP, wait indefinitely for the user to log in and close the page, then re-run the base check through profile auth.
4. If the re-check succeeds, continue silently with non-visible/API execution. Do not open visible or headless FIN tabs unless login state is invalid and the recovery flow explicitly allows it.
5. Operators must not replace this with a manual normal Chrome launch. Token recovery must use the persistent CDP Chrome/profile so the refreshed token is readable by FIN scripts. If the recovery flow reports that no FIN target opened, fix the CDP launch/open path before continuing.
6. Before manual FIN browser exploration, check `scripts/action-cache.json`.
7. If the user request matches a cached FIN action and required parameters are available, run `scripts/run-cached-action.mjs --dry-run`.
8. For financial writes, require explicit confirmation flags in the target script. If the user already clearly requested recharge/grant execution and all high-risk values are available, pass those flags without asking for a second confirmation.
9. Approval requires runtime Google code from environment variables only.
10. Verify business response and result lookup; do not treat HTTP 200 alone as success.
11. If the cached script fails, preserve the failure output, inspect via CDP or browser as needed, update failure reviews, and update the cache if the fix is reusable.

## Cached Actions

| Action ID | Script | Status | Purpose |
| --- | --- | --- | --- |
| `register_recharge_transfer_contract` | `scripts/register-recharge-transfer-contract.mjs` | candidate | Compound flow for contract-balance requests: register frontend account, recharge spot through FIN, then transfer spot to contract through frontend API; report per-account transfer response. |
| `batch_register_recharge` | `scripts/batch-register-recharge.mjs` | candidate | Batch create STG frontend accounts and recharge each account through FIN `空投奖励(产品化活动)`; FIN auth is checked headlessly first and visible login opens only when the session is invalid. |
| `finance_airdrop_reward_grant` | `scripts/finance-airdrop-reward-grant.mjs` | verified | Use current FIN Admin CDP login state to create and optionally approve `空投奖励(产品化活动)` grants; staging create+approve verified, real execution requires script confirmation flags and runtime Google code. |

## Register, Recharge, And Transfer To Contract

- Use `--action register_recharge_transfer_contract` for explicit execution.
- Natural language such as `注册一个账号 转进合约1000u` should match this action, not the frontend transfer-only action.
- Required parameters are `--count <n>` and `--amount <AMOUNT>`.
- Default currency is `USDT`, default spot source account type is `10`, default contract target account type is `8`, and default `transferCoinId` is `2`.
- Default concurrency equals the requested account count, capped at `100`, for multiple account contract-funding requests. Operators must not lower concurrency for the initial run unless the user explicitly requests sequential execution. Pass `--concurrency <n>` to override, still capped at `100`. Concurrency is across accounts only; each account still runs in strict order: frontend registration, FIN grant approval, then frontend transfer.
- Frontend transfer retry is built in: retryable business responses `70008` and `20105` are retried twice by default with a short delay. These retries repeat only the frontend transfer for that account; they must not repeat registration or FIN recharge.
- Dry-run validates frontend registration config, FIN auth readiness, and frontend transfer config without creating accounts, grants, or transfers.
- Actual execution requires `--confirm-register --confirm-recharge --confirm-transfer`.
- While the chain remains candidate, use `--allow-unverified-transfer-chain` only when the user explicitly asks for the compound contract-funding target state.
- FIN grant success alone does not satisfy contract balance; final success requires frontend transfer business code `00000`.
- If transfer still fails after successful recharge and built-in retries, preserve all known accounts, grant orders, and transfer responses internally; do not create a duplicate batch unless the user explicitly confirms it.
- User-facing output for this action should only include `用户名 / UID / 结果`. Do not show FIN order ids unless the tester explicitly asks for them.
- The maximum effective concurrency is `100`.

## Batch Register And Recharge

- Use `--action batch_register_recharge` for explicit execution.
- Required parameters are `--count <n>` and `--amount <AMOUNT>`.
- Default currency is `USDT`; default email prefix is `codexapi`.
- Dry-run validates frontend registration config and FIN auth readiness without creating accounts or orders.
- Actual execution requires `--confirm-register --confirm-recharge`.
- FIN auth behavior: the script first tries headless CDP/profile auth. If token/session is invalid, it closes the headless CDP browser, opens the visible persistent FIN page, waits until the user closes it, switches back to headless, then continues with API-assisted non-visible execution.
- STG/test output includes full `email` and `uid`; passwords, Google code, token, cookie, and fingerprint are never printed.

## FIN Airdrop Reward Grants

- Use `--action finance_airdrop_reward_grant` for explicit execution.
- Default auth source is the persistent Chrome profile Local Storage. If no FIN tab exists, the script reads profile files and must not open the FIN page during normal execution.
- Required parameters are `--uid <UID>` and `--amount <AMOUNT>`.
- Default values are `--currency USDT`, `--sub-biz-type OTHER_ACTIVITIES`, send type immediate, and first enabled audit type.
- Run `--dry-run` first to verify current CDP login state and resolved config.
- Actual order creation requires `--confirm-create`.
- Approval requires `--confirm-approve` plus `WEEX_FIN_GOOGLE_CODE` from `skills/weex-fin-admin-ops/.env.local` or same-skill current process environment variables.
- Do not pass Google code in CLI arguments and do not log token, cookie, fingerprint, or Google code. Staging/test UIDs can be printed in full; production or unspecified-environment identifiers must still be redacted or avoided.

## Examples

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action finance_airdrop_reward_grant --uid <UID> --amount <AMOUNT> --dry-run
```

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --query "FIN 财务充值发放 USDT 目标账号 uid <UID> 数量 <AMOUNT> 其他活动" --dry-run
```

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action batch_register_recharge --count 3 --amount 1000 --dry-run
```

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --query "注册一个账号 转进合约1000u" --dry-run
```
