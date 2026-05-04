# Login

## Staging Admin Login

Status: candidate
Last verified: 2026-05-04
Environment: staging

Entry:
`https://stg-activity.weex.tech/login?redirect=<ENCODED_TARGET_PATH>`

Credentials:
- Account: use user-provided `<USERNAME>`, otherwise default to `auto` for staging.
- Password: use user-provided `<PASSWORD>` or `WEEX_ADMIN_PASSWORD`.
- Google code: use user-provided `<GOOGLE_CODE>` or `WEEX_ADMIN_GOOGLE_CODE`.
- If password or Google code is unavailable, ask the user. Do not store real secrets in this file.

Fields:
- Account input placeholder: `账号`
- Password input placeholder: `密码`
- Google code input placeholder: `谷歌验证码`
- Submit button text: `登 录`

Steps:
1. Open the login URL with the desired `redirect` query.
2. Fill account, password, and Google code.
3. Click `登 录`.
4. Wait until URL no longer contains `/login`.
5. Verify the target page loaded or identify any forced redirect.

Success signals:
- Login request returns successfully.
- Final URL is the requested target path or a known post-login redirect.
- Page title is `活动管理系统`.

Known behavior:
- Some sessions may redirect to `/user/profile?tab=googleBind` when Google Authenticator binding is required.
- On 2026-05-04, login with redirect to `/activities/offline/userManage` reached the target page successfully in a later retry.
