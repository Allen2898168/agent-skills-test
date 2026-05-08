# Routes

Use this file for known WEEX frontend routes and route parameters.

## Recording Format

| Page | Environment | Route or URL | Login | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |

## Known Routes

| Page | Environment | Route or URL | Login | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend login | stg | `https://stg-www.weex.tech/zh-CN/login` | no | candidate | - | Used by `frontend_login_cookie` to inject login cookie and verify state. |
| Frontend register | stg | `https://stg-www.weex.tech/zh-CN/register` | no | candidate | 2026-05-08 | Browser page triggers dynamic captcha; repeated fast registration should use `frontend_register_api` when user confirms API-layer registration. |
| Account overview | stg | `https://stg-www.weex.tech/zh-CN/account` | yes | candidate | - | Login-state assertion page after cookie injection. |
