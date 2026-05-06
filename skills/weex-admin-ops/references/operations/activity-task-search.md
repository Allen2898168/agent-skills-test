# Activity Task Search Operations

Business domain:
活动通用模块管理 / 活动任务管理。

Use this file for read-only activity-task-management search workflows.

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
