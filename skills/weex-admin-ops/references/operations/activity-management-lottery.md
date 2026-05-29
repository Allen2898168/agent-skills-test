# Activity Management - Lottery Activity

Status: verified
Last verified: 2026-05-25
Verified mode: headless real UI + list online confirm
Environment: staging `https://stg-activity.weex.tech`

## Entry

- Parent menu: `活动列表`
- Child menu: `转盘抽奖`
- List path: `/activities/lottery`
- Add path: `/activities/lottery/add`

Before clicking the child menu, check whether parent menu `活动列表` is already expanded. Expand it only when collapsed, then click `转盘抽奖`.

## Search Verification

The list search form supports:
- `活动id`
- `活动标题`
- `活动别名`
- `活动类型`
- `活动日期`

Verified behavior:
- Each field triggers `/prod-api/activity/config/list`.
- Searching by exact alias and `type=LOTTERY` returned `total=1` for the created draft.
- Search by activity ID, title, alias, type, and date all filtered the list successfully during the visible-browser run.

## Draft Creation Path

The latest cache-backed strict UI run created draft activity `9223` with title `回归转盘05` and historical alias `autotest-20260519103256-stock`.
That alias is retained here only as historical verification evidence. For all future non-boundary runs, keep `活动别名配置` within `10` characters.

Latest fully verified stable path on 2026-05-25:
- Draft create succeeded for activity `9430`, alias `lf24162505`.
- The page submitted `POST /prod-api/activity/config` with business `code=200`, `msg=操作成功`.
- The same activity was then put online from the list row action `上线`.
- The confirm dialog accepted verification code `888888`.
- `POST /prod-api/activity/lottery/online` returned business `code=200`, `msg=操作成功`.
- Detail re-query showed `status=ONLINE`, `stage=NOT_START`.

Stable create rule set:
- Use `Playwright + 独立浏览器` via the strict real-UI workflow.
- Fill all backend sections first.
- Fill `活动开始时间` and `活动结束时间` last, immediately before submit.
- Default activity start time is computed at fill time as `UTC+8 当前时间 + 2 分钟`.
- Default activity end time is computed at fill time as `UTC+8 当前时间 + 365 天`.
- The date inputs must be bound with explicit `input/change/blur/Tab`; visual text alone is not enough.
- Click the page bottom-most visible `新增` button. Prefer DOM `click()` on that exact button, then fall back to mouse click only if needed.
- After draft save succeeds, return to the list immediately and perform `上线`; do not leave the draft idle when the start time is near-future.

Use conservative defaults only in staging:
- `配置类型`: `正式活动`
- `负责人`: `auto`
- `类别配置`: `通用`
- `流程引导配置`: first available `转盘抽奖` guide-flow template
- `是否为平台活动`: `否`
- `用户报名模板`: fixed `【2442】 全平台-无任何限制`
- `是否支持预报名`: `支持`
- `预报名模版`: first compatible registration template
- `预报名开始时间`: `2026-06-01 00:00:00`
- `预报名结束时间`: `2026-06-09 23:59:59`
- `是否显示活动日历入口`: `是`
- `活动日历`: `同步`
- `抽奖样式配置`: `圆形转盘`

Fill required text and rich fields:
- `活动标题`, `活动副标题`, `分享活动文案`, `代理分享文案`, `活动规则`, and `活动别名配置`.
- Hard rule: `活动标题` and `活动副标题` must each be no longer than 15 characters. Use exact short values for user-facing title fields; do not append timestamps to these fields.
- Hard rule: `活动别名配置` must use only lowercase letters, digits, and `-`, and should stay within `10` characters by default. Only exceed `10` when the tester is explicitly doing alias boundary-value validation.
- If the tester says names, titles, subtitles, or aliases must not exceed 15 characters, use exact-value parameters such as `LOTTERY_TITLE_EXACT`, `LOTTERY_SUBTITLE`, and `LOTTERY_ALIAS_EXACT`; do not use timestamp-suffixed prefixes.
- Upload default image files for web/h5 header, web/h5 share images, social preview, and prize share images.
- Activity start time must be earlier than end time.
- `用户报名模版`当前固定选择 `2442`：`【2442】 全平台-无任何限制`。不要再用“第一个兼容模板”或旧模板 `2729` 作为默认规则。

