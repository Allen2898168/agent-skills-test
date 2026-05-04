# Activity Task Management Operations

Business domain:
活动通用模块管理 / 活动任务管理。

Use this file for detailed activity-task-management workflows.

## Open Activity Task Management

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Open `活动任务管理` from the left sidebar by using the exact menu order requested by testers.

Entry:
`https://stg-activity.weex.tech/activity/task`

Preconditions:
- Logged in to the staging admin.
- Sidebar menu is visible.

Steps:
1. If already on a child page under `活动通用模块管理`, navigate to `首页` or `/index` first so clicking the parent menu expands instead of collapses it.
2. Click the left sidebar parent menu `活动通用模块管理`.
3. Click the child menu `活动任务管理`.
4. Wait for `/activity/task` to load.

Success assertions:
- Final URL path is `/activity/task`.
- Breadcrumb/page text includes `活动通用模块管理 / 活动任务管理`.
- Search form contains placeholders documented in `../selectors/activity-task-management.md`.
- Table contains task-management headers documented in `../assertions/activity-task-management.md`.

Optional screenshot:
- Directory: `artifacts/screenshots/活动通用模块管理/活动任务管理/搜索功能/`.
- Suggested file name: `00-进入活动任务管理.png`.

## Activity Task Management Search

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Validate read-only search behavior on the activity task management page.

Entry:
`https://stg-activity.weex.tech/activity/task`

Preconditions:
- Logged in to the staging admin.
- Activity task management page is loaded.
- Test each condition independently; clear all other search fields before each search. Reloading `/activity/task` between cases is acceptable.

Fields and validated values:
- `任务编号`: `4720`.
- `任务别名`: `小丑牌-积分加成-邀请-3-5%`.
- `任务标签`: `小丑牌-积分加成-邀请-3-5%`.
- `备注`: `小丑牌-积分加成-邀请-3-5%`.
- `开始时间`: `2026-05-04 00:00:00`; request parameter observed as `beginTime=2026-05-04`.
- `结束时间`: `2026-05-04 23:59:59`; request parameter observed as `endTime=2026-05-04`.
- `总分>=转手动发奖`: `11`; request parameter observed as `dynamicAuditScore=11`.
- `标签-转手动发奖`: multi-select; first validated option was `同设备多账号登录`; request parameter observed as `dynamicAuditLabels[0]=同设备多账号登录`.
- `报名国家-转手动发奖`: multi-select; first validated option was `中国`; request parameter observed as `dynamicAuditCountryIds[0]=1`.

Steps:
1. Open `/activity/task`.
2. For each input or date field, fill only that field and click `搜索`.
3. For `标签-转手动发奖`, click the multi-select, select one option, then click a blank area outside the dropdown to collapse it. The page immediately calls the list API after selection.
4. For `报名国家-转手动发奖`, use the same multi-select handling. Default to the first available option unless the tester specifies a country.
5. Capture a screenshot after every independent filter case when the tester requests screenshots.
6. For the table, horizontal scrolling is available because there are many columns. Scroll the table to the right when validating columns after `报名国家-转手动发奖`.

Validated backend signals:
- Base list: `GET /prod-api/activity/task/list?pageNum=1&pageSize=10` returns HTTP 200.
- Risk label options: `GET /prod-api/activity/getRiskLabelList` returns HTTP 200.
- Country/area options: `GET /prod-api/activity/getAreaInfoList` returns HTTP 200.
- Agency group options: `GET /prod-api/activity/apply/selectAgencyGroupList` returns HTTP 200.
- Search requests to `/prod-api/activity/task/list?...` return HTTP 200 for every validated case.

Observed behavior:
- `标签-转手动发奖` is a multi-select filter and behaves like a union filter when multiple labels are selected.
- Multi-select dropdowns may have a tags input overlaying the placeholder input. Click the `.el-select` container or visible tags input, not only the readonly placeholder input.
- After selecting a multi-select option, click a blank page area to collapse the dropdown before continuing.
- `标签-转手动发奖` selection triggers the list API immediately without pressing `搜索`.

Optional screenshots:
- Directory: `artifacts/screenshots/活动通用模块管理/活动任务管理/搜索功能/`.
- Suggested file names:
  - `00-进入活动任务管理.png`
  - `01-任务编号搜索.png`
  - `02-任务别名搜索.png`
  - `03-任务标签搜索.png`
  - `04-备注搜索.png`
  - `05-开始时间搜索.png`
  - `06-结束时间搜索.png`
  - `07-总分转手动发奖搜索.png`
  - `08-标签转手动发奖多选.png`
  - `09-报名国家转手动发奖多选.png`
  - `10-列表右滑展示更多列.png`

## Create Roulette Task

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Create `转盘抽奖` activity tasks and validate the reward-mode branches.

Entry:
`https://stg-activity.weex.tech/activity/task`

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

## Roulette Task Condition Discovery

Status: candidate
Last verified: 2026-05-04
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
Last verified: 2026-05-04
Environment: staging

Purpose:
Create `转盘抽奖` tasks using reward mode `单一奖励` with different `任务条件1` task types.

Common defaults:
- Reward selector: choose an `抽奖次数` prize.
- Single reward requires both reward range inputs: set `输入最小数值=1` and `输入最大数值=1`.
- Task participant scope: `报名的所有用户`.
- Task risk: `不审核KYC`.
- Judge start time: `报名活动后`.
- Task update count: `仅1次，直至结束`.
- Daily claim limit: `5`.
- Total claim limit: `50`.

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

Known gaps:
- `首次登录APP`: using an `抽奖次数` prize returned `code=500`, message `任务奖品只能选择合约抵扣金`. Retry this branch with a contract-deduction prize instead of the default lottery-count prize.
- `新老现货划转任务`: exact task-type selection still left `任务条件1` with `请填写完整任务条件`; treat it as pending investigation.

Success assertions:
- `POST /prod-api/activity/task` returns HTTP 200 with `code=200` and `msg=操作成功`.
- The created task appears at the top of the activity task list or can be verified by visible table row text.
- Do not verify by searching the generated `任务标签`; the list search field `任务别名` corresponds to the task name.
