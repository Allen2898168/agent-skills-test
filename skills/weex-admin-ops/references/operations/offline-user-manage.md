# Offline User Manage Operations

## Login And Open Offline User Manage

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
Offline user manage / fake money account.

Purpose:
Log in to the WEEX activity admin and open the offline user manage / fake money account page.

Entry:
`https://stg-activity.weex.tech/login?redirect=%2Factivities%2Foffline%2FuserManage`

Required inputs:
- `<USERNAME>`; default staging username is `auto` if not specified.
- `<PASSWORD>`
- `<GOOGLE_CODE>`

Defaults:
- Environment: staging.
- Optional screenshot path: `artifacts/screenshots/假钱账户/weex-login-success.png`.

Steps:
1. Open the entry URL.
2. Fill `账号` with `<USERNAME>`.
3. Fill `密码` with `<PASSWORD>`.
4. Fill `谷歌验证码` with `<GOOGLE_CODE>`.
5. Click `登 录`.
6. Wait until navigation leaves `/login`.
7. Verify final URL and page content.
8. Save a screenshot only if the user explicitly requested one.

References:
- Route: `../routes.md`
- Login selectors: `../selectors.md`
- Page selectors: `../selectors/offline-user-manage.md`
- Assertions: `../assertions/offline-user-manage.md`
- Known issues: `../known-issues.md`

Success assertions:
- Final URL is `/activities/offline/userManage`.
- Page title is `活动管理系统`.
- Page contains `假钱账户`.
- Page contains table headers including `UID`, `AccountId`, `API Key`.

Observed successful result:
- Final URL: `https://stg-activity.weex.tech/activities/offline/userManage`
- Optional screenshot artifact path: `artifacts/screenshots/假钱账户/weex-login-success.png`

Known failure or alternate result:
- May redirect to `/user/profile?tab=googleBind` if Google Authenticator binding is required.

Update notes:
- Keep this flow as `candidate` until it is repeated successfully or the tester confirms it as stable.
