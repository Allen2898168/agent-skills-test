# Routes

Use this file for known WEEX frontend routes and route parameters.

## Recording Format

| Page | Environment | Route or URL | Login | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |

## Known Routes

| Page | Environment | Route or URL | Login | Status | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend login form | stg | `https://stg-www.weex.tech/zh-CN/login` | no | candidate | - | Use only when explicitly testing the login form UI. |
| Frontend account login-state validation | stg | `https://stg-www.weex.tech/zh-CN/account` | yes | candidate | - | Used by `frontend_login_cookie` after the `/zh-CN` warm-up path to verify injected cookie login state. |
| Frontend register | stg | `https://stg-www.weex.tech/zh-CN/register` | no | candidate | 2026-05-08 | Browser page triggers dynamic captcha; repeated fast registration should use `frontend_register_api` when user confirms API-layer registration. |
| Account overview | stg | `https://stg-www.weex.tech/zh-CN/account` | yes | candidate | - | Login-state assertion page after cookie injection. |
| Draw activity page | stg | `https://stg-www.weex.tech/zh-CN/events/draw/<activity-alias>` | yes | candidate | 2026-05-11 | Activity must be online before verification; inject frontend auth cookie before navigation. |
