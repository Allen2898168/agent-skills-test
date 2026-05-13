# FIN Admin Operations Index

Use this file as the table of contents for FIN Admin operation playbooks. Keep full workflows in business-domain files.

## Business Domains

- FIN airdrop reward grant: `finance-airdrop-reward.md`
- Batch frontend register and FIN recharge: `finance-airdrop-reward.md`
- FIN system/API account create: `system-account.md`
- FIN API account contract order: `api-account-contract-order.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| FIN API account create, fund, and contract order | `api-account-contract-order.md` | verified | 2026-05-12 | Compound flow: create API-enabled FIN system account, grant and transfer USDT to contract, then place contract Open API order. Verified with 10 USDT ETH long. |
| FIN system/API account create | `system-account.md` | verified | 2026-05-12 | Creates FIN system accounts with API credentials, polls progress, saves returned secrets only to local ignored generated output, and validates credentials through contract private balance when needed. |
| Register frontend account with contract balance | `finance-airdrop-reward.md` | candidate | 2026-05-08 | Compound flow: register STG frontend account, FIN spot recharge, then frontend spot-to-contract transfer; report per-account transfer business response. |
| Batch frontend account register and FIN recharge | `finance-airdrop-reward.md` | candidate | 2026-05-08 | `batch_register_recharge` creates STG frontend accounts, then recharges each account through FIN `空投奖励(产品化活动)`; FIN auth is headless by default with visible login fallback only on invalid session. |
| FIN airdrop reward grant create and approve | `finance-airdrop-reward.md` | verified | 2026-05-08 | Uses current FIN Admin CDP login state to create and approve `空投奖励(产品化活动)` grants; staging create+approve verified, execution requires explicit confirmations and runtime Google code. |
