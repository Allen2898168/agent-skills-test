# Known Issues

## Google Authenticator Binding Redirect

Observed: 2026-05-04

After login, the account can be redirected to:
`/user/profile?tab=googleBind`

Meaning:
- The account may need Google Authenticator binding before accessing some admin pages.

Handling:
1. Report the redirect clearly.
2. Do not attempt to bind Google Authenticator unless the user explicitly asks and provides the necessary confirmation.
3. Retry target navigation only if it is safe; if it redirects again, treat binding as a blocker.

## Activity Task Mixed Reward Save Failure

Observed: 2026-05-04

Page:
`/activity/task`

Scope:
- `活动通用模块管理 / 活动任务管理`
- Add task dialog.
- Activity type `转盘抽奖`.
- Reward mode `混合奖励`.

Observed behavior:
- The submit request to `POST /prod-api/activity/task` returned HTTP 200.
- The page displayed `system busy, please retry later` and `保存任务失败`.
- Searching by the attempted alias `转盘抽奖_mix_1777916693695` returned no row.

Handling:
1. Treat this as blocked pending development fix.
2. Do not classify HTTP 200 as success for this branch.
3. Re-run the mixed reward branch only after development confirms the fix.
