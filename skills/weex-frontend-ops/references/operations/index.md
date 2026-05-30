# Operations Index

Use this file as the table of contents for frontend operation playbooks. Keep full workflows in domain files.

## Business Domains

- Common frontend checks: `common.md`
- Frontend authentication: `auth.md`
- Frontend contract Open API trading: `contract-api.md`
- Frontend draw activity pages: `draw.md`
- Frontend draw five-draw flow: `draw-five.md`
- Frontend draw cumulative weight: `draw-weight.md`
- Frontend draw Kafka callback validation: `draw-kafka.md`
- Frontend draw low-stock flow: `draw-low-stock.md`
- Frontend draw extended UI phases: `draw-ui-extended.md`

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
| STG draw normal five-draw regression | `draw-five.md` | candidate | 2026-05-30 | Covers normal activity FE-25/29/40-44/47 through `frontend_five_draw`; low-stock FE-45/46 remains separate. |
| STG draw low-stock regression | `draw-low-stock.md` | candidate | 2026-05-30 | Covers stock partition FE-23/45/46/57 first, then FE-85 single-draw stock exhaustion with deterministic single-prize weight. |
| STG draw cumulative weight single-draw verification | `draw-weight.md` | standard regression partial | 2026-05-30 | Covers FE-64/65/66/67 through `frontend_weight_special`; run single draws, close each success popup, assert target draw popup prize text and reward record. |
| STG draw remaining frontend UI regression | `draw-ui-extended.md` | standard regression partial | 2026-05-30 | Covers FE-09-15, FE-38/39/58-63, FE-51-54, FE-68-72 through style, exception, reward-record extended, and responsive phases. |
