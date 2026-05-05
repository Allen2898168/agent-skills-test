# Activity User Registration Management Operations

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page:
`/activity/register`

References:
- Route: `../routes.md`
- Selectors: `../selectors/activity-register-management.md`
- Assertions: `../assertions/activity-register-management.md`
- Components: `../components.md`
- Page-specific components: `../components/activity-register-management.md`
- Cache: `../../scripts/create-register-templates.mjs`

## Open Activity User Registration Management

Status: candidate  
Last verified: 2026-05-05  
Verified modes: visible browser, invisible browser

Purpose:
Open the registration template management page from staging admin.

Success assertions:
- Final URL is `https://stg-activity.weex.tech/activity/register`.
- Breadcrumb/page text includes `活动通用模块管理 / 活动用户报名管理`.
- Table headers include `用户报名模板id`, `用户管理模板名称`, `平台用户参与范围`, `更新时间`, `最近编辑人`, and `操作`.
- `GET /prod-api/activity/apply/list?pageNum=1&pageSize=10` and `GET /prod-api/activity/apply/all` return HTTP 200.

## Search Registration Templates

Status: candidate  
Last verified: 2026-05-05  
Verified modes: visible browser, invisible browser

Validated filters:
- `用户管理模板名称`: fill the input and click `搜索`; request includes `name=<模板名>`.
- `用户报名模板id`: remote multi-select; type id or name, select the real dropdown option such as `【2709】 <模板名>`, then click `搜索`; request includes `ids[0]=<id>`.
- `邀请码`: fill input and search; a deliberate no-match invite code returning zero rows is acceptable evidence that filtering applied.
- `最近编辑人`: fill input and search; returned rows should include the operator.
- `更新开始时间` and `更新结束时间`: click real Element UI date picker cells. Directly setting input value can display text but does not bind the Vue form state.

## Add Dialog Field Discovery

Status: candidate  
Last verified: 2026-05-05  
Verified modes: visible browser, invisible browser

Dialog title:
`用户报名管理（新增）`

Base fields:
- Required: `用户管理模板名称`, `限制用户参与范围`, `用户报名方式`.
- Optional: `平台用户参与范围`, `可参与注册时间范围`, `限制用户权限`, `报名人数限制`.
- `平台用户参与范围` radio options: `全平台用户`, `指定参赛代理或用户`, `指定渠道码或邀请码`, `自然流量`, `非活跃用户`, `仅限渠道用户`, `混合条件`, `指定华语用户`, `指定海外用户`, `假钱账户`.
- `限制用户权限` checkbox options: `报名`, `看到和进入页面`.
- `用户报名方式` checkbox options: `注册即报名`, `用户手动点击报名`, `团体报名方式`, `注册+手动点击报名方式`.

`限制用户参与范围` branch fields:
- `无`: no extra fields.
- `代理及其直客`: `输入`/`导入`; input placeholder `请输入代理uid，多个请用英文逗号隔开`.
- `代理+下级代理+所有直客`: `输入`/`导入`; input placeholder `请输入代理uid，多个请用英文逗号隔开`.
- `用户`: `输入`/`导入`; input placeholder `请输入用户uid，多个请用英文逗号隔开`.
- `国家或区域`: `国家地区` multi-select; choose real options and click a blank dialog area to close the dropdown.
- `KYC`: `kyc限制区域` country/region selector.
- `设备`: input placeholder `请输入设备ID，多个请用英文逗号隔开`.
- `VIP等级`: `VIP等级` select with `VIP0` through `VIP8`; `VIP白名单限制` radio options `同等级限制`, `全部限制`, `全部不限制`.
- `风控标签`: remote select; options are backend data and may vary by paging/order.
- `合约账户余额`: numeric/text input.
- `灰：海外做市商户`: no extra fields.
- `限制渠道码/邀请码`: `限制渠道码` and `限制邀请码` inputs.
- `非KYC用户`: no extra fields.
- `非绑定手机号用户`: no extra fields.

`用户报名方式` branch fields:
- `注册即报名`: no extra fields.
- `用户手动点击报名`: no extra fields.
- `团体报名方式`: extra input `最小团队人数`.
- `注册+手动点击报名方式`: no extra fields.

## Create All-Platform Registration Templates By Signup Mode

Status: candidate  
Last verified: 2026-05-05  
Verified modes: visible browser, invisible browser

Purpose:
Create reusable activity user registration templates with the safe default all-platform scope and one signup mode per template.

Default parameters verified:
- `平台用户参与范围`: `全平台用户`.
- `限制用户参与范围`: `无`.
- `可参与注册时间范围`: off.
- `限制用户权限`: unchecked by default; cache parameter `--permissions signup,view` can select `报名` and/or `看到和进入页面`.
- `报名人数限制`: blank.
- `团体报名方式`: `最小团队人数` = `2`.

Steps:
1. Open `/activity/register`.
2. Click `新增`.
3. Fill `用户管理模板名称`.
4. Keep or select `平台用户参与范围` = `全平台用户`.
5. Select `限制用户参与范围` = `无`.
6. Optionally select `限制用户权限`.
7. Select exactly one `用户报名方式`.
8. If the signup mode is `团体报名方式`, fill `最小团队人数`.
9. Optionally fill `报名人数限制`.
10. Click `确认`.
11. Verify `POST /prod-api/activity/apply` returns HTTP 200 and `code=200`.
12. Search by the created template name and verify the table row appears.

Created during verification:
- Visible browser mode:
  - `2710`: `自动化报名模板_可见_auto_20260505151322`, `注册即报名`.
  - `2711`: `自动化报名模板_可见_manual_20260505151322`, `用户手动点击报名`.
  - `2712`: `自动化报名模板_可见_team_20260505151322`, `团体报名方式`, `最小团队人数=2`.
  - `2713`: `自动化报名模板_可见_auto_manual_20260505151322`, `注册+手动点击报名方式`.
- Invisible browser mode:
  - `2714`: `自动化报名模板_不可见_auto_20260505151322`, `注册即报名`.
  - `2715`: `自动化报名模板_不可见_manual_20260505151322`, `用户手动点击报名`.
  - `2716`: `自动化报名模板_不可见_team_20260505151322`, `团体报名方式`, `最小团队人数=2`.
  - `2717`: `自动化报名模板_不可见_auto_manual_20260505151322`, `注册+手动点击报名方式`.

Cached script:
```bash
node skills/weex-admin-ops/scripts/create-register-templates.mjs --signup-modes auto,manual,team,auto_manual --dry-run
node skills/weex-admin-ops/scripts/create-register-templates.mjs --signup-modes team --min-team 2 --visible
node skills/weex-admin-ops/scripts/create-register-templates.mjs --signup-modes auto --permissions view --dry-run
```
