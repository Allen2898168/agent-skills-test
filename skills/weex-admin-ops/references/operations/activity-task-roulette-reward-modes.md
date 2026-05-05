# Activity Task Roulette Reward Mode Operations

Business domain:
活动通用模块管理 / 活动任务管理 / 转盘抽奖。

Use this file for reward-mode branches in the `转盘抽奖` activity-task create workflow.

## Create Roulette Task

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Create `转盘抽奖` activity tasks and validate the reward-mode branches.

Entry:
`https://stg-activity.weex.tech/activity/task`

Request confirmation checklist before execution:
- Confirm the task type or reward-mode branch to create.
- Confirm whether the user wants default values or explicit values for each configurable field.
- For this chain, explicitly list at least:
  - `任务条件1` task type
  - reward mode
  - reward prize or prize type
  - reward range fields when shown
  - participant scope
  - risk control
  - visible or invisible browser mode
- If a requested combination conflicts with page behavior or known backend rules, explain the conflict first and wait for updated inputs.

Common defaults:
- Activity type: `转盘抽奖`.
- Enable multilingual settings for `任务名称`, `任务内容`, and `任务标签`; fill the default value and English value.
- Task participant scope: select one visible option. Validated successful creates used `报名的所有用户` because other participant scopes may expose extra required fields.
- Task risk control: choose one visible option. Although displayed as checkboxes, `转盘抽奖` behaves like single choice; selecting one can hide the other. Validated with `不审核KYC`.
- Task combo: only `单一任务条件` is available for `转盘抽奖`.
- Task condition 1: selecting the first task type `kyc任务` changes the condition section to `KYC限制`; choose `无kyc限制`.
- Judge start time: choose `报名活动后`.
- Task update count: choose `仅1次，直至结束`.
- Daily claim limit: `5`.
- Total claim limit: `50`.

Reward-mode branches:
- `单一奖励`:
  - Reward selector is scoped to lottery-count prizes.
  - If the user does not specify reward range values, the current suggested defaults are `输入最小数值=10` and leaving `输入最大数值` blank.
  - These defaults must be shown to the user and confirmed before execution.
  - Validated by selecting a prize containing `抽奖次数`.
  - Created task ID `4737`, name `转盘抽奖_single_1777916448621`.
- `限时奖励不同`:
  - Reward selector can load all prize types from `/prod-api/activity/prize/all`.
  - `奖励变化` is a real dropdown with options `X`, `+`, and `归0`.
  - Do not locate this field by fuzzy text alone because `奖励变化倒计时` also contains `奖励变化`.
  - Validated by selecting `+` and filling reward-change value `1`.
  - Created task ID `4739`, name `转盘抽奖_limited_1777917234014`.
- `正常奖励+权益奖励`:
  - Normal reward selector is scoped to lottery-count prizes; validated by selecting `抽奖次数`.
  - Rights reward type path: `虚拟积分或资格` -> `VIP` -> first available VIP reward.
  - Created task ID `4738`, name `转盘抽奖_rights_1777916626416`.
- `混合奖励`:
  - Shows two `正常奖励` sections.
  - Filled first with the first available all-prize option and second with `抽奖次数`.
  - Submit request returned HTTP 200 but page displayed `system busy, please retry later` and `保存任务失败`; follow-up search did not find `转盘抽奖_mix_1777916693695`.
  - Status: blocked pending development fix. Do not keep retrying this branch until the backend/page issue is fixed; rerun the branch after development confirms the fix.

Validated backend signals:
- `GET /prod-api/activity/prize/all?prizeSubType=LOTTERY_COUNT` returns HTTP 200 for lottery-count reward selectors.
- `GET /prod-api/activity/prize/all` returns HTTP 200 for all-prize reward selectors.
- `POST /prod-api/activity/prize/getListByPrizeType` returns HTTP 200 for VIP rights reward lookup.
- Successful creates return HTTP 200 from `POST /prod-api/activity/task` and show `新增任务成功`.
- Always verify creation by searching `任务别名`; do not treat HTTP 200 alone as success.

Optional screenshots:
- Directory: `artifacts/screenshots/活动通用模块管理/活动任务管理/新增转盘抽奖/`.
- Suggested file names:
  - `00-新增弹窗初始.png`
  - `01-选择转盘抽奖后表单.png`
  - `02-任务组合后字段.png`
  - `奖励模式-单一奖励.png`
  - `奖励模式-限时奖励不同.png`
  - `奖励模式-正常奖励权益奖励.png`
  - `奖励模式-混合奖励.png`
  - `03-单一奖励-提交前.png`
  - `04-单一奖励-创建后搜索.png`
  - `05-限时奖励不同-重试提交前.png`
  - `06-限时奖励不同-重试创建后搜索.png`
  - `07-正常奖励权益奖励-提交前.png`
  - `08-正常奖励权益奖励-创建后搜索.png`
  - `09-混合奖励-提交前.png`
  - `10-混合奖励-创建后搜索.png`

Risk and cleanup:
- This is a staging write operation.
- Created records can likely be removed with row action `删除`, but cleanup was not performed in this flow.
