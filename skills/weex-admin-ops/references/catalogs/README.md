# Catalogs（枚举/选项表）

目标：让脚本在不依赖 `activity-web` 的情况下仍能输出/解析后管常用选项（例如：活动任务类型、转盘抽奖样式）。

约定：
- catalog 文件放在本目录，推荐 JSON。
- 脚本输出时 `*Source` 统一使用 `references/catalogs/<file>` 形式，便于对话解释与溯源。

当前文件：
- `activity-task-types.json`：任务模板/任务列表筛选的活动类型枚举（含后端数值 code）。
- `lottery-raffle-styles.json`：转盘抽奖样式枚举。
- `lottery-supported-tasks.json`：转盘抽奖支持的任务 key 列表（用于 wizard 提示）。

