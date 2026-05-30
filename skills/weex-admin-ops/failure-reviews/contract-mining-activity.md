# 合约挖矿活动（CONTRACT_MINING）失败复盘

## 2026-05-30 创建活动报「任务配置重复，请检查」
- 业务线：活动列表 / 合约挖矿活动。
- 场景：无头 API 脚本创建 `CONTRACT_MINING` 活动（显式创建报名模板 + 活动任务）。
- 失败表现：`POST /prod-api/activity/config` 返回 `code=500`，`msg=任务配置重复，请检查`；导致验证编排在 `CONTRACT_MINING` 阶段中断。
- 失败原因：模板 `miningList` 往往包含多个渠道项；脚本把所有渠道的 `taskConfig` 都指向同一个任务 ID，触发后端“同一活动的任务配置不可重复”的校验。
- 解决方式：按 `miningList` 条目数创建多条合约挖矿任务（每个渠道一条），并逐项绑定到对应 `miningList[i].taskConfig`；同时在异常退出时也要执行 `cleanup` 删除已创建的任务与报名模板，避免污染 staging。
- 验证结果：`verify-nonlottery-api-full-config-staging.mjs` 的 `min/full verify + cleanup` 已跑通（2026-05-30）。
- 关联文件：
  - `scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs`
  - `scripts/create-contract-mining-trading-mining-task-fast-api.mjs`
