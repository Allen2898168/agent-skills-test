# Activity Management Relationships

Use this file for activity-list configuration relationships. Keep one-off operation steps in `references/operations/`.

## Lottery Activity Dropdown Sources

Status: candidate
Last verified: 2026-05-07

Source objects:
- `活动通用模块管理 / 活动流程引导配置` records whose activity type is `转盘抽奖`.
- `活动通用模块管理 / 活动用户报名管理` registration templates.
- Activity-list prize configuration records exposed in the lottery prize table.
- `活动通用模块管理 / 活动任务管理` records for `转盘抽奖`.

Consumer object:
- `活动列表 / 转盘抽奖` add page.

Link field or displayed text:
- `流程引导配置` displays matching guide-flow templates.
- `用户报名模板` displays registration templates.
- `抽奖奖品配置 / 奖品名称` displays available prize records.
- `活动任务信息` displays existing roulette activity tasks.

Dependency or limitation:
- Current lottery activity chain fixes `用户报名模版` to template `2442`: `【2442】 全平台-无任何限制`.
- Test activities may require fake-money-account scoped registration templates.
- Lottery prize table `奖品池ID` is prefilled and should remain `1-8`.
- Activity task selection must be followed by the module `+` button before `排序系数` can be filled.

Related operation playbooks:
- `operations/activity-management-lottery.md`
- `operations/activity-guide-template.md`
- `operations/activity-register-management.md`
- `operations/activity-task-roulette-participant-scopes.md`
- `operations/prize-management.md`

Related scripts:
- `scripts/create-lottery-activity-draft.mjs` dry-run planner.
