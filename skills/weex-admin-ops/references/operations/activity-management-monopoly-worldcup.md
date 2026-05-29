# 活动列表 / 大富翁世界杯（MONOPOLY_WORLD_CUP）：API 自动化全配置（含依赖项）

本页目标：在后管 skill 中提供“大富翁世界杯（MONOPOLY_WORLD_CUP）”的 **基于 API 的自然语言全配置**（含依赖项显式全配置），并具备：
- 最小验证（min verify）
- 最全验证（full verify）
- 清理（cleanup）
- 对话/模板输出以“前端中文模块/字段映射”为准

## 中文映射（回答用户时优先使用）

- 模块 key -> 前端中文名：`skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-modules.md`
- 字段 key -> 前端中文名（精选）：`skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-fields.md`

## 自然语言入口（action-cache）

只做 dry-run 预览（推荐）：
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "配置大富翁世界杯活动全配置" --dry-run`
- `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "大富翁世界杯 模块配置" --dry-run`

对应 action id：
- `configure_monopoly_world_cup_activity`
- `configure_monopoly_world_cup_activity_modules`

## 全配（依赖项显式创建）+ min verify + cleanup

用途：快速跑通“依赖项显式创建 + 草稿回查校验 + 清理”，避免污染 staging。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level min --cleanup --confirm-cleanup --required-volume 1 --start-offset-seconds 120 --end-days 7`

该脚本会显式创建并绑定（当前实现的最小链路）：
- `用户报名模版(applyConfigId)`：新建 1 个全平台报名模板（`create-register-templates-fast-api.mjs`）
- `虚拟奖品(prizeId)`：新建 3 个虚拟奖品（骰子/积分/无奖励）（`create-monopoly-worldcup-virtual-prizes-fast-api.mjs`）
- `活动任务(taskId)`：新建 1 个“大富翁-合约交易量-每日-骰子奖励”任务（`create-monopoly-worldcup-contract-trading-daily-dice-task-fast-api.mjs`）
- `合约交易量任务(contractTradingVolumeTaskId)`：绑定为上述任务 ID
- `monopolyList[0]`：写入最小棋盘配置（16 格全无奖励兜底）+ 积分池奖品列表 + 每日任务 1 条

验证依据：
- 创建后会回查活动详情并检查关键字段（type/applyConfigId/monopolyList/contractTradingVolumeTaskId）
- 输出包含 `created.*`、`verify`、以及 `cleanedUp` 结果

## 全配（依赖项显式创建）+ full verify + cleanup

用途：在 min verify 基础上，增加上线/下线写操作验证。

执行（写操作，必须显式确认）：
- `node skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs --confirm-create --verify-level full --confirm-full-verify --cleanup --confirm-cleanup --required-volume 1 --start-offset-seconds 120 --end-days 7`

验证依据：
- `verify` + `online` + `offline` 均通过才算 full verify

## 模块级自由配置（按模块/字段更新）

用途：对既有活动进行“按模块修改”，以中文映射指导填参（推荐整段覆盖 monopolyList）。

1) snapshot（只读，输出一次性 spec 模板 + 当前关键模块字段）：
- `node skills/weex-admin-ops/scripts/monopoly-worldcup-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>`

2) update（写操作，必须在 spec 中 `confirm=true` 且 `confirmations.moduleWrites=true`，并传 `--confirm`）：
- `node skills/weex-admin-ops/scripts/monopoly-worldcup-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/monopoly-worldcup-modules.json --confirm`

补充：
- `monopolyList` 结构复杂，推荐整段覆盖 `modules.monopolyConfigs.monopolyList`，避免局部 patch 误配。
- 未覆盖到 modules 的顶层字段，可临时用 `rawTopLevel` 兜底；跑通后再把字段补进 `monopoly-worldcup-activity-fields.md` + modules 写入逻辑。

## 重要说明

- MONOPOLY_WORLD_CUP 列表页“上线/下线/删除”接口为：`/prod-api/activity/monopoly/online|offline|delete`（脚本已对齐）。
- 当前显式依赖全配是“最小可用链路”，用于稳定验证与清理；更复杂的棋盘/任务/奖品组合建议走模块级脚本按中文映射更新并沉淀更完整的 preset。

