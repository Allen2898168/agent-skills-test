# 活动任务管理：全活动类型“最复杂配置”验证（无头 API）

目标：对 **活动通用模块管理 / 活动任务管理** 的每个活动类型，选择“当前列表中最复杂的一条模板任务”，执行：

1) 取模板详情并计算复杂度评分  
2) clone 模板（仅改动低风险字段：`name/content/label/remark` + i18n 同步）  
3) 创建成功 → 按 `name` 列表回查 → 详情回查特征  
4) 删除 → 再按 `name` 回查为空（清理完成）  

无头模式强制走 API；不做 UI 点击；不猜测高风险业务参数。

## 前置条件

- 环境：默认 staging（`WEEX_ADMIN_BASE_URL=https://stg-activity.weex.tech`）。
- 必需变量在 `skills/weex-admin-ops/.env.local`：
  - `WEEX_ADMIN_PASSWORD`
  - `WEEX_ADMIN_GOOGLE_CODE`
  - `WEEX_ADMIN_USERNAME` 可缺省（staging 默认 `auto`）。

## 执行命令

只读预检查（不写入）：输出每个类型的候选模板与复杂度评分：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-complex-all-types-fast-api.mjs --dry-run`

执行复杂配置创建/验证/删除（会创建并删除测试任务）：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-complex-all-types-fast-api.mjs --confirm`

仅跑部分类型：

- `node skills/weex-admin-ops/scripts/verify-activity-tasks-complex-all-types-fast-api.mjs --confirm --types AGENT,CONTRACT_MINING,MONOPOLY_WORLD_CUP`

## 复杂度选择规则（脚本内置）

- 从每个类型列表取前 N 条（默认 `--page-size 10`），取其中前 M 条拉详情评分（默认 `--candidates 6`）。
- 评分按：`requirement` 数量、`taskAward` 字段数量、审核/动态审核/活跃度配置、i18n 等加权。
- 若创建失败且疑似命中唯一性/绑定冲突，会按候选列表自动换下一个模板重试（默认最多 `--max-attempts 3`）。

## 已知冲突与处理

- 人人代理（AGENT）模板常包含 `linkTaskId` 绑定字段；clone 时会统一清空 `linkTaskId` 避免冲突。

