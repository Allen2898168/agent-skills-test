# FIN 空投奖励产品化活动发放

## STG 空投奖励发放与审核

Status: verified
Last checked: 2026-05-08

Use when the tester asks to automate FIN Admin `空投奖励(产品化活动)` grant creation and approval on:

`https://stg-admin-web-fin.weex.tech/zh-CN/spotProGrant/airdropRewardProd/`

This flow is financial/reward-affecting. Actual creation and approval require concrete UID/amount values. If the user explicitly asks to recharge/grant and the environment, target UID/account, amount, currency, and approval method are clear from the request or current workflow, do not ask for a second confirmation; pass the script confirmation flags according to that request.

## Script

- `scripts/finance-airdrop-reward-grant.mjs`
- `scripts/batch-register-recharge.mjs`
- `scripts/register-recharge-transfer-contract.mjs`
- Cache action: `finance_airdrop_reward_grant`
- Batch cache action: `batch_register_recharge`
- Contract funding cache action: `register_recharge_transfer_contract` (compound chain: frontend registration -> FIN spot recharge -> frontend spot-to-contract transfer)
- Auth source: persistent Chrome profile Local Storage and optional existing CDP FIN tab. After the user logs in and closes the FIN tab, scripts must not reopen a FIN tab/target when profile auth is readable and the FIN API check passes. If the session is invalid or token is missing, the login recovery script opens the visible FIN page, waits until the user closes it, then continues API-assisted execution through profile auth. Visible FIN pages are only for login recovery.
- Google code source: `WEEX_FIN_GOOGLE_CODE` from `skills/weex-fin-admin-ops/.env.local` or same-skill current process environment variables; do not pass it as a CLI argument or fallback to other skill variables.

## Defaults From The Verified Page

- `bizType`: `125`
- Page label: `空投奖励(产品化活动)`
- Sub business type: `OTHER_ACTIVITIES` / `其他活动`
- Currency: `USDT`, `coinId=2`
- Send type: immediate, `systemType=1`
- Outgoing system user for `其他活动`: read from `listSystemType/125`
- Audit type: first enabled `remarkSubCategory/list` option unless `--audit-type` is provided

## API Chain

1. Resolve FIN auth from an existing FIN tab localStorage, or from the persistent Chrome profile Local Storage files when the FIN tab is closed. Do not open a new FIN tab/target for normal auth reads.
2. If auth is missing or invalid, use the explicit visible login recovery flow and wait for the user to close the FIN page before retrying profile auth.
3. Discover page configuration:
   - `POST /api/admin/fin/asset/adjust/listSystemType/125`
   - `POST /api/admin/fin/asset/remarkSubCategory/list`
4. Create grant order:
   - `POST /api/admin/fin/asset/adjust/createGrantOrder/125`
   - Payload fields: `coinId`, `coinName`, `amount`, `systemType`, `userId`, `params1`, `subBizType`, `systemUserId`
5. Verify created order is in wait-audit list:
   - `POST /api/admin/fin/asset/adjust/listOrderNew/125`
6. Approval:
   - `POST /api/admin/fin/asset/adjust/needGaVerify/125`
   - `POST /api/admin/fin/asset/adjust/verifyPass/125`
7. Verify approved order by list lookup. If the approved list is not immediately indexed, query the pending list by order id; `verifyPass` success plus absence from pending is recorded as supplemental approval evidence.

## Commands

Dry-run:

```bash
node skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs --dry-run --uid <UID> --amount <AMOUNT>
```

Create wait-audit order only:

```bash
node skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs --uid <UID> --amount <AMOUNT> --confirm-create
```

Create and approve:

```bash
node skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs --uid <UID> --amount <AMOUNT> --confirm-create --confirm-approve
```

Batch register and recharge dry-run:

```bash
node skills/weex-fin-admin-ops/scripts/batch-register-recharge.mjs --dry-run --count 3 --amount 1000
```

Batch register and recharge:

```bash
node skills/weex-fin-admin-ops/scripts/batch-register-recharge.mjs --count 3 --amount 1000 --confirm-register --confirm-recharge
```

Register, recharge spot, and transfer to contract dry-run:

```bash
node skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs --dry-run --count 1 --amount 1000
```

Register, recharge spot, and transfer to contract with account-level concurrency:

```bash
node skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs --count 20 --amount 213 --confirm-register --confirm-recharge --confirm-transfer --allow-unverified-transfer-chain
```

Real contract funding must be verified per account by the frontend transfer response. On 2026-05-08, a real run created and recharged accounts, but one frontend transfer returned `20105`; the compound script now preserves partial registration/recharge results and records transfer failures per account.

The compound script treats one account as one ordered chain: frontend registration -> FIN `空投奖励(产品化活动)` creation and approval -> frontend spot-to-contract transfer. Multiple account chains run in parallel by default with concurrency equal to the requested account count, capped at `100`, and each single account keeps that internal order. Use `--concurrency <n>` to override, still capped at `100`.

User-facing final output for contract-funding requests must only show `用户名 / UID / 结果`. Do not include FIN order ids in the final result table unless the tester explicitly asks for them. Keep order ids available in internal script output, handoff, or failure reviews for traceability.

## Target-State Composition

When the tester asks for a new account to “转进合约 1000u”, “合约有 1000 USDT”, or similar wording, interpret it as a final state request, not as a transfer-only API call.

Current handling:

1. Run dry-run to confirm the request maps to `register_recharge_transfer_contract`.
2. If count, amount, currency, and contract target are clear from the user request, execute the compound chain with explicit confirmation flags.
3. Verify each stage separately: account creation, FIN grant order approval, and frontend transfer business response.
4. If transfer fails after successful recharge, report all known accounts and orders; do not create a duplicate batch unless the user explicitly asks.
5. In the user-facing result, summarize per account as username, UID, and result only. Hide FIN order ids from the main output by default.

## Safety

- Never log token, cookie, or Google code in docs/handoff. Staging/test UIDs can be printed and recorded in full; production or unspecified-environment identifiers must still be redacted or avoided.
- The FIN tab may be closed after first login. Later runs should read auth from the persistent profile files without reopening the FIN tab. If the FIN session expires, log in again in the visible CDP Chrome through the explicit login recovery flow.
- Do not run actual creation without `--confirm-create`.
- Do not approve without `--confirm-approve` and a runtime Google code.
- UID and amount are high-risk values; do not guess them. Newly created accounts in the same workflow may provide UID in memory for immediate recharge, and staging/test UID should be printed in full for handoff.
- Batch script output includes full STG/test `email`, `uid`, `orderId`, amount, currency, and approval evidence; it must never print password, token, cookie, fingerprint, or Google code.
- Contract funding output additionally includes frontend transfer payload and response status/code/message; it must still never print frontend tokens, cookies, passwords, signatures, or FIN auth data.

## Current Verification

- Dry-run verified on 2026-05-08 through current CDP Chrome.
- The script successfully resolved current FIN page URL, USDT, `OTHER_ACTIVITIES`, and the audit type list.
- Actual staging create and approve verified on 2026-05-08 for a newly created frontend test account.
- Verification evidence: created order appeared in wait-audit list, `needGaVerify` returned successfully, approval returned successfully, and approved-order list lookup hit the order.
- Batch execution on 2026-05-08 created 3 additional STG frontend test accounts and submitted 3 grants of 1000 USDT each. Two orders hit the approved list immediately; one order returned `verifyPass` success and was absent from the pending list on approve-only recheck, so the script now records pending-absence as supplemental evidence.
- Do not record token, cookie, Google code, or complete account credentials in this reference. Staging/test UID can be recorded in full.
