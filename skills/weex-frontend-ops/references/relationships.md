# Relationships

Use this file for dependencies between frontend pages, backend/admin configuration, APIs, feature flags, locales, and user/account state.

## Recording Format

| Relationship | Source | Target | Impact | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |

## Known Relationships

| Relationship | Source | Target | Impact | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend page may depend on admin-created activity config | WEEX admin activity configuration | Frontend activity page | Page content, eligibility, buttons, rewards, and copy may differ by config | candidate | - | Record exact dependency after a frontend flow is verified. |
| Frontend authenticated asset transfer depends on loginTool token session | `skills/weex-frontend-ops/.env.local` account + bundled `skills/weex-frontend-ops/vendor/loginTool` | `POST https://stg-gateway2.weex.tech/v1/assets/transfer` | Transfer API requires a frontend login access token sent as `U-Token`; token stays in memory and output is redacted | candidate | 2026-05-08 | Default STG example moves amount `1000` from account type `10` to account type `8` with coin id `2`; real execution requires `--confirm-transfer`. |
