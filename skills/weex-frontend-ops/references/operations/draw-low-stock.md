# Frontend Draw Low-Stock Flow

## Low-Stock Five-Draw Regression

Status: candidate
Last verified: 2026-05-30
Environment: staging `https://stg-www.weex.tech`
Viewport: default desktop `1440x1000`

Use when validating a lottery activity configured from the small-stock template.

### Script

- Full orchestration selection: `小库存专项`
- Regression phases: `frontend_low_stock_five_draw` -> `frontend_low_stock_single_draw`
- Browser phase: `scripts/lottery-frontend-main-flow.mjs --phase five_draw`
- Covered case IDs: `FE-23`, `FE-45`, `FE-46`, `FE-57`, `FE-85`

### Preconditions

- Small-stock activity is online and in progress.
- Stock activity preparation must make the scenario deterministic: one prize keeps weight `100`; the other seven prizes use weight `0`. Each prize inventory remains `1`.
- Account is signed up.
- Draw count is greater than or equal to `5`; the standard regression chain prepares count through MQ recharge callback.

### Success Assertions

- `FE-23`: run five-draw under low-stock state; assert response `51031 / 当日奖品所剩不多，请尝试单次抽奖。` and draw count unchanged, for example `110 -> 110`.
- `FE-45`: five-draw request is sent and blocked by stock rules.
- `FE-46`: five-draw failure does not consume draw count.
- `FE-57`: inventory/stock shortage prompt is visible or exposed through the draw response.
- `FE-85`: after the five-draw shortage check and before any successful draw, run two single draws. The first single draw succeeds and consumes one chance; the second single draw returns a stock shortage / sold-out prompt such as `51020 / 今日奖品已被抽完，请明天再来！` and does not consume a chance.

### Notes

- The stock scenario must run against the `stock` activity partition, not the normal activity.
- `FE-45` and `FE-46` are not part of the normal five-draw success chain.
- `FE-23/45/46/57` run before `FE-85`; those cases must not consume stock or draw count.
- `FE-85` must run before any successful draw in the stock activity, otherwise the “first draw succeeds” assertion is no longer valid.
- Do not use an evenly weighted low-stock template for `FE-85`; with 8 prizes at weight `12.5`, the second single draw can still hit another prize with inventory.

### Last Real Run

- Activity: `9715 / s08786837`, cleaned after verification.
- Result: `FE-81/FE-82/FE-84/FE-23/FE-45/FE-46/FE-57/FE-85` all PASS.
- Five-draw evidence: `51031 / 当日奖品所剩不多，请尝试单次抽奖。`, count `110 -> 110`.
- Single-draw evidence: first draw `00000 / success`, count `110 -> 109`; second draw `51020 / 今日奖品已被抽完，请明天再来！`, count `109 -> 109`.
