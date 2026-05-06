# Activity Register Management Date Range Operations

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page:
`/activity/register`

References:
- Main page workflow: `activity-register-management.md`
- Platform scope workflows: `activity-register-management-platform-scopes.md`
- Components: `../components.md`
- Page-specific components: `../components/activity-register-management.md`
- Cache: `../../scripts/create-register-templates.mjs`

## Create Non-Active Registration Template With Register Time Range

Status: candidate
Last verified: 2026-05-06
Verified modes: visible browser

Purpose:
Create a registration template whose `平台用户参与范围` is `非活跃用户` and whose `可参与注册时间范围` is enabled.

Validated defaults:
- `平台用户参与范围`: `非活跃用户`.
- `非活跃用户范围`: first available option; observed `5天非活跃合约用户`.
- `用户区域`: first available option; observed `海外用户`.
- `限制用户参与范围`: `无`.
- `用户报名方式`: `注册即报名`.
- `限制用户权限`: leave `看到和进入页面` unchecked; `报名` remains page-default disabled checked.
- `报名人数限制`: blank.

Validated record:
- Template ID: `2772`.
- Template name: `非活跃用户报名模板_注册时间_20260506104509`.
- Register time range: `2026-05-06 00:00:00` to `2026-05-07 23:59:59`.

Component note:
- The `可参与注册时间范围` switch exposes two Element UI `datetime` components with placeholders `开始时间` and `结束时间`.
- Setting input values directly can show text without binding Vue state. Use `scripts/lib/element-ui-datetime.mjs` and assert both component `value` and `displayValue`.

Success assertions:
- Date-time components expose the target `value` and `displayValue` before submit.
- `POST /prod-api/activity/apply` returns HTTP 200 with `code=200` and `msg=操作成功`.
- Searching by `用户管理模板名称` returns the created row.
- The returned row has `平台用户参与范围` equal to `非活跃用户` and recent editor `auto`.

Cached script:
```bash
node skills/weex-admin-ops/scripts/create-register-templates.mjs --platform-scopes non_active --signup-modes auto --register-start "2026-05-06 00:00:00" --register-end "2026-05-07 23:59:59" --visible --dry-run
```