## Regression Templates

Authoritative regression template definitions for lottery automation are maintained in `references/operations/activity-management-lottery-templates.md`.
Use that file for `普通回归活动模板` / `二次权重专项活动模板` / `小库存专项活动模板`, plus verified activity IDs, alias conventions, and template-specific runtime rules.

## Lottery Styles

The `抽奖样式` config currently has five verified labels:

- `圆形转盘`
- `飞镖转盘`
- `彩蛋`
- `环形跑马灯`
- `足球射门`

The frontend style values observed from the STG frontend bundle are `CIRCLE`, `DART`, `EASTER_EGG`, `CIRCULAR_RECORD`, and `WORLD_CUP_KICK_BALL`.

`彩蛋` adds an extra required prize-table dropdown `彩蛋类型`. Fill it for every prize row, for example cycling through `金蛋` / `银蛋` / `铜蛋`. If this field is left empty, `prizeConfigForm.submit()` returns `false` and the create request is not sent.

## Lottery Prize Configuration

The prize table has eight rows. Keep `奖品池ID` as `1-8`; do not use a generic input loop that overwrites this column.

For each row:
- Select one prize from the row `奖品名称` dropdown.
- Current page behavior: the dropdown option text is driven by `奖品别名`, not the Chinese `奖品名称`. When scripting or matching a target option, use the prize alias text such as `auto_bonus_100_20260514`, not the display name `自动化测试赠金100`.
- Fill `奖金金额(USDT)` with `1`.
- Fill `总库存数量` with `100`.
- Fill `权重(%)` with `12.5`, so eight rows sum to `100`.
- Upload the row image.
- Select `奖品标记`; the fixed options are `大奖`, `中奖`, and `小奖`.
- Do not fill `有效期（天）`; it is disabled for the current `通用模块奖品` rows.
- Use the row input placeholder `请选择奖品标记` when locating the mark dropdown. Do not rely on the last `.el-select` in a horizontally scrolled row.

## Weight And Sign Sections

`抽奖权重配置`:
- The right-side `未配置` button opens the configuration page.
- The latest weighted draft added one `VIP` identity row.
- If an incomplete row exists, `隐藏（暂存）` shows validation errors; delete incomplete rows before returning.
- The cached strict UI path does not open this page when no row is being configured, because it adds no business value and can introduce unnecessary validation pauses.
- Verified minimal VIP row path:
  - Click `未配置`.
  - Select checkbox `VIP`.
  - Click `添加`.
  - In the generated row, select both `VIP等级` dropdowns using the first available option.
  - Fill the row's eight `权重(%)` inputs so the total is `100`; verified values were `[5,8,10,12,13,15,17,20]`.
  - Click `隐藏(暂存)` to return to the add page.
  - Details field `prizeWeightConfig` should contain one row with `vipLevelMin=0`, `vipLevelMax=0`, and `prizeWeightList` for award prize IDs `1-8`.

`颜色签配置`:
- Red sign and white sign are separate tables.
- Each side requires weights summing to `100`.
- Use integer or one-decimal values; the verified run used `12.5` across eight rows on each side.

## Share, Limit, Task, And I18n Sections

`配置分享信息`:
- Configure tabs `奖品(1)` through `奖品(8)`.
- Upload the corresponding prize image and fill multilingual `分享文案` and `奖品名称`.

`奖品每日限制配置`:
- Initial row requires `奖励开始后+N（天数）`, `奖品ID`, and `每日最大发送数量`.
- The `+` button adds another row; the verified draft kept one row.

`累计次数再权重配置`:
- Fill `累计抽奖次数`, then click `添加`.
- Eight prize rows appear; set weights so the total is `100`.
- `用户uid` is row-linked. Changing one row changes the others between `同用户` and `全平台`.
- The table columns are `累计抽奖次数N` / `奖品ID` / `权重` / `用户UID`; fill the third column's input, not the row's last input.

