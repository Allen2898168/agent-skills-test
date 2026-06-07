# Activity Task Management Assertions

Business domain:
活动通用模块管理 / 活动任务管理。

## Page Loaded

Success:
- Final URL path is `/activity/task`.
- Breadcrumb/page text includes `活动通用模块管理` and `活动任务管理`.
- Search form contains placeholders `任务编号`, `任务别名`, `任务标签`, `备注`, `开始时间`, `结束时间`, `总分>=转手动发奖`, `标签-转手动发奖`, and `报名国家-转手动发奖`.
- Table headers include `任务编号`, `任务别名`, `任务内容`, `发奖审核类别`, `总分-转手动发奖`, `标签-转手动发奖`, `报名国家-转手动发奖`, `任务标签`, `备注`, `更新时间`, and `最近编辑人`.

## Search Assertions

- Task ID exact search: every returned row has `任务编号` equal to the searched ID.
- Task alias fuzzy search: returned rows contain the search text in `任务别名`.
- Task label fuzzy search: returned rows contain the search text in `任务标签`.
- Remark fuzzy search: returned rows contain the search text in `备注`.
- Start time search: request includes `beginTime=<YYYY-MM-DD>` and `/prod-api/activity/task/list` returns HTTP 200.
- End time search: request includes `endTime=<YYYY-MM-DD>` and `/prod-api/activity/task/list` returns HTTP 200.
- Manual-award score search: request includes `dynamicAuditScore=<value>` and returned rows are filtered by `总分-转手动发奖`.
- Manual-award label search: selecting a label triggers `/prod-api/activity/task/list` with `dynamicAuditLabels[0]`; returned rows contain the selected label where data exists.
- Manual-award country search: selecting a country triggers `/prod-api/activity/task/list` with `dynamicAuditCountryIds[0]`; returned rows contain the selected country where data exists.

Optional screenshots:
- Search screenshot directory: `artifacts/screenshots/活动通用模块管理/活动任务管理/搜索功能/`.
- Roulette create screenshot directory: `artifacts/screenshots/活动通用模块管理/活动任务管理/新增转盘抽奖/`.

## Create Assertions

- Add dialog common branch:
  - Selecting `活动类型 = 转盘抽奖` exposes `任务组合`, `任务条件1`, `任务参与范围`, `任务风控`, `判定开始时间`, `任务次数更新`, `任务奖励模式`, `每日领奖人数上限`, and `总领奖人数上限`.
  - `任务备注` must be filled before submit.
  - `任务名称`、`任务内容` and `任务标签` multilingual values must be verified per form item when the flow requires English.
- Create roulette task: submitting the add dialog should return HTTP 200 from `POST /prod-api/activity/task`.
- Treat creation as successful only if the page shows `新增任务成功` and searching by the unique task alias returns a row.
- Single reward roulette task: returned row contains the generated task alias and was validated with created ID `4737`.
- Normal reward + rights reward roulette task: returned row contains the generated task alias and was validated with created ID `4738`.
- Limited reward different branch: exact-match the `奖励变化` form item, select one of `X`, `+`, or `归0`, and fill the reward-change value if required. Validated with created ID `4739`.
- Mixed reward branch: if the page displays `system busy, please retry later` or `保存任务失败`, treat the branch as failed even if `POST /prod-api/activity/task` returns HTTP 200.
- Single reward branch: after selecting a reward, fill both `输入最小数值` and `输入最大数值`; otherwise the page displays `请填写正常奖励数值`.
- When validating created single-reward condition tasks, search or inspect by task name. The generated `任务标签` is not the same as the list search field `任务别名`.
- `首次登录APP` single-reward branch should not use the default lottery-count reward; the backend returned `任务奖品只能选择合约抵扣金` when `抽奖次数` was used.
- `新老现货划转任务` can be blocked by a backend uniqueness rule. If `POST /prod-api/activity/task` returns `code=500` with `新老划转任务重复，已配置新老划转任务的编号是:<id>`, treat the form flow as reaching backend validation, not as a UI fill failure.
- If submit returns HTTP 200 but the page shows `保存任务失败` or `system busy, please retry later`, treat the create as failed and do not record the branch as validated.
