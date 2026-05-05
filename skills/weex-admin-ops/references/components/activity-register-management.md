# Activity Register Management Component Patterns

Business domain:
活动通用模块管理 / 活动用户报名管理。

Use this file for component behavior that is specific to `/activity/register`. Shared component behavior remains in `../components.md`.

## Element UI Remote Multi Select Search

Status: candidate  
Last verified: 2026-05-05

Where it appears:
- Search filter `用户报名模板id`.

Locator strategy:
- Locate the form item by label or placeholder.
- Type into `.el-select__input`, wait for real dropdown options, then select the option text containing the intended id or name.

Operation steps:
1. Open the select input.
2. Type the id or template name.
3. Wait until the visible dropdown contains a concrete option such as `【2709】 <模板名称>`.
4. Click the option.
5. Click a blank page area if the dropdown remains open.
6. Continue only after the selected tag is visible.

Success assertion:
- The list request contains `ids[0]=<id>`.
- The table contains the selected template row.

Common failure modes:
- Filling only the visible text input does not bind the selected id.
- Leaving the dropdown open can intercept the search button.

Related helper:
- `../../scripts/lib/element-ui.mjs`

## Element UI Date Picker Cell Selection

Status: candidate  
Last verified: 2026-05-05

Where it appears:
- Search filters `更新开始时间` and `更新结束时间`.

Locator strategy:
- Locate the date input by placeholder, open the picker, then click a visible date cell inside `.el-picker-panel`.

Operation steps:
1. Click the date input.
2. Wait for the visible picker panel.
3. Click the intended `td.available` date cell, excluding previous/next-month cells when selecting the current month.
4. Close the picker if it remains open before clicking search.

Success assertion:
- The list request contains `beginTime=<date>` or `endTime=<date>`.

Common failure modes:
- Setting the input value directly can display text but does not bind Vue state.
- An open date picker can intercept later button clicks in invisible browser mode.
