# 活动列表 / 竞猜大赛（GUESS）：API 自动化全配置（含依赖项）

本页目标：在后管 skill 中提供“竞猜大赛（GUESS）”的 **基于 API 的自然语言全配置**（含依赖项显式全配置），并具备：
- 最小验证（min verify）
- 最全验证（full verify）
- 清理（cleanup）
- 对话/模板输出以“前端中文模块/字段映射”为准

## 中文映射（回答用户时优先使用）

- 模块 key -> 前端中文名：`skills/weex-admin-ops/references/mappings/guess-activity-modules.md`
- 字段 key -> 前端中文名（精选）：`skills/weex-admin-ops/references/mappings/guess-activity-fields.md`

## 自然语言入口（action-cache）

只做 dry-run 预览（推荐）：
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "配置竞猜大赛活动全配置" --dry-run`
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "竞猜大赛 模块配置" --dry-run`

对应 action id：
- `configure_guess_activity`
- `configure_guess_activity_modules`

## 全配（依赖项显式创建）+ min verify + cleanup

用途：快速跑通“依赖项显式创建 + 草稿回查校验 + 清理”，避免污染 staging。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level min --cleanup --confirm-cleanup --start-offset-seconds 120 --end-days 7`

该脚本会显式创建并绑定（当前实现）：
- `用户报名模版(applyConfigId)`：新建 1 个全平台报名模板（`create-register-templates-fast-api.mjs`）
- `奖品模版(prizeId)`：新建 1 个赠金奖品（`create-prizes-fast-api.mjs`）
- `积分任务(taskId)`：新建 1 个 GUESS 的非竞猜任务（`create-guess-integral-task-fast-api.mjs`）
- `竞猜任务(guessTaskId)`：新建 1 个竞猜任务（`create-guessing-task-fast-api.mjs`）
- `渠道配置(guessList[0])`：写入 `taskConfig/guessPeriod/prizeConfig` 等结构

验证依据：
- 创建后会回查活动详情并做关键字段检查（type/applyConfigId/guessList）
- 输出包含 `created.*`、`verify`、以及 `cleanedUp` 结果

## 全配（依赖项显式创建）+ full verify + cleanup

用途：在 min verify 基础上，增加上线/下线写操作验证。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level full --confirm-full-verify --cleanup --confirm-cleanup --start-offset-seconds 120 --end-days 7`

验证依据：
- `verify` + `online` + `offline` 均通过才算 full verify

## 模块级自由配置（按模块/字段更新）

用途：对既有活动进行“按模块修改”，以中文映射指导填参（支持 i18n/pageSetting/FAQ/渠道配置/日历等）。

1) snapshot（只读，输出一次性 spec 模板 + 当前关键模块字段）：
- `node skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>`

2) update（写操作，必须在 spec 中 `confirm=true` 且 `confirmations.moduleWrites=true`，并传 `--confirm`）：
- `node skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/guess-modules.json --confirm`

补充：
- `guessList` 结构复杂，推荐整段覆盖 `modules.guessConfigs.guessList`，避免局部 patch 误配。
- 未覆盖到 modules 的顶层字段，可临时用 `rawTopLevel` 兜底；跑通后再把字段补进 `guess-activity-fields.md` + modules 写入逻辑。

## 重要说明

- GUESS 列表页“上线/下线/删除”接口为：`/prod-api/activity/guess/online|offline|delete`（脚本 `create-guess-full-config-explicit-deps-fast-api.mjs` 已对齐）。
- 当前显式依赖全配默认使用 1 个赛期、1 个积分任务、1 个竞猜任务、1 个奖品；如需全量细分项配置，走模块级脚本按中文映射更新。

