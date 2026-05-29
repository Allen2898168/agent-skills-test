# 活动列表 / 定制化活动（CUSTOMIZED）：API 自动化全配置（含依赖项）

本页目标：在后管 skill 中提供“定制化活动（CUSTOMIZED）”的 **基于 API 的自然语言全配置**（含依赖项显式全配置），并具备：
- 最小验证（min verify）
- 最全验证（full verify）
- 清理（cleanup）
- 对话/模板输出以“前端中文模块/字段映射”为准

## 中文映射（回答用户时优先使用）

- 模块 key -> 前端中文名：`skills/weex-admin-ops/references/mappings/customized-activity-modules.md`
- 字段 key -> 前端中文名（精选）：`skills/weex-admin-ops/references/mappings/customized-activity-fields.md`

## 自然语言入口（action-cache）

只做 dry-run 预览（推荐）：
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "配置定制化活动全配置" --dry-run`
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "定制化活动 模块配置" --dry-run`

对应 action id：
- `configure_customized_activity`
- `configure_customized_activity_modules`

## 全配（依赖项显式创建）+ min verify + cleanup

用途：快速跑通“依赖项显式创建 + 草稿回查校验 + 清理”，避免污染 staging。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level min --cleanup --confirm-cleanup --required-volume 1 --start-offset-seconds 120 --end-days 7`

该脚本会显式创建并绑定：
- `用户报名模版(applyConfigId)`：新建 1 个全平台报名模板
- `活动任务(taskId)`：新建 1 个定制化 TRADING_VOLUME 任务（requiredVolume=1U）
- `活动任务配置(taskConfig)`：写入 `taskConfig=[{id: taskId}]`

验证依据：
- 创建后会执行 `customized-activity-fast-api.mjs --action draft-checks`
- 输出会包含 `created.*`、`verifyHints.*`、以及 `cleanedUp`/`cleanup` 结果

## 全配（依赖项显式创建）+ full verify + cleanup

用途：在 min verify 基础上，增加上线/下线写操作验证。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level full --confirm-full-verify --cleanup --confirm-cleanup --required-volume 1 --start-offset-seconds 120 --end-days 7`

验证依据：
- `draft-checks` + `online` + `offline` 均通过才算 full verify

## 模块级自由配置（按模块/字段更新）

用途：对既有活动进行“按模块修改”，以中文映射指导填参。

1) snapshot（只读，输出一次性 spec 模板 + 当前关键模块字段）：
- `node skills/weex-admin-ops/scripts/customized-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>`

2) update（写操作，必须在 spec 中 `confirm=true` 且 `confirmations.moduleWrites=true`，并传 `--confirm`）：
- `node skills/weex-admin-ops/scripts/customized-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/customized-modules.json --confirm`

补充：
- 未覆盖到 modules 的顶层字段，可临时用 `rawTopLevel` 兜底；跑通后再把字段补进 `customized-activity-fields.md` + modules 写入逻辑。

## 重要说明

- CUSTOMIZED 列表页“上线/下线/删除”接口为：`/prod-api/activity/customized/online|offline|delete`（脚本 `customized-activity-fast-api.mjs` 已对齐）。

