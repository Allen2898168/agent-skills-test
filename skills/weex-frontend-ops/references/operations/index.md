# Operations Index

Use this file as the table of contents for frontend operation playbooks. Keep full workflows in domain files.

## Business Domains

- Common frontend checks: `common.md`
- Frontend authentication: `auth.md`
- Frontend contract Open API trading: `contract-api.md`
- Frontend draw activity pages: `draw.md`
- Frontend draw cumulative weight: `draw-weight.md`
- Frontend draw Kafka callback validation: `draw-kafka.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| Open frontend page and verify baseline state | `common.md` | candidate | - | Placeholder playbook for URL load, visible page assertion, console/network summary, and optional screenshot. |
| Open authenticated draw activity page | `draw.md` | candidate | 2026-05-11 | Injects STG frontend login cookie before opening `/zh-CN/events/draw/<alias>`; backend activity must already be online. |
| STG frontend cookie login-state validation | `auth-cookie-login.md` | candidate | 2026-05-24 | Uses runtime account config and loginTool to inject `WEEX_TOKEN_COOKIE_STAGING`, then opens account page and verifies login state. |
| STG frontend email registration through test API | `auth-register-api.md` | candidate | 2026-05-08 | Uses validated STG registration API path, requires explicit confirmation, then verifies account overview with token cookie injection. |
| STG frontend authenticated asset transfer API | `auth-assets-transfer-api.md` | candidate | 2026-05-08 | Uses loginTool access token to call `POST /v1/assets/transfer`; dry-run first and real transfer requires `--confirm-transfer`. |
| STG contract Open API PlaceOrder | `contract-api.md` | candidate | 2026-05-12 | Uses skill-local `WEEX_FRONTEND_CONTRACT_*` credentials and `POST /capi/v3/order`; dry-run first and real order requires `--confirm-order`. |
| STG draw signup-then-trade completion chain | `draw.md` | candidate | 2026-05-12 | For activities where trading task is valid only after signup: signup on draw page, place API order, one-key close on futures page, then verify draw task completion API. |
| STG draw task completion via Kafka callback | `draw-kafka.md` | candidate | 2026-05-13 | Split playbook for internal staging callback validation; use only when explicitly validating callback behavior. |
| STG draw cumulative weight single-draw verification | `draw-weight.md` | candidate | 2026-05-29 | For累计次数再权重配置: run single draws in browser mode, close each success popup via top-right X, and assert target draw popup prize text. |
