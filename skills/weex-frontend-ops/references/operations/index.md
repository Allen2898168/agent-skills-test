# Operations Index

Use this file as the table of contents for frontend operation playbooks. Keep full workflows in domain files.

## Business Domains

- Common frontend checks: `common.md`
- Frontend authentication: `auth.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| Open frontend page and verify baseline state | `common.md` | candidate | - | Placeholder playbook for URL load, visible page assertion, console/network summary, and optional screenshot. |
| STG frontend cookie login-state validation | `auth.md` | candidate | 2026-05-08 | Uses runtime account config and loginTool to inject `WEEX_TOKEN_COOKIE_STAGING`, then opens account page and verifies login state. |
| STG frontend email registration through test API | `auth.md` | candidate | 2026-05-08 | Uses validated STG registration API path, requires explicit confirmation, then verifies account overview with token cookie injection. |
