# Activity Task Roulette Condition Operations

Business domain:
活动通用模块管理 / 活动任务管理 / 转盘抽奖。

Use this file for task-condition discovery and single-reward task creation by condition.

## Roulette Task Condition Discovery

Status: candidate
Last verified: 2026-05-22
Environment: staging

Purpose:
Discover `转盘抽奖` task condition options and the extra fields shown by each task type before creating more single-reward tasks.

Entry:
`https://stg-activity.weex.tech/activity/task`

Task type options:
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

Observed extra fields:
- `kyc任务`: `KYC限制` radio, options `有kyc限制` and `无kyc限制`.
- `注册任务`: `任务要求` checkbox group, options include `绑定邮箱` and `绑定手机号`.
- `划转任务`: task condition compare selector and numeric value; extra fields `资金沉淀天数`, `净转入>=`, `合约累计交易量>=(USDT)`.
- `充值任务`: task condition compare selector and numeric value; extra fields `是否首次充值` and `资金沉淀天数`.
- `邀请任务`: task condition compare selector and numeric value; extra fields `被邀请人累计交易量`, `被邀请人净充值`, `被邀请人是否需要KYC`, `被邀请人奖励`, `是否双向奖励`.
- `合约交易量`: task condition compare selector and numeric value; extra fields `合约币对选择` and `交易量统计方式`.
- `现货交易量`: task condition compare selector and numeric value; extra fields `现货币对选择`, `交易量统计方式`, `是否首次交易`.
- `现货持仓`: task condition compare selector and numeric value; extra fields `现货选择` and `资金沉淀天数`.
- `收益额`: task condition compare selector and numeric value; extra field `最少交易笔数`.
- `KOL绑定`: no extra fields beyond selecting the task type.
- `分享链接`: `分享链接配置`, `配图上传`, `任务标题`, `任务内容介绍`, `任务按钮文案`, `跳转链接(Web)`, `跳转链接(APP)`.
- `合约&现货交易量`: task condition compare selector and numeric value; extra fields `交易量统计方式` and `是否首次交易`.
- `新老现货划转任务`: task condition compare selector and numeric value.
- `首次登录APP`: no extra fields beyond selecting the task type.

## Create Roulette Single-Reward Tasks By Condition

Status: candidate
Last verified: 2026-05-22
Environment: staging

Purpose:
Create `转盘抽奖` tasks using reward mode `单一奖励` with different `任务条件1` task types.

Request confirmation checklist before execution:
- `任务条件1` task type
- condition-specific extra fields exposed by that task type
- reward prize to use
- whether reward range should use defaults or explicit values
- participant scope
- risk control
- visible or invisible browser mode
- If the user only says `按默认配置`, first present the confirmed defaults below and ask for approval.

Common defaults:
- Reward selector: choose an `抽奖次数` prize.
- Single reward reward-range defaults: set `输入最小数值=10`; leave `输入最大数值` blank unless the user explicitly asks to set it.
- Task participant scope: `报名的所有用户`.
- Task risk: `不审核KYC`.
- Judge start time: `报名活动后`.
- Task update count: `仅1次，直至结束`.
- Daily claim limit: `5`.
- Total claim limit: `50`.
- Do not use `kyc任务` as the default branch for `转盘抽奖`.
- Reason: `kyc任务` hides old-user scenarios and is therefore prohibited for general lottery-task configuration.

