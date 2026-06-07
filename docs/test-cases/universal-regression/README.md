# 自动化回归用例库：universal-regression

本目录由脚本元信息自动生成；用例条目按“子用例(step) = case”口径统计。

## 汇总
- 脚本用例数: 13
- 子用例总数: 141

| 用例编号 | 用例名称 | 子用例数 | 用例文档 |
| --- | --- | ---: | --- |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch | 代理小活动(AGENT_TRACE_PRO) 通用回归（从零配置） | 12 | cases/UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch.md |
| UR-ADMIN-AGENT_universal_from_scratch | 人人代理(AGENT) 通用回归（从零配置） | 11 | cases/UR-ADMIN-AGENT_universal_from_scratch.md |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch | 新手活动(BEGINNER_TASK) 通用回归（从零配置） | 12 | cases/UR-ADMIN-BEGINNER_TASK_universal_from_scratch.md |
| UR-ADMIN-CONTRACT_MINING_universal_from_scratch | 合约挖矿(CONTRACT_MINING) 通用回归（从零配置） | 11 | cases/UR-ADMIN-CONTRACT_MINING_universal_from_scratch.md |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch | 定制化活动(CUSTOMIZED) 通用回归（从零配置） | 9 | cases/UR-ADMIN-CUSTOMIZED_universal_from_scratch.md |
| UR-ADMIN-FLIP_universal_from_scratch | 小丑牌(FLIP) 通用回归（从零配置） | 11 | cases/UR-ADMIN-FLIP_universal_from_scratch.md |
| UR-ADMIN-GUESS_universal_from_scratch | 竞猜大赛(GUESS) 通用回归（从零配置） | 12 | cases/UR-ADMIN-GUESS_universal_from_scratch.md |
| UR-ADMIN-LOTTERY_universal_from_scratch | 转盘抽奖(LOTTERY) 通用回归（从零配置） | 11 | cases/UR-ADMIN-LOTTERY_universal_from_scratch.md |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch | 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（从零配置） | 9 | cases/UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch.md |
| UR-ADMIN-RACE_COMPETITION_universal_from_scratch | 交易竞速赛(RACE_COMPETITION) 通用回归（从零配置） | 11 | cases/UR-ADMIN-RACE_COMPETITION_universal_from_scratch.md |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch | 充值交易(RECHARGE_TRANS_TASK) 通用回归（从零配置） | 10 | cases/UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch.md |
| UR-ADMIN-TRACE_PRO_universal_from_scratch | 小活动(TRACE_PRO) 通用回归（从零配置） | 12 | cases/UR-ADMIN-TRACE_PRO_universal_from_scratch.md |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch | 交易大赛(TRADING_COMPETITION) 通用回归（从零配置） | 10 | cases/UR-ADMIN-TRADING_COMPETITION_universal_from_scratch.md |

## 维护
- 新增/修改脚本的 `testCase` 或 `steps.push({ name })` 后，运行：`npm run generate:test-cases`
- 新增 step name 如需更友好的中文描述/预期，请补充：`tools/lib/result-md.mjs` 的 `DEFAULT_STEP_META_ZH`
