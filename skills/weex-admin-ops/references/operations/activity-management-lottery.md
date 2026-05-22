# Activity Management - Lottery Activity

Status: verified
Last verified: 2026-05-19
Verified mode: visible browser
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

Use conservative defaults only in staging:
- `配置类型`: `正式活动`
- `负责人`: `auto`
- `类别配置`: `通用`
- `流程引导配置`: first available `转盘抽奖` guide-flow template
- `是否为平台活动`: `否`
- `用户报名模板`: fixed `【2729】 自动化报名模板_auto_manual_20260505161031`
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
- Upload default image files for web/h5 header, web/h5 share images, social preview, and prize share images.
- Activity start time must be earlier than end time.
- `用户报名模版`当前固定选择 `2729`：`【2729】 自动化报名模板_auto_manual_20260505161031`。不要再用“第一个兼容模板”作为默认规则。

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

Do not treat a reachable draft URL as frontend display success.

For "10 minutes later" or other near-future lottery activities, compute the activity time in the backend/admin business timezone observed by staging (UTC+8), not the local desktop timezone. The server validates `活动开始时间` against that business clock; local CEST `now + 10 minutes` was rejected as `开始时间不可小于现在时间` on 2026-05-12.

If the tester asks to avoid pre-registration, set `是否支持预报名 = 不支持` and still keep the required `用户报名模版` value. Do not fill `预报名开始时间` / `预报名结束时间` in that branch.

## Row Actions

Visible-browser checks on 2026-05-07:
- Online activity `9023` (`strict-ui-lottery-20260507200430`) showed row actions `查看` / `修改` / `下线` / `复制`; no `删除` button was visible. This matches the rule that online activities cannot be deleted.
- `查看` opened `/activities/lottery/view?activityId=9023` and triggered `GET /prod-api/activity/config/9023` with business `code=200`.
- `修改` opened `/activities/lottery/edit?activityId=9023`; the original online activity was not saved during row-action validation.
- `复制` on both online `9023` and draft `9022` triggered `POST /prod-api/activity/config/copy`, but backend returned business `code=500`, `system busy, please retry later`; no copied row was created.
- The latest dev feedback attributes that failure to the source activity alias being too long, not to a newly generated copied alias.
- A temporary draft `9024` was created through the strict visible UI path to continue row-action checks. Its row actions included `查看` / `修改` / `上线` / `删除` / `复制`.
- `修改` on draft `9024` opened `/activities/lottery/edit?activityId=9024`; changing `活动副标题` and clicking the page `保存` button triggered `PUT /prod-api/activity/config` with business `code=200` and page message `编辑成功`.
- `删除` on draft `9024` opened a confirmation dialog `确认删除该活动吗`; the verification input auto-focused. Fill the fixed staging verification code, then click the bottom-right `确定`. The page triggered `POST /prod-api/activity/lottery/delete`, business `code=200`, and alias search returned `total=0`.
- `上线` follows the same confirmation pattern: click `上线`, fill the verification input in the confirmation dialog, then click `确定`. The verified endpoint is `POST /prod-api/activity/lottery/online`, business `code=200`.

Non-visible/headless checks on 2026-05-07:
- Temporary draft `9025` (`strict-ui-lottery-20260507212249`) was created in headless mode and used for row-action verification.
- `查看` opened `/activities/lottery/view?activityId=9025`; detail request returned business `code=200`.
- `修改` opened the edit page, changed `活动副标题`, clicked `保存`, triggered `PUT /prod-api/activity/config` with business `code=200`, and detail re-query matched the updated subtitle.
- `复制` again triggered `POST /prod-api/activity/config/copy` and returned business `code=500`, `system busy, please retry later`.
- `删除` filled the verification input in the confirmation dialog and clicked `确定`; `POST /prod-api/activity/lottery/delete` returned business `code=200`, and alias search returned `total=0`.

Headless real-UI checks on 2026-05-14:
- Activity `9107` (`jonathan-test-20260514051431`) was created through `create-lottery-activity-draft.mjs --headless-ui`.
- The stable path reused the real UI add page, completed prize rows, task rows, multilingual config, FAQ, calendar, and submit, then verified the draft by alias search `showUrl=jonathan-test-20260514051431`.
- The same activity was then put online from the list row action `上线`; the confirmation dialog required the verification input and triggered `POST /prod-api/activity/lottery/online` with business `code=200`.
- Detail re-query confirmed `status=ONLINE`, `stage=NOT_START`, `taskConfigIds=[4996,4997,4998]`, `taskConfig` count `3`, and `activityConfigI18n` count `2`.

## Known Failure Avoidance

- Load `skills/weex-admin-ops/.env.local` through `loadLocalEnv(process.cwd())` or a resolved skill root; relative `pathsFrom('./...')` can miss local login variables in inline scripts.
- Treat DOM nodes as nodes, not strings, when extracting labels or options.
- Do not fill all prize table inputs by index; the first column is the locked prize-pool ID.
- Do not fill the disabled `有效期（天）` prize column; current verified rows start editable data at `奖金金额(USDT)`.
- When selecting prize rows in the visible UI, do not assume a clicked dropdown option is already bound. Read back the row prize input value after selection and require all eight rows to be non-empty before submission.
- Activity task rows appear only after clicking the module-level `+`.
- Scope language checkboxes to the current `多语言` or `常见问题` container to avoid cross-module selection.
- `预报名模版` uses the character `模版` in the current page label. Looking first for `预报名模板` causes unnecessary timeout.
- Avoid clicking arbitrary blank page coordinates to close dropdowns; in the admin shell this can hit navigation and leave `/activities/lottery/add`.
- Edit pages use bottom button text `保存`, not `修改`; row-action scripts must click the real bottom `保存` button and require a `PUT /prod-api/activity/config` business `code=200`.
- For `删除` and `上线`, the confirmation dialog requires filling the verification input before clicking `确定`; opening the dialog or clicking confirm without the code is not sufficient.
- Do not mark lottery delete as passed unless `POST /prod-api/activity/lottery/delete` returns business `code=200` and alias search returns `total=0`.
- Direct API calls to `/prod-api/activity/lottery/online` with guessed fields such as `googleCode` or `code` returned `google验证码不得为空` on 2026-05-11. Until the real payload key is proven, use the UI confirmation dialog for online operations.
- When the user asks to create several frontend-display lottery activities, prefer create -> online -> frontend verify per activity. If batching is still used, refresh every activity's time immediately before online.
- For near-future activities, refresh time using the backend/admin business timezone before creation or before updating the draft. A start time that is future in the local machine timezone can still fail server validation.

## Cache

Action cache entry:
- `create_lottery_activity_draft`
- Script: `scripts/create-lottery-activity-draft.mjs`
- Current status: candidate.

Action cache entry:
- `online_lottery_activity`
- Script: `scripts/online-lottery-activity.mjs`
- Current status: candidate.

Use:

```bash
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "活动列表 转盘抽奖 新增草稿 浏览器模式" --dry-run
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "活动列表 转盘抽奖 新增草稿 浏览器模式"
node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_lottery_activity_draft --visible --style 彩蛋 --title-prefix 前端展示彩蛋 --alias-prefix frontend-draw-egg --start "2026-05-11 17:52:01" --end "2026-05-18 17:52:01"
node skills/weex-admin-ops/scripts/run-cached-action.mjs --action online_lottery_activity --activity-alias jonathan-test-20260514051431
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "上线活动别名 jonathan-test-20260514051431"
```

Actual writes support both `--visible` and `--headless-ui`, and both modes use the same strict real-UI workflow. The cache entry still creates a draft only; online and frontend-display verification remain separate steps.
