# Activity Register Management Platform Scope Operations

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page:
`/activity/register`

References:
- Main page workflow: `activity-register-management.md`
- Components: `../components.md`
- Page-specific components: `../components/activity-register-management.md`
- Cache: `../../scripts/create-register-templates.mjs`

## Create Registration Templates By Other Platform Scope

Status: candidate
Last verified: 2026-05-06
Verified modes: visible browser, invisible browser

Purpose:
Create one registration template for each non-default platform participation scope outside `全平台用户` and `指定参赛代理或用户`.

Shared defaults:
- `限制用户参与范围`: `无`.
- `用户报名方式`: `注册即报名`.
- `限制用户权限`: leave `看到和进入页面` unchecked; `报名` remains page-default disabled checked.
- `可参与注册时间范围`: off.
- `报名人数限制`: blank.

Supported platform scopes and branch defaults:
- `指定渠道码或邀请码`:
  - `合伙人分组`: select the first available option from the multi-select and close the dropdown.
  - `渠道码`: generated as `auto_channel_<timestamp>` unless overridden.
  - `邀请码`: generated as `auto_invite_<timestamp>` unless overridden.
- `自然流量`: no extra fields beyond shared defaults.
- `非活跃用户`:
  - `非活跃用户范围`: select first available option.
  - `用户区域`: select first available option.
- `仅限渠道用户`: no extra fields beyond shared defaults.
- `混合条件`:
  - `条件-1：合伙人分组`: select first available option.
  - `用户UID`: default `9881271952`.
  - `条件关系`: `且（用户需要满足所有条件）`.
  - `条件-2: 国家或地区`: select first available country/region.
- `指定华语用户`: no extra fields beyond shared defaults.
- `指定海外用户`: no extra fields beyond shared defaults.
- `假钱账户`: no extra fields beyond shared defaults.

Verification records:
- Visible mode:
  - `2753`: `平台范围可见_指定渠道码或邀请码_20260506101856`
  - `2754`: `平台范围可见_自然流量_20260506101856`
  - `2755`: `平台范围可见_非活跃用户_20260506101856`
  - `2756`: `平台范围可见_仅限渠道用户_20260506101856`
  - `2757`: `平台范围可见_混合条件_20260506101856`
  - `2758`: `平台范围可见_指定华语用户_20260506101856`
  - `2759`: `平台范围可见_指定海外用户_20260506101856`
  - `2760`: `平台范围可见_假钱账户_20260506101856`
- Invisible mode:
  - `2761`: `平台范围不可见_指定渠道码或邀请码_20260506102048`
  - `2762`: `平台范围不可见_自然流量_20260506102048`
  - `2763`: `平台范围不可见_非活跃用户_20260506102048`
  - `2764`: `平台范围不可见_仅限渠道用户_20260506102048`
  - `2765`: `平台范围不可见_混合条件_20260506102048`
  - `2766`: `平台范围不可见_指定华语用户_20260506102048`
  - `2767`: `平台范围不可见_指定海外用户_20260506102048`
  - `2768`: `平台范围不可见_假钱账户_20260506102048`

Observed page behavior:
- `假钱账户` records are created successfully and searchable by name, but the table's `平台用户参与范围` cell is empty in both visible and invisible verification runs.

Success assertions:
- `POST /prod-api/activity/apply` returns HTTP 200 with `code=200` and `msg=操作成功`.
- Searching by `用户管理模板名称` returns the created row.
- For all scopes except `假钱账户`, the table's `平台用户参与范围` cell matches the selected platform scope.

Cached script:
```bash
node skills/weex-admin-ops/scripts/create-register-templates.mjs --platform-scopes extended --signup-modes auto --dry-run
node skills/weex-admin-ops/scripts/create-register-templates.mjs --platform-scopes extended --signup-modes auto --visible
node skills/weex-admin-ops/scripts/create-register-templates.mjs --platform-scopes extended --signup-modes auto
```
