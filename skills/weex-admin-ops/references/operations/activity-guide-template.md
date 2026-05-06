# Activity Guide Template Operations

Business domain:
活动通用模块管理 / 活动流程引导配置。

## Page Discovery And Search

Status: candidate
Last verified: 2026-05-06
Environment: staging
Verified modes: invisible browser

Entry:
`https://stg-activity.weex.tech/activity/guide`

Preconditions:
- Logged in to the staging admin.
- Sidebar menu is visible.

Navigation:
1. Expand `活动通用模块管理` when it is not already open.
2. Click `活动流程引导配置`.
3. Wait for `/prod-api/activity/guideTemplate/list` to return.

Observed page structure:
- Search fields: `ID`, `模版名称`, `活动类型`.
- Table headers: `ID`, `名称`, `活动类型`, `最近编辑人`, `更新时间`, `操作`.
- Row actions: `查看`, `修改`, `复制`, `删除`.

Search validation:
- `ID=37` sent `id=37`, returned `code=200`, `total=1`.
- `模版名称=Wesley` sent `templateName=Wesley`, returned `code=200`, `total=1`.
- `活动类型=交易大赛` sent `activityType=TRADING_COMPETITION`, returned `code=200`, `total=3`.

## Add Dialog Structure

Status: candidate
Last verified: 2026-05-06
Verified modes: invisible browser

Dialog fields:
- `模版名称`
- `活动类型`
- `引导弹窗显示频率`
- Per step:
  - `活动简介标题`
  - `H5活动简介内容`
  - `H5配图（静图）`
  - `H5配图（动图）`
  - `Web配图（静图）`
  - `Web配图（动图）`
  - `按钮文案`

Dropdown options:
- Activity types: `交易大赛`, `交易竞速赛`, `新手活动`, `转盘抽奖`, `小活动型活动`, `定制化活动`, `充值交易活动`, `人人代理活动`, `合约挖矿活动`, `小丑牌活动`, `竞猜大赛`, `代理小活动`, `暂无特殊配置`.
- Display frequencies: `每次访问`, `每日首次访问`, `用户首次访问`.

Step behavior:
- Default dialog has only `步骤1`; no step delete button is shown.
- Clicking `新增步骤` adds a new step.
- When more than one step exists, each step header shows a `删除` button.
- Current frontend maximum is 3 steps.

## Create Verified Template Batch

Status: candidate
Last verified: 2026-05-06
Environment: staging
Verified modes: invisible browser, visible browser

Purpose:
Create guide templates using the naming rule `模式_活动类型_频率_步骤数量_编号`.

Cached script:
`scripts/create-guide-templates.mjs`

Related relationship:
`references/relationships/activity-common-module.md`

Browser-mode behavior:
- `--visible` means real visible UI operation for writes: click `新增`, select dropdowns, click `新增步骤`, fill fields, upload media, and click `确认`.
- Invisible mode uses the faster authenticated API write path and then verifies through list/detail queries.
- Do not describe visible mode as verified if the write was performed only by a direct API call.

Dry run:
```bash
node scripts/create-guide-templates.mjs --dry-run
```

Visible mode:
```bash
node scripts/create-guide-templates.mjs --visible
```

Create one visible three-step lottery guide template:
```bash
node scripts/create-guide-templates.mjs --activity-types lottery --frequencies every_visit --steps 3 --visible
```

Natural-language cache example:
```bash
node scripts/run-cached-action.mjs --query "创建一个三个步骤的转盘抽奖流程引导配置 浏览器模式"
```

Default verified batch:
- 12 supported activity types with frequency `每次访问` and 1 step:
  - `交易大赛`
  - `交易竞速赛`
  - `新手活动`
  - `转盘抽奖`
  - `小活动型活动`
  - `定制化活动`
  - `充值交易活动`
  - `人人代理活动`
  - `合约挖矿活动`
  - `小丑牌活动`
  - `竞猜大赛`
  - `代理小活动`
- `交易大赛` with `每日首次访问` and 1 step.
- `交易大赛` with `用户首次访问` and 1 step.
- `交易大赛` with `每次访问` and 2 steps.

