# Activity Task Management Selectors

Business domain:
活动通用模块管理 / 活动任务管理。

## Navigation

- Sidebar parent menu text: `活动通用模块管理`
- Sidebar child menu text: `活动任务管理`
- Direct path: `/activity/task`

## Search Form

- Task ID input placeholder: `任务编号`
- Task alias input placeholder: `任务别名`
- Task label input placeholder: `任务标签`
- Remark input placeholder: `备注`
- Start time input placeholder: `开始时间`
- End time input placeholder: `结束时间`
- Manual-award score input placeholder: `总分>=转手动发奖`
- Manual-award label multi-select placeholder: `标签-转手动发奖`
- Manual-award country multi-select placeholder: `报名国家-转手动发奖`
- Search button text: `搜索`
- Create button text: `新增`
- Export button text: `导出`
- Batch button text: `批量新增/配置动态发奖风控`

## Multi-Select Behavior

- `标签-转手动发奖` is a multi-select filter.
- `报名国家-转手动发奖` is a multi-select filter.
- Multi-select components include a visible tags input and a readonly placeholder input; the tags input can intercept pointer events.
- To open reliably, click the `.el-select` container scoped to the placeholder.
- After selecting an option, click a blank page area to collapse the dropdown.

## Table Headers

- `任务编号`
- `任务别名`
- `任务内容`
- `平台用户参与范围`
- `发奖审核类别`
- `总分-转手动发奖`
- `标签-转手动发奖`
- `报名国家-转手动发奖`
- `邀请码-转手动发奖`
- `合伙人分组-转手动发奖`
- `任务标签`
- `备注`
- `更新时间`
- `最近编辑人`

## Row Actions

- `查看`
- `修改`
- `复制`
- `删除`
- `历史`

## Add Dialog

- Create button text: `新增`
- Activity type select label: `活动类型`
- Roulette activity option: `转盘抽奖`
- Task remark label: `任务备注`
- Multilingual fields: `任务名称`, `任务内容`, `任务标签`
- Multilingual switch text: `多语言`
- English multilingual input placeholder: `英语`
- Participant scope label: `任务参与范围`
- Participant scope options: `报名的所有用户`, `指定代理`, `指定用户`, `指定国家或地区`, `VIP 等级`, `注册新用户`, `未充值新用户`, `老用户`
- Participant scope extra fields:
  - `指定代理`: `指定代理` textarea.
  - `指定用户`: `指定用户UID` textarea.
  - `指定国家或地区`: `指定国家或地区` multi-select, placeholder `请选择（多选）`.
  - `VIP 等级`: `VIP等级` start/end selects with placeholders `起始等级` and `结束等级`; `VIP白名单允许` radios.
  - `注册新用户`: `新用户` select.
  - `老用户`: `老用户` select.
- Risk control label: `任务风控`
- Task combo label: `任务组合`
- Task condition label: `任务条件1`
- KYC condition label after selecting `kyc任务`: `KYC限制`
- Judge start time label: `判定开始时间`
- Task update count label: `任务次数更新`
- Task update default visible option in validated roulette flow: `仅1次，直至结束`
- Reward mode label: `任务奖励模式`
- Reward modes: `单一奖励`, `限时奖励不同`, `正常奖励+权益奖励`, `混合奖励`
- Single reward label: `正常奖励`
- Single reward range inputs inside `正常奖励`: `输入最小数值`, `输入最大数值`
- Limited reward labels: `限时奖励`, `限时开始时间`, `奖励变化倒计时`, `奖励变化`
- Limited reward change options: `X`, `+`, `归0`
- Selector caveat: exact-match `奖励变化`; fuzzy matching can hit `奖励变化倒计时`.
- Rights reward label: `权益奖励类型`
- Claim limit labels: `每日领奖人数上限`, `总领奖人数上限`

## Add Dialog Behavior Notes

- `任务名称`、`任务内容` and `任务标签` each expose their own multilingual control.
- `任务备注` is required in the validated create flows.
- `任务风控` and `KYC限制` may render as radios or radio-like options depending on mode; use the actually visible control.
- In invisible mode, `任务组合` can render as a select whose placeholder is `请选择任务数`; selecting the first visible option is more reliable than matching rendered text only.

## Task Condition Options

- Task condition task-type placeholder: `请选择任务类型`
- Task condition compare placeholder: `请选择比较类型`
- Task condition numeric placeholder: `请输入数值`
- Task condition options for `转盘抽奖 / 单一任务条件`:
  - `kyc任务`
  - `注册任务`
  - `划转任务`
  - `充值任务`
  - `邀请任务`
  - `合约交易量`
  - `现货交易量`
  - `现货持仓`
  - `收益额`
  - `KOL绑定`
  - `分享链接`
  - `合约&现货交易量`
  - `新老现货划转任务`
  - `首次登录APP`
