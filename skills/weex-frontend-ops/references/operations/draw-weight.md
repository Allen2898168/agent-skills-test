# Frontend Draw Cumulative Weight

## Cumulative Weight Single-Draw Verification

Status: standard regression partial
Last verified: 2026-05-30
Environment: staging `https://stg-www.weex.tech`
Viewport: desktop `1440x1000`

Use when validating the admin-side `累计次数再权重配置` on the frontend draw page. The verified pattern is cumulative `5` times + same user + target prize pool ID `5` weight `100`; the 6th single draw should show the configured target prize text.

This flow is now included in the standard lottery frontend main regression as phase `frontend_weight_special`, covering `FE-64` / `FE-65` / `FE-66` / `FE-67`. `run-full-headless --selection 二次权重专项` routes to `lottery_frontend_main_regression` and emits the four case results in the standard report.

### Script

- `scripts/frontend-draw-weight-special-verify.mjs`
- Cached action: `frontend_draw_weight_special_verify`
- Standard regression phase: `frontend_weight_special`
- Standard case IDs: `FE-64`, `FE-65`, `FE-66`, `FE-67`

### Stable Rules

- Complete the recharge task by MQ callback, not by FIN Admin grant/login.
- Frontend draw execution must use real browser clicks when the user asks for browser mode.
- Click only the visible current-viewport control whose compact text is exactly `抽奖×1`.
- After each successful draw, wait for the `恭喜你` prize popup, read the popup prize text, then click the popup top-right `X`.
- Do not close or reopen the activity page between draws; do not use page scrolling as part of the draw loop.
- The current `luckDraw` response can return only `code=00000/msg=success` without a prize ID, so the stable assertion is the 6th popup prize text.

### Success Assertions

- Initial draw count is at least the requested draw count.
- Each draw response has business `code=00000`.
- Each draw shows the `恭喜你` popup.
- Draw count decreases by the number of draws.
- The target draw popup contains the expected prize text, for example `100 USDT 合约赠金`.

### Verified 2026-05-29 Sample

- Activity ID `9694`, alias `wt43083858`.
- Account `8186595891@weex.com` / UID `8186595891`.
- MQ callback amount `1000`, draw count before test `10`.
- Executed 6 single draws in visible browser mode.
- Draw count changed from `10` to `4`.
- The 6th popup showed `100 USDT 合约赠金`.

### Verified 2026-05-30 Standard Regression Sample

- Entrypoint: `run-full-headless --selection 二次权重专项`.
- Activity ID `9719`, alias `w13402457`.
- Result: `FE-64/65/66/67` all PASS.
- Draw count changed from `10` to `4`.
- The 6th popup showed `100 USDT 合约赠金`.
- Reward record latest text contained `100 USDT 合约赠金`.
- Cleanup: activity was taken offline and deleted after verification.
