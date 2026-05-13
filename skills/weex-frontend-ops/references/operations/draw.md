# Frontend Draw Activity Pages

## Authenticated Draw Page Display

Status: candidate
Last verified: 2026-05-11
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
