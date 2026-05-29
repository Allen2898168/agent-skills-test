# 活动类型沉淀顺序（后管 skill）

目标：按活动类型依次补全“基于 API 的自然语言全配置（含依赖项）”，每个活动类型需具备：
- 最小验证（min verify）
- 最全验证（full verify）
- 清理（cleanup）
- 对话输出使用“前端中文模块/字段映射”

当前已覆盖：
- 新手活动（BEGINNER_TASK）
- 转盘抽奖（LOTTERY）
- 交易大赛（TRADING_COMPETITION）
- 交易竞速赛（RACE_COMPETITION）
- 小活动型活动（TRACE_PRO）
- 定制化活动（CUSTOMIZED）
- 充值交易活动（RECHARGE_TRANS_TASK）
- 人人代理活动（AGENT）
- 合约挖矿活动（CONTRACT_MINING）
- 小丑牌活动（FLIP）
- 竞猜大赛（GUESS）
- 大富翁世界杯（MONOPOLY_WORLD_CUP）
- 代理小活动（AGENT_TRACE_PRO）

待验证（需要用户确认 staging 写操作：min verify / full verify / cleanup）：
1. 竞猜大赛（GUESS）
2. 大富翁世界杯（MONOPOLY_WORLD_CUP）
3. 代理小活动（AGENT_TRACE_PRO）

说明：
- 该列表仅作为“沉淀执行顺序”索引；每个活动类型的模块/字段/依赖项映射单独维护在 `references/mappings/<activity>/`。
