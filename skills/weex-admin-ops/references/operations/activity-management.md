# Activity Management Operations

## Lottery Activity Create And Online

Status: candidate
Last verified: 2026-05-14
Environment: staging

Business domain:
活动列表 / 转盘抽奖。

Purpose:
- Create a `转盘抽奖` activity on `/activities/lottery/add`.
- Verify the created row on `/activities/lottery`.
- Capture the verified `上线` gate for later automation.

Validated create result:
- Activity ID: `9016`
- Activity alias: `jonathan-test`
- Activity title: `自动化测试抽奖活动 -勿删`
- Created task IDs: `4873`, `4874`
- Bound prize records: `515` (`赠金`), `516` (`BTC`), `517` (`实物`)
- Frontend URL pattern verified for this branch:
  - `https://stg-www.weex.tech/zh-CN/events/draw/<ACTIVITY_ALIAS>`
  - example: `https://stg-www.weex.tech/zh-CN/events/draw/jonathan-test`

Validated create constraints:
- `活动别名` only accepts lowercase letters, digits, and `-`.
- An alias like `Jonathan_test` is invalid and must be normalized before submit.
- Default regression aliases must stay within `10` characters unless the run is explicitly a boundary-value test.
- `是否支持预报名 = 不支持` can be submitted with `preApplyConfig = null`.
- A valid `用户报名模版` is still required even when pre-registration is disabled.

Validated online behavior:
- List-row action `上线` opens a confirmation dialog.
- Confirming `上线` triggers `POST /prod-api/activity/lottery/online`.
- The confirmation dialog requires a verification input; missing code still returns backend rejection.
- Verified success on 2026-05-14: activity `9107` / alias `jonathan-test-20260514051431` was put online in headless real-UI mode, `POST /prod-api/activity/lottery/online` returned HTTP 200 / `code=200`, and follow-up detail re-query showed `status=ONLINE`.

Operator rule:
- Treat `上线` as a second-factor-protected state change.
- Before executing `上线`, confirm that a current `<GOOGLE_CODE>` is available from:
  - explicit user input for this run, or
  - `WEEX_ADMIN_GOOGLE_CODE`.
- Never store a real Google code in the skill, references, scripts, temp files, or git history.

Suggested online execution checklist:
1. Search the target alias on `/activities/lottery`.
2. Confirm the target row is the intended activity.
3. Click row action `上线`.
4. When the confirmation flow requires Google verification, fill `<GOOGLE_CODE>` from runtime input only.
5. Confirm the dialog.
6. Verify the backend response and then re-check the row status.

Failure handling:
- If backend returns `google验证码不得为空`, stop retrying blind clicks.
- Ask for a current Google code or require `WEEX_ADMIN_GOOGLE_CODE` to be set before retrying.
- Do not write the received code into the repository while documenting the fix.
Use this file for operations such as:
- Create newbie activity.
- Edit activity configuration.
- Enable or disable an activity.
- Update activity calendar or activity common modules.

For activity creation, do not infer high-risk fields such as activity time, reward amount, user scope, or enablement state. Ask the tester for confirmation unless a verified default exists.

## Verified Playbooks

- `activity-management-lottery.md`: `活动列表 / 转盘抽奖` search verification and visible-browser draft creation. Verified on staging on 2026-05-07.
