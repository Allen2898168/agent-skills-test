# Activity Task Create Common Operations

Business domain:
活动通用模块管理 / 活动任务管理。

Use this file for validated common behavior in the activity-task add dialog.

Keep reward-mode, condition-type, and participant-scope specifics in their dedicated files.

## Activity Task Add Dialog Common Flow

Status: candidate
Last verified: 2026-05-05
Environment: staging

Purpose:
- Capture the shared add-dialog rules that apply before branching into reward modes, task conditions, and participant scopes.

Entry:
`https://stg-activity.weex.tech/activity/task`

Supported validated branch:
- `活动类型 = 转盘抽奖`

Request confirmation checklist before execution:
- Target activity type.
- Whether to use defaults or explicit values for each configurable field.
- Reward mode and reward prize type.
- Task condition type and any condition-specific extra fields.
- Participant scope and any scope-specific extra fields.
- Whether multilingual fields should be filled, and which languages should be written.
- Visible or invisible browser mode.

If the user only says `用默认配置` or equivalent:
- First list the proven configurable items for the current branch.
- Show which items have validated defaults.
- Ask the user which defaults to keep and which items to override before execution.

### Validated common defaults for `转盘抽奖`

- `活动类型`: `转盘抽奖`
- `任务组合`: `单一任务条件`
- `任务条件1`: `KOL绑定`
- `任务参与范围`: `报名的所有用户`
- `任务风控`: `不审核KYC`
- `判定开始时间`: `报名活动后`
- `任务次数更新`: `仅1次，直至结束`
- `每日领奖人数上限`: `5`
- `总领奖人数上限`: `50`
- `任务备注`: required; do not leave empty.

### KYC prohibition

- `转盘抽奖` 任务配置禁止把 `任务条件1` 设为 `kyc任务` 作为默认或自动化链路。
- 原因：`kyc任务` 会对老用户隐藏，不适合作为通用抽奖任务配置。
- 如果用户明确要求配置 `kyc任务`，不要直接执行；先说明该限制，并要求用户确认改为非 KYC 条件。

### Multilingual handling

- `任务名称`、`任务内容` and `任务标签` have separate multilingual switches.
- Fill multilingual content by form item label; do not assume one visible `英语` control covers all three fields.
- In invisible mode, hidden English inputs or textareas can exist in the DOM. Only the field-local visible control should be used.

### Visible character limits

- Every `活动任务管理` create/edit verification must inspect the visible counters before submit.
- Currently validated limits in the `转盘抽奖` add/edit dialog:
  - `任务内容 <= 200`
  - `任务标签 <= 10`
  - `标签说明 <= 60`
- If create succeeds but edit view shows a red counter or blocks save for the same value, treat it as a page validation inconsistency and record it in failure review or handoff.
- Generated automation defaults for this chain must stay within the visible limits above unless the user explicitly asks for a negative test.

### Stable workflow

1. Open `/activity/task`.
2. Click `新增`.
3. Select `活动类型 = 转盘抽奖`.
4. Confirm the page has exposed the expected add-dialog common fields before branching.
5. Apply the confirmed or default common values.
6. Continue into the specialized branch:
   - reward mode,
   - task condition,
   - participant scope,
   - multilingual handling.
7. Submit only after all required branch-specific fields are visible and filled.
8. Verify by backend response plus follow-up list search.

### Common validation rules

- Do not treat a successful click as success by itself.
- Success requires:
  - `POST /prod-api/activity/task` returns HTTP 200,
  - response indicates `code=200` and `msg=操作成功`,
  - and follow-up search by unique task alias returns the created row.
- If the backend returns HTTP 200 but the page shows `保存任务失败` or `system busy, please retry later`, treat the create as failed.

### Common pitfalls

- `任务次数更新` may expose only one visible option, but the page still requires an explicit click.
- `任务风控` behaves like single choice in the validated `转盘抽奖` flow even when rendered like multiple checkboxes.
- Invisible mode may render some fields as selects instead of radios or text buttons; interact with the actual rendered control, not the expected visual style from visible mode.
- Page APIs may depend on in-page auth state; direct detached fetch calls are not a reliable success signal.

### Related playbooks

- `activity-task-search.md`
- `activity-task-roulette-reward-modes.md`
- `activity-task-roulette-conditions.md`
- `activity-task-roulette-participant-scopes.md`
