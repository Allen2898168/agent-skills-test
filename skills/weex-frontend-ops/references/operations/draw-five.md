# Frontend Draw Five-Draw Flow

## Normal Five-Draw Regression

Status: candidate
Last verified: 2026-05-30
Environment: staging `https://stg-www.weex.tech`
Viewport: default desktop `1440x1000`

Use when validating the normal frontend five-draw path after signup and draw count preparation.

### Script

- `scripts/lottery-frontend-main-flow.mjs --phase five_draw`
- Regression phase: `frontend_five_draw`
- Covered case IDs: `FE-25`, `FE-29`, `FE-40`, `FE-41`, `FE-42`, `FE-43`, `FE-44`, `FE-47`

### Preconditions

- Activity is online and in progress.
- Account is signed up.
- Draw count is greater than or equal to `5`; the standard regression chain prepares count through MQ recharge callback.

### Success Assertions

- `抽奖 × 5` is visible and clickable when count is greater than `5`.
- Five-draw request returns business `code=00000`; capture any non-frequency `/v1/activity/general/raffle/*` draw response, not only legacy `luckDraw`.
- Success popup appears and exposes multiple reward result lines.
- Close the success popup through its visible close/confirm control before opening `我的奖品`; Escape alone is not stable enough.
- Draw count decreases by `5`.
- Reward record dialog opens after the draw and contains standard fields: `活动名称`, `奖励金额`, `获奖时间`, `备注`.

### Limits

- `FE-45` and `FE-46` are low-stock failure branches. They are not part of the normal five-draw activity path and still require the small-stock专项 activity.
