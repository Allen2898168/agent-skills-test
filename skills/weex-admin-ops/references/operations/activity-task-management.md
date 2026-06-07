# Activity Task Management Operations

Business domain:
活动通用模块管理 / 活动任务管理。

Use this file for detailed activity-task-management workflows.

Keep this file focused on page entry and navigation. Store search and create playbooks in dedicated activity-task files.

Current validated playbook split:
- Common add-dialog rules: `activity-task-create-common.md`
- Search filters: `activity-task-search.md`
- Reward-mode branches: `activity-task-roulette-reward-modes.md`
- Task-condition discovery and create: `activity-task-roulette-conditions.md`
- Participant-scope discovery and create: `activity-task-roulette-participant-scopes.md`

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

Related detailed playbooks:
- Common add-dialog rules: `activity-task-create-common.md`
- Search filters: `activity-task-search.md`
- Roulette reward modes: `activity-task-roulette-reward-modes.md`
- Roulette conditions: `activity-task-roulette-conditions.md`
- Roulette participant scopes: `activity-task-roulette-participant-scopes.md`
- Roulette task conditions: `activity-task-roulette-conditions.md`
