# Frontend Draw Activity Pages

## Authenticated Draw Page Display

Status: candidate
Last verified: 2026-05-19
Environment: staging `https://stg-www.weex.tech`
Viewport: desktop `1440x1000`

Use when the user asks to open or verify a WEEX frontend draw activity page created from the activity admin `转盘抽奖` workflow.

### Required Inputs

- Activity alias.
- Expected activity title or other page identity text.
- Login requirement. For internal STG draw checks, inject a frontend test-account login state before opening the URL.
- Viewport/device. Default verified viewport is desktop `1440x1000`.

### URL

`https://stg-www.weex.tech/zh-CN/events/draw/<activity-alias>`

### Preconditions

- The backend activity must already be online. Draft activity URLs are not accepted as frontend display success.
- If the activity start time is in the future, visible status such as `即将开始` and countdown text is acceptable.
- The browser context must contain the generated `WEEX_TOKEN_COOKIE_STAGING` cookie for the selected frontend account before navigation.
- Lottery draw activities require signup before the user can enter the actual draw state.

### Steps

1. Resolve or create the frontend STG test account through the frontend auth/register flow.
2. Build the frontend auth cookie with the bundled `loginTool` runtime.
3. Add the cookie to the browser context for `stg-www.weex.tech`.
4. Open the draw URL.
5. Wait for the expected activity title or route-specific text.
6. Check that no login form is visible.
7. Check that the token cookie is present as a boolean only.
8. Capture failed network responses when validating page health.

### Success Assertions

- Final URL matches `/zh-CN/events/draw/<activity-alias>`.
- Expected activity title is present in the page body.
- Login form is absent.
- `WEEX_TOKEN_COOKIE_STAGING` is present in the browser context.
- No critical failed responses were observed.

### Verified 2026-05-11 Sample

One frontend account `codexapi1778492089526@weex.com` / UID `7901867346` opened five online lottery activities:

- `frontend-draw-round-20260511085251`
- `frontend-draw-dart-20260511085602`
- `frontend-draw-egg-20260511091543`
- `frontend-draw-marquee-20260511091915`
- `frontend-draw-football-20260511093107`

All five pages showed their activity title, had no login form, had token cookie present, and reported no failed responses.

## Draw Signup State And Minimal Signup Chain

Status: candidate
Last verified: 2026-05-19
Environment: staging `https://stg-www.weex.tech`
Viewport: desktop `1440x1000`

Use when the goal is only to validate the lottery signup state and the minimal signup transition, without completing trading or raffle-task flows.

### Required Inputs

- Activity alias.
- One frontend account with valid current login credentials.
- Browser mode requirement.

### Stable Rules

- Draw activity URL format is `https://stg-www.weex.tech/zh-CN/events/draw/<activity-alias>`.
- The backend activity must already be online.
- If the activity has not started yet, the main button shows `即将开始`.
- If the activity is in progress and the current user has not signed up, the main button shows `立即报名`.
- After a successful signup, the main button no longer shows `立即报名`; it changes to `抽奖`.
- When the same signed-up account reopens the same activity page, `抽奖` remains visible and `立即报名` does not return.

### Steps

1. Build the frontend auth cookie from the selected account and open the draw URL.
2. Inspect the main button state:
   - `即将开始`
   - `立即报名`
   - `抽奖`
3. If the page shows `立即报名`, click it once.
4. Wait for the frontend signup requests to settle.
5. Re-check the visible main button state.
6. Reopen the same activity URL with the same account and confirm the state is still `抽奖`.

### Success Assertions

- The page opens the correct `/zh-CN/events/draw/<activity-alias>` route.
- For an in-progress unsigned account, `立即报名` is visible before signup.
- Signup request `/v1/activity/general/apply` returns success payload.
- After signup, the visible main button changes from `立即报名` to `抽奖`.
- Reopening the same page with the same account still shows `抽奖`.
- No critical failed responses are observed during the signup transition.

### Verified 2026-05-19 Sample

