# Activity Task Roulette Participant Scope Operations

Business domain:
活动通用模块管理 / 活动任务管理 / 转盘抽奖。

Use this file for `转盘抽奖` task creation flows that vary `任务参与范围`.

## Participant Scope Field Discovery

Status: candidate
Last verified: 2026-05-05
Environment: staging

Purpose:
Discover `转盘抽奖` add-dialog `任务参与范围` options and the fields each option exposes.

Entry:
`https://stg-activity.weex.tech/activity/task`

Important behavior:
- `任务参与范围` behaves like a checkbox group. Multiple scopes can be selected together.
- To inspect or create a task with a single scope, reopen the add dialog for each scope or clear previously selected scopes first.

Options and extra fields:
- `报名的所有用户`: no extra field.
- `指定代理`: shows `指定代理` textarea. Value must be valid UID(s); `123456` failed validation, `9881271952` passed in staging.
- `指定用户`: shows `指定用户UID` textarea. Value must be valid UID(s); `123456` failed validation, `9881271952` passed in staging.
- `指定国家或地区`: shows `指定国家或地区` multi-select.
- `VIP 等级`: shows `VIP等级` start/end selects and `VIP白名单允许` radios: `同等级允许`, `全部允许`, `全部不允许`.
- `注册新用户`: shows `新用户` select.
- `未充值新用户`: no extra field.
- `老用户`: shows `老用户` select.

## Create Roulette Tasks By Participant Scope

Status: candidate
Last verified: 2026-05-05
Environment: staging

Purpose:
Create one `转盘抽奖 / 单一奖励` task per participant scope.

Cached action:
- Action ID: `create_roulette_participant_scope_tasks`
- Script: `scripts/create-roulette-participant-scope-tasks.mjs`
- Default mode: invisible browser automation.
- Visible mode: pass `--visible`.
- Verified modes:
  - Visible browser path: manually validated on 2026-05-05.
  - Invisible cached path: validated on 2026-05-05 by creating task IDs `4792` through `4799`.
- Dry-run example: `node scripts/run-cached-action.mjs --action create_roulette_participant_scope_tasks --scopes all,vip,newuser,nocharge,olduser,agent,user,country --uid 9881271952 --country 中国 --dry-run`

Request confirmation checklist before execution:
- Confirm the participant scopes to create.
- Confirm UID values for `指定代理` and `指定用户`.
- Confirm country/region values for `指定国家或地区`, or explicitly allow choosing the first available option.
- Confirm VIP start level, end level, and `VIP白名单允许` strategy, or explicitly allow choosing defaults.
- Confirm `新用户` and `老用户` dropdown choices, or explicitly allow choosing the first available option.
- Confirm reward and reward numeric range.
- Confirm visible or invisible browser mode.

Validated common defaults:
- Activity type: `转盘抽奖`.
- Task participant scope: exactly one selected scope per task.
- Task risk: `不审核KYC`.
- Task combo: `单一任务条件`.
- Task condition 1: `KOL绑定`.
- Judge start time: `报名活动后`.
- Task update count: `仅1次，直至结束`.
- Reward mode: `单一奖励`.
- Normal reward: first available lottery-count reward, validated with `495 - auto_test_prize_08_1777974000001`.
- Reward range: `输入最小数值=10`, `输入最大数值` left blank.
- Daily claim limit: `5`.
- Total claim limit: `50`.

Validated created records:
- `报名的所有用户`: task ID `4784`, alias `转盘抽奖_scope_all_20260505120514`.
- `VIP 等级`: task ID `4785`, alias `转盘抽奖_scope_vip_20260505120939`; selected start `VIP 0`, end `VIP 0`, whitelist `同等级允许`.
- `注册新用户`: task ID `4786`, alias `转盘抽奖_scope_newuser_20260505120939`; selected `活动期间注册用户`.
- `未充值新用户`: task ID `4787`, alias `转盘抽奖_scope_nocharge_20260505120939`.
- `老用户`: task ID `4788`, alias `转盘抽奖_scope_olduser_20260505120939`; selected `活动开始前注册用户`.
- `指定代理`: task ID `4789`, alias `转盘抽奖_scope_agent_retry_20260505121529`; UID `9881271952`.
- `指定用户`: task ID `4790`, alias `转盘抽奖_scope_user_retry_20260505121529`; UID `9881271952`.
- `指定国家或地区`: task ID `4791`, alias `转盘抽奖_scope_country_retry_20260505121529`; selected country/region `中国`.

Validated invisible cached records:
- `报名的所有用户`: task ID `4792`, alias `转盘抽奖_scope_all_20260505124634`.
- `VIP 等级`: task ID `4793`, alias `转盘抽奖_scope_vip_20260505124634`; selected start `VIP 0`, end `VIP 0`, whitelist `同等级允许`.
- `注册新用户`: task ID `4794`, alias `转盘抽奖_scope_newuser_20260505124634`; selected `活动期间注册用户`.
- `未充值新用户`: task ID `4795`, alias `转盘抽奖_scope_nocharge_20260505124634`.
- `老用户`: task ID `4796`, alias `转盘抽奖_scope_olduser_20260505124634`; selected `活动开始前注册用户`.
- `指定代理`: task ID `4797`, alias `转盘抽奖_scope_agent_20260505124634`; UID `9881271952`.
- `指定用户`: task ID `4798`, alias `转盘抽奖_scope_user_20260505124634`; UID `9881271952`.
- `指定国家或地区`: task ID `4799`, alias `转盘抽奖_scope_country_20260505124634`; selected country/region `中国`.

Validated component notes:
- `指定国家或地区` is a multi-select. Open the `.el-select` container inside the `指定国家或地区` form item, choose an option, then click blank space in the parent `.el-dialog` to close the dropdown.
- After selecting country/region, assert a visible `.el-tag` appears in that form item before continuing. This avoids submitting with an unbound country value.
- Avoid letting the open country dropdown intercept the later `正常奖励` selector.
- `任务名称`、`任务内容` and `任务标签` each have separate multilingual switches. Open and fill English by form item; do not assume one visible English input covers all three fields.
- In invisible mode, `任务组合` renders as a select with placeholder `请选择任务数`; select the first available option instead of clicking option text.
- `任务条件1` must select a non-KYC branch. Current cached path uses `KOL绑定`; do not use `kyc任务` because it hides old-user participation scenarios.
- `任务奖励模式` renders as radios; click `单一奖励`.
- `任务备注` is required for successful submit.

Validation failures:
- UID `123456` failed both `指定代理` and `指定用户` with `请填写正确的uid`.
- Initial country/region attempts that did not assert `.el-tag` failed with `请选择国加或地区`.

Success assertions:
- `POST /prod-api/activity/task` returns HTTP 200 with `code=200` and `msg=操作成功`.
- Searching by the generated task alias returns the created row and expected task ID.

Risk and cleanup:
- This is a staging write operation.
- Created records can likely be removed with row action `删除`, but cleanup was not performed in this flow.
