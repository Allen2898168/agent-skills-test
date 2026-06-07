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
- Some protected post-login actions can ask for Google verification again; treat those prompts the same way and never store the real value in the repo.

Fields:
- Account input placeholder: `账号`
- Password input placeholder: `密码`
- Google code input placeholder: `谷歌验证码`
- Ordinary captcha input placeholder, when transiently rendered: `验证码`
- Submit button text: `登 录`

Steps:
1. Open the login URL with the desired `redirect` query.
2. Wait for the login page to finish loading:
   - `GET /prod-api/captchaImage` should return `captchaEnabled=false` in the current staging flow.
   - If an ordinary `验证码` field appears during initial render, wait for it to disappear.
3. Fill only account, password, and Google code.
4. Do not fill the ordinary `验证码` field with the Google code.
5. Click `登 录`.
6. Wait until URL no longer contains `/login`.
7. Verify the target page loaded or identify any forced redirect.

Success signals:
- Login request returns successfully.
- `POST /prod-api/login` returns `code=200`.
- Final URL is the requested target path or a known post-login redirect.
- Page title is `活动管理系统`.

Known behavior:
- Current staging login does not require the ordinary captcha; it only requires the Google code.
- If automation fills and submits before the login page finishes loading, it may catch a transient ordinary `验证码` field and fail because that field should disappear after `captchaEnabled=false` is applied.
- Some sessions may redirect to `/user/profile?tab=googleBind` when Google Authenticator binding is required.
- On 2026-05-04, login with redirect to `/activities/offline/userManage` reached the target page successfully in a later retry.
- On 2026-05-04, three isolated browser login attempts passed with only account, password, and Google code after waiting for the page to stabilize; all reached `/activities/lottery/add`.
