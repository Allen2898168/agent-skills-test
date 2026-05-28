# 活动列表 / 新手活动：无头全配置（API）

目标：让 skill 支持“新手活动(BEGINNER_TASK) 的全配置创建/校验/清理”。

**强制规则**：默认无头模式下所有写操作走 API；执行前必须明确高风险确认；执行后必须回查验证；默认清理测试数据。

## 前置条件

- 环境：staging（`WEEX_ADMIN_BASE_URL=https://stg-activity.weex.tech`）。
- `skills/weex-admin-ops/.env.local` 具备：
  - `WEEX_ADMIN_PASSWORD`
  - `WEEX_ADMIN_GOOGLE_CODE`
  - `WEEX_ADMIN_USERNAME` 可缺省（stg 默认 `auto`）。

## 使用方式

1) 先输出“模块/字段/一次性回复模板”（不写入）：

- `node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --wizard`

2) 填写一次性 spec（推荐放在 `./tmp/newbie-spec.json`）后执行：

- `node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm`

### 一次性 spec 最小必填

- `templateId` 或 `templateAlias`：用于 clone 的“现有全配置新手活动模板”（建议用 `templateId`）。
- `confirm=true` 且 `confirmations.*=true`：高风险确认开关。

### 执行链路（默认 preset）

- `full_create_verify_delete`（推荐）：
  - clone 模板创建草稿（全配置）
  - `draft-checks` 回查 `multiLanguageTemplateId/applyConfigId/taskPackageId or taskConfig/resourceConfig/i18n/questions`
  - 删除清理（使用 `/activity/beginner/delete` + totp）

## 底层脚本

- 新手活动 API：`scripts/newbie-activity-fast-api.mjs`
- 新手活动向导：`scripts/newbie-config-wizard-api.mjs`

