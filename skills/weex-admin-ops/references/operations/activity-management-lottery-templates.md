# Activity Management - Lottery Regression Templates

Status: verified
Last verified: 2026-05-19
Verified mode: visible browser
Environment: staging `https://stg-activity.weex.tech`

## Scope

This file stores the authoritative regression template definitions for lottery activity automation preparation.

Use these templates when the goal is:
- Building a standard lottery regression activity
- Preparing a dedicated accumulated-weight activity
- Preparing a dedicated low-stock activity

## Common Base Template

The following fields are shared by all three regression templates unless a template-specific override is listed later:
- `配置类型`: `正式活动`
- `负责人`: `auto-test`
- `类别配置`: `通用`
- `流程引导配置`: `37 - 转盘活动 - 自动化测试引导配置`
- `是否为平台活动`: `是`
- `用户报名模版`: `【2781】 全用户转盘报名模板_全平台用户_auto_manual_20260512064613`
- `是否支持预报名`: `不支持`
- `是否显示活动日历入口`: `是`
- `抽奖样式`: `圆形转盘`
- `活动任务信息`: prefer fixed tasks `4998` / `4997` / `4996` / `5102`
- `奖品每日限制配置`: not configured
- `多语言`: enable English
- `常见问题`: enable English
- `活动日历`: `同步`

Shared runtime rules:
- `活动标题` and `活动副标题` must stay within the current 15-character page limit.
- Use short exact runtime titles. Do not append timestamps to the title field itself.
- `活动别名配置` must stay within `10` characters by default. Use longer aliases only for explicit alias boundary-value testing.
- `活动开始时间` must be computed in the admin business timezone and stay safely in the future at submit time.
- Prize rows should use eight real selected prizes.
- Visible UI creation must read back the selected prize value for all eight rows before submit.

## 1. 普通回归活动模板

Verified result:
- Activity ID `9219`
- Title `回归转盘03`
- Alias `autotest-20260519100833-normal` (historical verified record; do not reuse this long format for new default runs)
- Status `DRAFT`

Template-specific fields:
- `累计次数再权重配置`: not configured
- `抽奖奖品配置`: stock `100`, total weight `100`

Recommended runtime values:
- `活动标题`: short title such as `回归转盘03`
- `活动副标题`: short subtitle such as `普通回归模板`
- `活动别名配置`: short alias such as `ln<8位时间片>` and keep total length `<=10`

Use this template for:
- Main backend regression
- Main frontend regression
- Standard baseline activity creation

## 2. 二次权重专项活动模板

Verified result:
- Activity ID `9222`
- Title `回归转盘04`
- Alias `autotest-20260519102933-weight` (historical verified record; do not reuse this long format for new default runs)
- Status `DRAFT`

Template-specific fields:
- Reuse all fields from `普通回归活动模板`
- Enable `累计次数再权重配置`
- Verified minimal stable branch: fill `累计抽奖次数`, click `添加`, and complete the generated weight rows so the total is `100`

Recommended runtime values:
- `活动标题`: short title such as `回归转盘04`
- `活动副标题`: short subtitle such as `二次权重模板`
- `活动别名配置`: short alias such as `lw<8位时间片>` and keep total length `<=10`

Use this template for:
- Accumulated-draw-weight regression
- Deterministic secondary-weight frontend/backend validation

## 3. 小库存专项活动模板

Verified result:
- Activity ID `9223`
- Title `回归转盘05`
- Alias `autotest-20260519103256-stock` (historical verified record; do not reuse this long format for new default runs)
- Status `DRAFT`

Template-specific fields:
- Reuse all fields from `普通回归活动模板`
- Set all eight prize-row `总库存数量` values to `1`

Recommended runtime values:
- `活动标题`: short title such as `回归转盘05`
- `活动副标题`: short subtitle such as `小库存模板`
- `活动别名配置`: short alias such as `ls<8位时间片>` and keep total length `<=10`

Use this template for:
- Low-stock backend validation
- Frontend inventory-insufficient validation

## Execution Guidance

- Use `普通回归活动模板` for main regression.
- Use `二次权重专项活动模板` only when the case requires accumulated-weight behavior.
- Use `小库存专项活动模板` only for low-stock or inventory-insufficient validation.
- Do not mix the accumulated-weight and low-stock objectives into the same regression activity unless the user explicitly asks for a combined experiment.
