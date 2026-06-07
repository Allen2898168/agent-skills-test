# Activity Management - Lottery Frontend Signup Rules

Status: verified
Last verified: 2026-05-19
Environment: staging `https://stg-www.weex.tech`

## Scope

This file stores the frontend-state rules that are coupled to the backend lottery activity lifecycle.

Use it when:
- A backend-created lottery activity must be verified on the frontend
- The tester asks whether signup is required
- The tester asks what the main frontend button should show before and after signup

## Stable Rules

- Frontend draw URL uses the activity alias:
  - `https://stg-www.weex.tech/zh-CN/events/draw/<activity-alias>`
- The backend activity must already be online before frontend validation starts.
- Lottery draw activities require signup on the frontend before the user enters the actual raffle state.
- If the activity has not started yet, the frontend main button shows `即将开始`.
- If the activity is in progress and the current user has not signed up, the frontend main button shows `立即报名`.
- After successful signup, the frontend main button changes from `立即报名` to `抽奖`.
- Reopening the same activity page with the same signed-up account should still show `抽奖`, not `立即报名`.

## Verified 2026-05-19 Sample

- Activity alias: `autotest-20260519103256-stock`
- Frontend URL: `https://stg-www.weex.tech/zh-CN/events/draw/autotest-20260519103256-stock`
- One authenticated test account first saw `立即报名`
- Clicking `立即报名` returned successful `/v1/activity/general/apply` responses with `code=00000`
- The visible main button changed to `抽奖`
- Reopening the same page with the same account still showed `抽奖`
