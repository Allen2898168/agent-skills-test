# Relationship Reference

Use this file for relationships between WEEX admin lists, config items, dropdown data sources, backend rules, and workflows.

Do not store one-off operation steps here. Operation steps belong in `operations/`; selectors belong in `selectors/`; assertions belong in `assertions/`.

## Recording Format

For each relationship, record:

- Name.
- Status: `candidate` or `verified`.
- Last verified date.
- Source object: list, API, config page, backend rule, or existing record.
- Consumer object: dropdown, form field, task reward, activity config, search filter, or validation rule.
- Link field or displayed text.
- Dependency or limitation.
- Related operation playbooks.
- Related selectors, assertions, defaults, or scripts.

## Known Relationships

### Activity Registration Templates Feed Template Selectors

Status: candidate
Last verified: 2026-05-05

Source object:
- Activity user registration templates under `活动通用模块管理 / 活动用户报名管理`.

Consumer object:
- The same page's `用户报名模板id` search filter.
- Activity configuration pages that select a user registration template.

Dependency or limitation:
- Templates are displayed by `用户报名模板id` and `用户管理模板名称`.
- The `用户报名模板id` search field is a remote multi-select. Typed text must be converted into a selected option before the id is bound.
- Downstream activity pages may impose compatibility constraints based on activity type and template participant scope; verify the consuming page before assuming a template can be used.

Related playbooks:
- `operations/activity-register-management.md`

Related references:
- `selectors/activity-register-management.md`
- `components.md`

### Prize Records Feed Task Reward Selectors

Status: candidate
Last verified: 2026-05-04

Source object:
- Prize management records under `活动通用模块管理 / 奖品管理`.
- API sources observed during activity-task creation:
  - `/prod-api/activity/prize/all`
  - `/prod-api/activity/prize/all?prizeSubType=LOTTERY_COUNT`
  - `/prod-api/activity/prize/getListByPrizeType`

Consumer object:
- Activity task reward selectors under `活动通用模块管理 / 活动任务管理`.

Dependency or limitation:
- `单一奖励` normal reward selectors for `转盘抽奖` are scoped to lottery-count prizes.
- `限时奖励不同` and `混合奖励` can expose all prize types.
- `正常奖励+权益奖励` uses lottery-count prizes for normal reward and virtual qualification VIP prizes for rights reward.
- `首次登录APP` with default lottery-count prize failed because backend required a contract-deduction prize.

Related playbooks:
- `operations/prize-management-basic-create.md`
- `operations/prize-management.md`
- `operations/activity-task-roulette-reward-modes.md`
- `operations/activity-task-roulette-conditions.md`

### Prize Category Controls Prize Subcategory Options

Status: candidate
Last verified: 2026-05-04

Source object:
- Prize category dropdown in prize-management search and add dialogs.

Consumer object:
- Prize subcategory dropdown.

Dependency or limitation:
- Subcategory options are populated only after selecting a prize category.
- Validated examples:
  - `赠金` exposes `赠金`.
  - `币种` exposes coin/ticker options; `BTC` and `ETH` were used in validated flows.
  - `实物` exposes `实物`.
  - `虚拟积分或资格` exposes virtual qualification subtypes such as `抽奖次数`, `积分`, `合约抵扣金`, `仓位空投`, `无奖励`, and VIP-related options.

Related playbooks:
- `operations/prize-management-search.md`
- `operations/prize-management-basic-create.md`
- `operations/prize-management.md`

### Activity Type Controls Task Combo And Reward Branches

Status: candidate
Last verified: 2026-05-04

Source object:
- Activity task add dialog field `活动类型`.

Consumer object:
- Task combo, task condition fields, judge start time, and reward-mode branch fields.

Dependency or limitation:
- For `转盘抽奖`, `任务组合` only exposed `单一任务条件`.
- Selecting a task type under `任务条件1` changes the rest of the condition section.
- Reward mode determines which reward selectors and extra fields appear.
- `混合奖励` was blocked by a backend/page issue even though submit returned HTTP 200.

Related playbooks:
- `operations/activity-task-roulette-reward-modes.md`
- `operations/activity-task-roulette-conditions.md`

### Participant Scope Controls Activity Task Extra Fields

Status: candidate
Last verified: 2026-05-05

Source object:
- Activity task add dialog field `任务参与范围` for `转盘抽奖`.

Consumer object:
- Extra eligibility fields and backend validation in activity task creation.

Dependency or limitation:
- `指定代理` and `指定用户` require valid UID values. UID `123456` failed validation; UID `9881271952` passed in staging.
- `指定国家或地区` depends on a multi-select value being bound. The selected country must appear as a visible tag before submit.
- `VIP 等级` requires start and end levels plus `VIP白名单允许`.
- `注册新用户` and `老用户` require their corresponding dropdown values.
- `未充值新用户` did not expose an extra field in the validated flow.

Related playbooks:
- `operations/activity-task-roulette-participant-scopes.md`

Related references:
- `selectors/activity-task-management.md`
- `components.md`

### Activity Config Type Controls Registration Template Compatibility

Status: candidate
Last verified: 2026-05-04

Source object:
- Activity config type and registration template in lottery activity creation.

Consumer object:
- Activity config save validation.

Dependency or limitation:
- Test activities require a registration template whose participant scope is fake-money accounts.
- Formal activities can reuse broader registration templates in the validated lottery draft flow.

Related staged flow:
- `temp/weex-admin-ops/activity-management/lottery/2026-05-04-lottery-create-flow.md`

### Joker Activity Page Structure Controls Multilingual Write Path

Status: candidate
Last verified: 2026-05-06

Source object:
- Joker activity edit page under `/activities/jokerCard/modal?activityId=<ID>&operation=edit`.

Consumer object:
- Multilingual fill workflows for page save operations.

Dependency or limitation:
- Top-form text fields such as `活动标题` and `活动分享文案` are backed by `MultiLangInput` component state.
- Table columns `牌型说明` and `奖池类型` also use `MultiLangInput`, but each instance is scoped to a table cell rather than a top-level form item.
- Rich-text sections such as `活动内容规则` and `游戏玩法内容` are backed by Vue `Editor` components and Quill instances.
- Because these three structures persist values differently, a single generic `input`-filling strategy is not reliable for the whole page.

Related playbooks:
- `operations/joker-activity.md`

Related references:
- `components.md`

## Split Relationship Files

- Activity common module relationships: `relationships/activity-common-module.md`
- Activity management relationships: `relationships/activity-management.md`

### Activity Registration Template References Block Deletion

Status: candidate
Last verified: 2026-05-06

Source object:
- Activity user registration templates under `活动通用模块管理 / 活动用户报名管理`.

Consumer object:
- Activity records that reference a registration template.

Dependency or limitation:
- A registration template already referenced by activity records cannot be deleted directly.
- Observed example: template ID `2729` was blocked because activities `8990,8993` referenced it.
- Bulk deletion by recent editor must preserve such records and report the blocking activity IDs.

Related playbooks:
- `operations/activity-register-management-bulk-delete.md`

### Joker Gameplay Content Type Controls Translation Strategy

Status: candidate
Last verified: 2026-05-06

Source object:
- Joker activity field `游戏玩法内容`.

Consumer object:
- Multilingual translation and save workflows for Joker activity editing.

Dependency or limitation:
- When `游戏玩法内容` is primarily iframe or video HTML, the stable path is to synchronize the same HTML across languages rather than generate text translations.
- Text-rich fields such as `活动内容规则` should still be translated as multilingual prose.

Related playbooks:
- `operations/joker-activity.md`

Related references:
- `components.md`
