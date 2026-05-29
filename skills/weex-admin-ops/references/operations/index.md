# Operations Index

Use this file as the table of contents for operation playbooks. Keep full workflows in business-domain files.

## Business Domains

- Activity management: `activity-management.md`
- Activity management competition: `activity-management-competition.md`
- Activity management race: `activity-management-race.md`
- Activity management tracepro: `activity-management-tracepro.md`
- Activity management agent-tracepro: `activity-management-agent-tracepro.md`
- Activity management customized: `activity-management-customized.md`
- Activity management recharge-trans-task: `activity-management-recharge-trans-task.md`
- Activity management agent: `activity-management-agent.md`
- Activity management contract-mining: `activity-management-contract-mining.md`
- Activity management flip: `activity-management-flip.md`
- Activity management guess: `activity-management-guess.md`
- Activity management monopoly-worldcup: `activity-management-monopoly-worldcup.md`
- Activity management lottery: `activity-management-lottery.md`
- Activity management newbie (BEGINNER_TASK): `activity-management-newbie.md`
- Activity management lottery frontend rules: `activity-management-lottery-frontend.md`
- Activity management lottery row actions and cache: `activity-management-lottery-row-actions.md`
- Activity management lottery templates: `activity-management-lottery-templates.md`
- Activity common module: `activity-common-module.md`
- Activity guide template: `activity-guide-template.md`
- Activity task management: `activity-task-management.md`
- Activity task management all types: `activity-task-management-all-types.md`
- Activity task management all types complex: `activity-task-management-all-types-complex.md`
- Activity task create common: `activity-task-create-common.md`
- Activity task search: `activity-task-search.md`
- Activity task roulette reward modes: `activity-task-roulette-reward-modes.md`
- Activity task roulette conditions: `activity-task-roulette-conditions.md`
- Activity task roulette participant scopes: `activity-task-roulette-participant-scopes.md`
- Activity user registration management: `activity-register-management.md`
- Activity user registration platform scopes: `activity-register-management-platform-scopes.md`
- Activity user registration date range: `activity-register-management-date-range.md`
- Activity user registration row actions: `activity-register-management-row-actions.md`
- Activity user registration bulk delete: `activity-register-management-bulk-delete.md`
- Joker activity: `joker-activity.md`
- Prize management: `prize-management.md`
- Prize management search: `prize-management-search.md`
- Prize management basic create: `prize-management-basic-create.md`
- Offline user manage / fake money account: `offline-user-manage.md`
- Reward issue: `reward-issue.md`
- Risk control: `risk-control.md`
- Import/export: `import-export.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| Trading competition activity full-config (API, explicit deps) | `activity-management-competition.md` | candidate | 2026-05-29 | Creates TRADING_COMPETITION using a template payload baseline + explicitly created deps (applyConfigId + prizePoolIds + trading-volume task); supports min/full verify (online/offline) and cleanup. |
| Race competition activity full-config (API, explicit deps) | `activity-management-race.md` | candidate | 2026-05-29 | Creates RACE_COMPETITION using a template payload baseline + explicitly created deps (applyConfigId + trading-volume task + bonus prize); supports min/full verify (online/offline) and cleanup. |
| TracePro activity full-config (API, explicit deps) | `activity-management-tracepro.md` | candidate | 2026-05-29 | Creates TRACE_PRO using a template payload baseline + explicitly created deps (applyConfigId + bonus prize + trading-volume task + resource cards); supports min/full verify (online/offline) and cleanup. |
| Agent TracePro activity full-config (API, explicit deps) | `activity-management-agent-tracepro.md` | candidate | 2026-05-29 | Creates AGENT_TRACE_PRO by forcing channelCategory=AGENT on a TRACE_PRO payload baseline + explicitly created deps (applyConfigId + bonus prize + AGENT_TRACE_PRO trading-volume task + resource cards); supports min/full verify (online/offline) and cleanup. |
| Customized activity full-config (API, explicit deps) | `activity-management-customized.md` | candidate | 2026-05-29 | Creates CUSTOMIZED using a template payload baseline + explicitly created deps (applyConfigId + trading-volume task); supports min/full verify (online/offline) and cleanup. |
| Recharge trans task activity full-config (API, explicit deps) | `activity-management-recharge-trans-task.md` | candidate | 2026-05-29 | Creates RECHARGE_TRANS_TASK using a template payload baseline + explicitly created deps (applyConfigId + trading-volume task); supports min/full verify (online/offline) and cleanup. |
| Agent activity full-config (API, explicit deps) | `activity-management-agent.md` | candidate | 2026-05-29 | Creates AGENT using a template payload baseline + explicitly created deps (applyConfigId + invite-friend task); supports min/full verify (online/offline) and cleanup. |
| Contract mining activity full-config (API, explicit deps) | `activity-management-contract-mining.md` | candidate | 2026-05-29 | Creates CONTRACT_MINING using a template payload baseline + explicitly created deps (applyConfigId + contract-mining task); supports min/full verify (online/offline) and cleanup. |
| Flip activity full-config (API, explicit deps) | `activity-management-flip.md` | candidate | 2026-05-29 | Creates FLIP using a template payload baseline + explicitly created deps (applyConfigId + virtual prizes + flip tasks); supports min/full verify (online/offline) and cleanup. |
| Guess activity full-config (API, explicit deps) | `activity-management-guess.md` | candidate | 2026-05-29 | Creates GUESS using minimal i18n assets + explicitly created deps (applyConfigId + bonus prize + integral task + guessing task); supports min/full verify (online/offline) and cleanup. |
| Monopoly world cup activity full-config (API, explicit deps) | `activity-management-monopoly-worldcup.md` | candidate | 2026-05-29 | Creates MONOPOLY_WORLD_CUP using a template payload baseline + explicitly created deps (applyConfigId + virtual prizes + daily contract trading dice task); supports min/full verify (online/offline) and cleanup. |
| Login and open offline user manage | `offline-user-manage.md` | candidate | 2026-05-04 | Opens `/activities/offline/userManage` after login. |
| Lottery activity search and draft creation | `activity-management-lottery.md` | verified | 2026-05-19 | Validates `活动列表 / 转盘抽奖` search filters and creates a draft by visible browser workflow; action cache now supports visible UI creation and dry-run planning. |
| Lottery activity row actions and cache | `activity-management-lottery-row-actions.md` | verified | 2026-05-25 | Stores row-action evidence, failure-avoidance rules, and cache commands split from the main lottery activity playbook. |
| Lottery admin main regression orchestration | `activity-management-lottery-templates.md` | candidate | 2026-05-21 | First-stage orchestration script chains stable prize, register-template, roulette-task, draft-create, and online steps for admin main regression. |
| Lottery frontend signup-state rules | `activity-management-lottery-frontend.md` | verified | 2026-05-19 | Stores the verified frontend alias URL, signup requirement, and main-button state transitions for lottery activities. |
| Lottery regression activity templates | `activity-management-lottery-templates.md` | verified | 2026-05-19 | Stores the authoritative `普通回归` / `二次权重专项` / `小库存专项` template definitions and runtime rules. |
| Open prize management | `activity-common-module.md` | candidate | 2026-05-04 | Opens `/activity/prize` from `活动通用模块管理 / 奖品管理`. |
| Activity guide template discovery and search | `activity-guide-template.md` | candidate | 2026-05-06 | Opens `/activity/guide`, validates search fields, table structure, add-dialog fields, and step add/delete behavior. |
| Create activity guide template batch | `activity-guide-template.md` | candidate | 2026-05-06 | Creates verified activity-type/frequency/step combinations; visible and invisible modes verified; `暂无特殊配置/NONE` blocked by backend. |
| Verify activity guide template row actions | `activity-guide-template.md` | candidate | 2026-05-06 | Creates a temporary guide template, verifies `查看` / `修改` / `复制` / `删除`, and deletes temporary records; visible and invisible modes verified. |
| Prize management search | `prize-management-search.md` | candidate | 2026-05-04 | Validates prize ID, category, name, and alias search. |
| Open activity task management | `activity-task-management.md` | candidate | 2026-05-04 | Opens `/activity/task` by clicking `活动通用模块管理` then `活动任务管理`. |
| Activity task add dialog common flow | `activity-task-create-common.md` | candidate | 2026-05-05 | Captures shared add-dialog defaults, confirmation rules, multilingual handling, and submit assertions for validated `转盘抽奖` create flows. |
| Activity task management search | `activity-task-search.md` | candidate | 2026-05-04 | Validates task ID, alias, label, remark, time, score, and manual-award multi-select filters. |
| Create roulette task | `activity-task-roulette-reward-modes.md` | candidate | 2026-05-04 | Creates `转盘抽奖` task variants; single reward, limited reward, and normal+rights passed. Mixed reward is blocked pending development fix. |
| Create bonus prize | `prize-management-basic-create.md` | candidate | 2026-05-04 | Creates `赠金 / 赠金` prize with default and English names, validity fields, unit, precision, discount ratio, and image. |
| Create coin prize | `prize-management-basic-create.md` | candidate | 2026-05-04 | Creates `币种 / BTC` prize with default and English names, alias, valid days, unit, precision, and image. |
| Create physical prize | `prize-management-basic-create.md` | candidate | 2026-05-04 | Creates `实物 / 实物` prize with default and English names, alias, valid days, unit, precision, and image. |
| Virtual qualification field discovery | `prize-management.md` | candidate | 2026-05-04 | Captures add-dialog fields for every `虚拟积分或资格` subtype. |
| Create virtual qualification prize by subtype | `prize-management.md` | candidate | 2026-05-04 | Creates all 12 virtual qualification subtype prizes with safe defaults; `仓位空投` requires multi-select trade-pair blur handling. |
| Prize row actions | `prize-management.md` | candidate | 2026-05-04 | Validates row `查看`, `修改`, `复制`, and `删除`; use a dedicated test prize and delete the copied row. |
| Roulette task condition discovery | `activity-task-roulette-conditions.md` | candidate | 2026-05-04 | Documents available `转盘抽奖` task condition types and fields. |
| Create roulette single-reward tasks by condition | `activity-task-roulette-conditions.md` | candidate | 2026-05-22 | Creates single-reward tasks by condition; `现货交易量` now uses a verified `volumeCountType=["FEE"]` model-binding fallback when create mode does not render fee-count checkboxes. |
| Roulette participant scope discovery | `activity-task-roulette-participant-scopes.md` | candidate | 2026-05-05 | Documents `任务参与范围` options and extra fields for `转盘抽奖`. |
| Create roulette tasks by participant scope | `activity-task-roulette-participant-scopes.md` | candidate | 2026-05-05 | Creates one single-reward roulette task per participant scope; records UID and country multi-select constraints. |
| Activity user registration management search and field discovery | `activity-register-management.md` | candidate | 2026-05-05 | Validates search fields and documents add-dialog scope/sign-up branches in visible and invisible modes. |
| Create activity user registration templates | `activity-register-management.md` | candidate | 2026-05-05 | Creates all-platform registration templates for four signup modes; visible and invisible modes verified. |
| Create registration templates by platform scope | `activity-register-management-platform-scopes.md` | candidate | 2026-05-06 | Creates templates for non-default platform scopes including `非活跃用户`, `自然流量`, and `假钱账户`. |
| Create non-active registration template with register time range | `activity-register-management-date-range.md` | candidate | 2026-05-06 | Creates `非活跃用户` templates with `可参与注册时间范围` enabled and bound via datetime component helper. |
| Verify registration template row actions | `activity-register-management-row-actions.md` | candidate | 2026-05-06 | Creates a temporary template, verifies `查看` / `修改` / `删除`, and deletes the temporary row; visible and invisible modes verified. |
| Delete registration templates by recent editor | `activity-register-management-bulk-delete.md` | candidate | 2026-05-06 | Dry-runs and deletes templates whose exact `operator` matches the requested recent editor; referenced templates are blocked by backend validation. |
| Fill Joker activity multilingual content | `joker-activity.md` | candidate | 2026-05-06 | Reads Chinese and English source content, fills text and rich-text multilingual fields, syncs media-rich gameplay HTML, and verifies with a fresh reload. |
