# Activity Common Module Operations

Business domain:
活动通用模块管理。

Use this file for common-module navigation playbooks only. Keep page-specific workflows in dedicated business files so operation references stay small and searchable.

## Open Prize Management

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Expand the left sidebar item `活动通用模块管理` and open `奖品管理`.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Sidebar menu is visible.

Steps:
1. In the left sidebar, click `活动通用模块管理` to expand it.
2. Click `奖品管理`.
3. Wait for navigation and prize list loading.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Success assertions:
- Final URL path is `/activity/prize`.
- Breadcrumb/page text includes `活动通用模块管理 / 奖品管理`.
- Page contains filters `奖品ID`, `奖品分类`, `奖品子类别`, `奖品名称`, and `奖品别名`.
- Table contains headers `奖品ID`, `奖品分类`, `奖品子分类`, `奖品名称`, `奖品别名`, and `操作`.

Optional screenshot:
- Directory: `artifacts/screenshots/活动通用模块管理/奖品管理/`.
- Suggested file name: `activity-common-prize-management.png`.

Related detailed playbooks:
- Prize search: `prize-management-search.md`
- Basic prize creation: `prize-management-basic-create.md`
- Virtual qualification and row actions: `prize-management.md`