`活动任务信息`:
- Select one existing `转盘抽奖` task.
- Click the module `+` button to create a config row.
- Fill `排序系数`; higher values sort earlier. The verified run used `1`.
- The switch adds `新手活动合约任务` as another row; only `排序系数` is required there.
- If the user explicitly asks for `转盘抽奖任务中的合约交易任务`, do not use the `新手活动合约任务` switch as a substitute. Use the activity task dropdown backed by `GET /prod-api/activity/task/all?activityType=5`, select a `TRADING_VOLUME` task such as `4873-自动化测试-转盘-合约100-奖次1000-20260507`, click the card-level `+`, and verify the task row appears before filling `排序系数=1`.
- In edit mode, changing only the visible date input may not update the Vue form model. Before saving a near-future time update, verify the component model `baseForm.form.startTime/endTime` matches the visible inputs; otherwise the save request can return `code=200` while still submitting old times.

`多语言`:
- Select display language first. The validated run selected English.
- Fill the selected language tab's title, subtitle, images, share copy, agent share copy, and rules.

`常见问题`:
- Select FAQ display language in the FAQ module, not the multilingual activity module.
- Each selected language creates its own component. The language component `+` button adds a question; each question has `标题`, `内容`, and a delete button.

## Calendar Sync Branch

Default page value is `不同步`. The latest strict UI run selected `同步` and filled:
- `所属一级筛选标签`: first option is acceptable for current staging validation.
- `所属二级筛选标签`: first option is acceptable for current staging validation.
- 配图 and 小图标, with optional multilingual buttons for per-language images.
- `所属分区`: first option is acceptable for current staging validation.
- Operation area contains an `新增` button.

The latest strict UI draft saved this sync branch.

## Success Assertions

Accept creation only when at least one durable assertion passes:
- `POST /prod-api/activity/config` returns HTTP 200 and business `code=200`.
- Search `/prod-api/activity/config/list` by alias and `type=LOTTERY` returns `total=1`.
- The created row is visible in the list and remains `DRAFT`.

For frontend display validation, draft creation is not enough. The activity must be online before opening `https://stg-www.weex.tech/zh-CN/events/draw/<alias>`.
For lottery frontend signup-state validation, use `references/operations/activity-management-lottery-frontend.md`.

Recommended sequence for multiple frontend-display activities:

1. Compute each activity's start/end time immediately before creation. Do not reuse one start time across a long batch when the activity will also be put online.
2. Create one activity.
3. If the created start time is already in the past, update it with `PUT /prod-api/activity/config` before going online.
4. Use the list row action `上线`, fill the confirmation verification input, and require `POST /prod-api/activity/lottery/online` business `code=200`.
5. Re-query the row and require status `ONLINE`. For a future start time, `stage=NOT_START` is acceptable.
6. Only then open the frontend draw URL with an authenticated frontend account.

Recommended sequence for the stable create-and-online path:

1. Open `活动列表 / 转盘抽奖 / 新增`.
2. Fill all non-time backend sections first: base text, images, prize rows, color signs, share info, tasks, i18n, FAQ, calendar.
3. Only at the end, fill `活动开始时间` and `活动结束时间`.
4. Use the default near-future rule unless the tester gave exact times:
   - `活动开始时间 = UTC+8 当前时间 + 2 分钟`
   - `活动结束时间 = UTC+8 当前时间 + 365 天`
5. Trigger the page bottom `新增` button and require `POST /prod-api/activity/config` business `code=200`.
6. Return to the lottery list immediately.
7. Find the new row by alias, click `上线`, fill verification code `888888`, click `确定`.
8. Require `POST /prod-api/activity/lottery/online` business `code=200`.
9. Re-query the row and require `status=ONLINE`. For a just-created future-start activity, `stage=NOT_START` is the expected result.

Do not treat a reachable draft URL as frontend display success.

For "10 minutes later" or other near-future lottery activities, compute the activity time in the backend/admin business timezone observed by staging (UTC+8), not the local desktop timezone. The server validates `活动开始时间` against that business clock; local CEST `now + 10 minutes` was rejected as `开始时间不可小于现在时间` on 2026-05-12.

If the tester asks to avoid pre-registration, set `是否支持预报名 = 不支持` and still keep the required `用户报名模版` value. Do not fill `预报名开始时间` / `预报名结束时间` in that branch.

## Row Actions, Failure Avoidance, And Cache

Detailed row-action evidence, failure-avoidance rules, and cache command examples are maintained in `activity-management-lottery-row-actions.md`.