Validated created records:
- `kyc任务`: task ID `4740`, name `转盘抽奖_kyc任务_20260504203222`.
- `注册任务`: task ID `4741`, name `转盘抽奖_注册任务_20260504203222`.
- `KOL绑定`: task ID `4742`, name `转盘抽奖_KOL绑定_20260504203222`.
- `划转任务`: task ID `4743`, name `转盘抽奖_划转任务_20260504203222`.
- `充值任务`: task ID `4744`, name `转盘抽奖_充值任务_20260504203222`.
- `收益额`: task ID `4745`, name `转盘抽奖_收益额_20260504203222`.
- `合约&现货交易量`: task ID `4746`, name `转盘抽奖_合约&现货交易量_20260504203222`.
- Probe rerun for `kyc任务`: task ID `4747`, name `roulette_kyc_probe_20260504203739`.
- `合约交易量`: task ID `4748`, name `转盘抽奖_合约交易量_retry_20260504204324`.
- `现货交易量`: task ID `4749`, name `转盘抽奖_现货交易量_retry_20260504204324`.
- `现货持仓`: task ID `4750`, name `转盘抽奖_现货持仓_retry_20260504204324`.
- `分享链接`: task ID `4751`, name `转盘抽奖_分享链接_retry_20260504204324`.
- `邀请任务`: task ID `4752`, name `转盘抽奖_邀请任务_retry3_20260504204857`.
- `KOL绑定`: task ID `5249`, name `转盘抽奖_kol_20260522055340`.
- `合约交易量`: task ID `5250`, name `转盘抽奖_contract_20260522055340`.
- `现货交易量`: task ID `5251`, name `转盘抽奖_spot_20260522055340`.
- `充值任务`: task ID `5252`, name `转盘抽奖_recharge_20260522055340`.

Stable create rule for `现货交易量`:
- Current staging behavior can render the required form item `交易量统计方式` with no visible checkbox options in create mode, while the edit dialog for a known-good task shows `有手续费订单` and `无手续费订单`.
- Root cause confirmed on 2026-05-22:
  - create mode leaves `model.volumeCountType` undefined
  - edit mode contains `model.volumeCountType = ["FEE"]`
  - edit mode also contains `model.requirement[0].volumeCountType = ["FEE"]`
- Stable automation path:
  - first follow the normal create chain: select `现货交易量`, set compare type, fill numeric value, choose `全部币对`, choose `是否首次交易`
  - if `有手续费订单` is rendered, click it directly
  - if the checkbox group is empty, bind the form model fallback:
    - `model.volumeCountType = ["FEE"]`
    - `model.requirement[0].volumeCountType = ["FEE"]` when `requirement[0]` exists
  - then continue with `判定开始时间`、`任务次数更新`、`单一奖励` and submit
- Validation evidence:
  - direct probe with the model-binding fallback created task ID `5248`, name `转盘抽奖_spot_probe_1779429166099`
  - production automation using the same fallback created task ID `5251`, name `转盘抽奖_spot_20260522055340`
- Operational rule:
  - treat this model binding as the current stable fallback for `现货交易量`
  - if the page later renders `有手续费订单` normally in create mode, prefer the visible checkbox path first and keep the model binding only as fallback

Known gaps:
- `kyc任务`: keep as historical discovery evidence only. Do not continue using it for current `转盘抽奖` default or automated configuration.
- `首次登录APP`: using an `抽奖次数` prize returned `code=500`, message `任务奖品只能选择合约抵扣金`. Retry this branch with a contract-deduction prize instead of the default lottery-count prize.
- `新老现货划转任务`: field handling was resolved on 2026-05-05. For this task type, `判定开始时间` only shows `活动开始时间`; do not try to select `报名活动后`. Submit reached the backend but returned `code=500`, message `新老划转任务重复，已配置新老划转任务的编号是:964`. Treat creation as blocked by a business uniqueness rule unless the existing task can be reused, modified, or removed.

Reasonableness checks before submit:
- Do not keep the default `抽奖次数` prize when the selected task type is known to require another reward type, such as `首次登录APP`.
- If page validation or backend rules reject the user's requested combination, stop and explain the constraint instead of repeatedly retrying the same invalid combination.
- If min/max fields are visible, confirm whether the user accepts the default `最小数值=10` and `最大数值留空` or wants explicit values.

Success assertions:
- `POST /prod-api/activity/task` returns HTTP 200 with `code=200` and `msg=操作成功`.
- The created task appears at the top of the activity task list or can be verified by visible table row text.
- Do not verify by searching the generated `任务标签`; the list search field `任务别名` corresponds to the task name.
