# 活动任务管理：全活动类型最小配置验证（无头 API）

目标：在 **活动通用模块管理 / 活动任务管理** 中，覆盖除“转盘抽奖”外的其他活动类型，做到“最小配置创建 → 列表/详情验证 → 删除清理”的可复现链路（无头模式强制走 API）。

## 前置条件

- 环境：默认 staging（`WEEX_ADMIN_BASE_URL=https://stg-activity.weex.tech`）。
- 必需变量在 `skills/weex-admin-ops/.env.local`（不在命令行传密钥）：
  - `WEEX_ADMIN_PASSWORD`
  - `WEEX_ADMIN_GOOGLE_CODE`
  - `WEEX_ADMIN_USERNAME` 可缺省（staging 默认 `auto`）。

## 执行命令

只读预检查（不写入）：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-all-types-fast-api.mjs --dry-run`

执行最小配置创建/验证/删除（会创建并删除测试任务）：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-all-types-fast-api.mjs --confirm`

仅跑部分类型（按 `ACTIVITY_TASK_LIST_TYPE` 的 `value`）：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-all-types-fast-api.mjs --confirm --types LOTTERY,GUESS,MONOPOLY_WORLD_CUP`

## 验证标准

- 能按活动类型过滤找到一个“模板任务”（从现有列表中选第 1 条）；
- 能 clone 模板并只改动低风险字段（`name/content/label/remark` + i18n 同步）创建成功；
- 能通过列表按 `name` 回查到新任务；
- 能 delete 新任务；
- delete 后按 `name` 回查列表为空（清理完成）。

## 说明

- 活动类型与后端筛选 code 以 skill 内 catalog 为准：`skills/weex-admin-ops/references/catalogs/activity-task-types.json`（由维护脚本从历史前端实现抽取；运行时不依赖 `activity-web`）。
- `NONE/暂无特殊配置` 会按列表筛选参数 `isNoSpecialConfig=YES` 取模板（与页面一致）。
- 若某类型在当前环境列表为空，脚本会标记 `no_template_found` 并跳过写操作（不猜测高风险字段）。