Known blocked branch:
- `暂无特殊配置 / NONE` is visible in the activity-type dropdown but blocked by the create API.
- On 2026-05-06 both invisible and visible browser modes returned HTTP 200 with business `code=500` and `系统繁忙，请稍后再试！`.
- The cached script does not include this branch by default. Use `--include-none` only when intentionally retesting the backend behavior.

Success assertions:
- Create request `POST /prod-api/activity/guideTemplate` returns HTTP 200 and business `code=200`.
- Query by exact template name through `/prod-api/activity/guideTemplate/list` returns `code=200` and `total>=1`.
- Verified rows include expected `activityType`, `displayFrequency`, and `operator=auto`.

Validated results:
- Invisible mode created 15 records, IDs `39` through `53`, excluding the blocked `NONE` branch.
- Visible browser mode created 15 records, IDs `54` through `68`, excluding the blocked `NONE` branch.
- Temporary API-authentication trial record ID `38` was deleted and exact-name query returned `total=0`.
- Visible browser custom single creation created ID `69`, name `浏览器_转盘抽奖_每次访问_3步_01_20260506125358`; detail API verified all three step config fields exist.
- Earlier visible custom creation IDs `69` and `71` used a visible browser session but wrote by authenticated API; treat them as API-write records, not true UI-click verification.
- True visible UI-click creation created ID `72`, name `浏览器UI_转盘抽奖_每次访问_3步_01_20260506130117`; the script performed 12 media uploads through page upload controls, clicked `确认`, and detail API verified all three step config fields exist.
- Corrected cached script visible run created ID `73`, name `浏览器_转盘抽奖_每次访问_3步_01_20260506130517`; script output included `writePath=visible_ui_clicks`, `uploadCount=12`, and no upload failures.

## Row Actions

Status: candidate
Last verified: 2026-05-06
Environment: staging
Verified modes: invisible browser, visible browser

Purpose:
Validate operation-column actions `查看` / `修改` / `复制` / `删除` on a temporary activity guide template, then remove temporary records.

Cached script:
`scripts/guide-template-row-actions.mjs`

Dry run:
```bash
node scripts/guide-template-row-actions.mjs --dry-run
```

Invisible mode:
```bash
node scripts/guide-template-row-actions.mjs
```

Visible browser mode:
```bash
node scripts/guide-template-row-actions.mjs --visible
```

Behavior:
- Setup creates one temporary `转盘抽奖 / 每次访问 / 1步` guide template.
- Visible mode setup is a true UI write: click `新增`, select dropdowns, fill fields, upload all media fields, and click `确认`.
- Invisible mode setup uses the authenticated API write path, then all row actions are clicked in the browser page.
- Row action clicks must target the visible fixed operation column. Element UI fixed columns can render hidden duplicate buttons; use the shared table helper instead of a raw `button:has-text(...)` locator.

Assertions:
- `查看`: clicking the row button triggers `GET /prod-api/activity/guideTemplate/{id}` with `code=200`; the visible dialog input values include the template name, activity type, frequency, and step fields.
- `修改`: clicking the row button opens the edit dialog; change `活动类型` to `交易竞速赛`, click `确认`, observe `PUT /prod-api/activity/guideTemplate` with `code=200`, then detail query shows `activityType=RACE_COMPETITION`.
- `复制`: clicking `复制` directly triggers `POST /prod-api/activity/guideTemplate/copy`; no second confirmation dialog was observed. The copied template name is `复制从 <原模板名称>`.
- `删除`: clicking `删除` opens the second confirmation dialog with text `确认删除该活动吗`; after confirming, `DELETE /prod-api/activity/guideTemplate/{id}` returns `code=200`, and exact-name search no longer finds the row.

Validated results:
- Invisible mode created temporary ID `80`, modified it to `RACE_COMPETITION`, copied it to ID `81`, then deleted both records by UI row buttons and confirmed exact-name searches were absent.
- Visible browser mode created temporary ID `82` through real UI clicks and 4 media uploads, modified it to `RACE_COMPETITION`, copied it to ID `83`, then deleted both records by UI row buttons and confirmed exact-name searches were absent.
- Earlier failed invisible attempt created ID `79`; it was later deleted through the UI `删除` row action and confirmation dialog.