- Activity alias `autotest-20260519103256-stock`.
- The page URL opened as `https://stg-www.weex.tech/zh-CN/events/draw/autotest-20260519103256-stock`.
- One authenticated test account first saw `立即报名`.
- Clicking `立即报名` produced successful `/v1/activity/general/apply` responses with `code=00000`.
- The visible main button changed to `抽奖`.
- Reopening the same page with the same account showed `抽奖` directly; `立即报名` was no longer visible.

## Single Draw Success And Reward Popup

Status: candidate
Last verified: 2026-05-19
Environment: staging `https://stg-www.weex.tech`
Viewport: desktop `1440x1000`

Use when the goal is to validate the minimal successful single-draw chain after the user is already signed up and has available draw count.

### Stable Rules

- Immediate single-draw success should be judged first by frontend-visible signals, not only by reward-history availability.
- The current strongest immediate success signals are:
  - draw count decreases by `1`
  - success popup appears
  - popup contains success text such as `恭喜你` and the actual prize text
- Reward history may lag behind the popup success and count decrement. It must not be used as the only immediate success assertion.

### Steps

1. Open one online draw activity page with a signed-up account that has available draw count.
2. Record the visible draw count before clicking.
3. Click `抽奖` once.
4. Wait for the result popup.
5. Record the visible draw count after the popup appears.
6. Optionally open `我的奖品 -> 奖励记录` for delayed cross-check only.

### Success Assertions

- The draw request returns success.
- A prize popup appears after the click.
- The popup contains success text such as `恭喜你`.
- The popup contains the prize name or prize description.
- The visible draw count decreases by `1`.

### Verified 2026-05-19 Sample

- Activity alias `autotest-20260519103256-stock`.
- Account `8186595891@weex.com` / UID `8186595891`.
- Visible draw count changed from `110` to `109`.
- Popup showed `恭喜你`.
- Popup prize text showed `1 USDT 仓位券`.
- Popup body text showed `你获得了 1 USDT 仓位券!`.
- This chain was considered a real single-draw success even though reward history did not return the record immediately.

## Draw Task Completion (Signup -> Trade -> One-Key Close -> Verify)

Status: candidate  
Last verified: 2026-05-12  
Environment: staging `https://stg-www.weex.tech`  
Viewport: desktop `1440x1000`

Use when the draw activity contract trading task is counted only after signup.

### Required Inputs

- Activity alias.
- API-capable account local credential file (generated FIN system account json).
- Contract order parameters (`symbol`, `side`, `positionSide`, `quantity`).
- Browser mode requirement (`--visible` for browser mode).

### Script

- `scripts/frontend-draw-signup-trade-close-verify.mjs`
- Cached action: `frontend_draw_signup_trade_close_verify`

### Steps

1. Build frontend cookie from account email/password and open draw page.
2. On draw page, click `立即报名` until `apply` returns success or `applyStatus=true`.
3. Place one contract Open API order using the same account API key set.
4. Open futures page and click `一键平仓` and confirm.
5. Return draw page and verify `taskCompletions` and `raffle/frequency`.

### Success Assertions

- Signup success: `apply code=00000` or `applyStatus=true`.
- API order success: `POST /capi/v3/order` returns HTTP 2xx success payload.
- Frontend close action executed and position cleared.
- Draw task verified by API: `taskCompletions` contains `COMPLETED` (target `taskId` or `TRADING_VOLUME`) and `frequency.doTaskGetCount > 0`.

### Verified 2026-05-12 Sample

- Activity ID `9084`, alias `signup-trade-draw-20260512163959`.
- Account `7670579106@weex.com` / UID `7670579106`.
- Signup success confirmed by `apply` and `applyStatus=true`.
- Order success: ETHUSDT market long.
- One-key close executed on futures page.
- Completion proof: `taskId=4882`, `status=COMPLETED`, `tradingCount=1`, `tradingVolume=3393.84`, `doTaskGetCount=1`.

## Draw Task Completion By Kafka Callback

Internal STG Kafka callback validation is maintained in `draw-kafka.md`.

## Remaining Draw Frontend Regression Phases

抽奖样式、异常容错、奖励记录补充分支和响应式专项维护在 `draw-ui-extended.md`。
