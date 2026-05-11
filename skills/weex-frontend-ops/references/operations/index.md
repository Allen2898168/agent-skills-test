# Operations Index

Use this file as the table of contents for frontend operation playbooks. Keep full workflows in domain files.

## Business Domains

- Common frontend checks: `common.md`
- Frontend authentication: `auth.md`
- Frontend draw activity pages: `draw.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| Open frontend page and verify baseline state | `common.md` | candidate | - | Placeholder playbook for URL load, visible page assertion, console/network summary, and optional screenshot. |
| Open authenticated draw activity page | `draw.md` | candidate | 2026-05-11 | Injects STG frontend login cookie before opening `/zh-CN/events/draw/<alias>`; backend activity must already be online. |
| STG frontend cookie login-state validation | `auth.md` | candidate | 2026-05-08 | Uses runtime account config and loginTool to inject `WEEX_TOKEN_COOKIE_STAGING`, then opens account page and verifies login state. |
| STG frontend email registration through test API | `auth.md` | candidate | 2026-05-08 | Uses validated STG registration API path, requires explicit confirmation, then verifies account overview with token cookie injection. |
| STG frontend authenticated asset transfer API | `auth.md` | candidate | 2026-05-08 | Uses loginTool access token to call `POST /v1/assets/transfer`; dry-run first and real transfer requires `--confirm-transfer`. |
