# 全量回归报告（20260531_205800）

## 总览
- 口径：140 文档用例 + 141 脚本子用例 + 4 编排用例 = 285
- 结果：PASS 141 / FAIL 6 / SKIPPED 10 / TOTAL 285

## 套件明细
- 转盘抽奖文档用例（140）：PASS 128 / FAIL 6 / SKIPPED 6
  - FAIL FE-56 奖品弹窗与奖励记录结果一致
  - FAIL FE-68 H5页面展示正常
  - FAIL FE-69 常见移动端宽度下布局正常
  - FAIL FE-73 后管活动标题改动后前端展示正确
  - FAIL FE-75 后管多语言配置后前端切语言展示正确
  - FAIL FE-76 后管FAQ配置后前端展示正确
  - SKIPPED FE-04 活动副标题展示正确（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - SKIPPED FE-18 活动未开始态展示正常（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - SKIPPED FE-20 活动已结束态展示正常（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - SKIPPED FE-30 我的奖品入口可点击（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - SKIPPED FE-31 弹窗关闭交互正常（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - SKIPPED FE-80 活动未开始时显示即将开始（未纳入当前自动化回归输出口径/无可执行 phase 映射）
  - 产物：/Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/full-regression/20260531_205800/lottery-regression-summary.json

- 通用回归脚本子用例（141）：PASS 13 / FAIL 0
- regression-agent-tracepro-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212315/AGENT_TRACE_PRO_universal_from_scratch.md
- regression-agent-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212334/AGENT_universal_from_scratch.md
- regression-competition-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212354/TRADING_COMPETITION_universal_from_scratch.md
- regression-contract-mining-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212411/CONTRACT_MINING_universal_from_scratch.md
- regression-customized-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212430/CUSTOMIZED_universal_from_scratch.md
- regression-flip-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212454/FLIP_universal_from_scratch.md
- regression-guess-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212514/GUESS_universal_from_scratch.md
- regression-lottery-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212539/LOTTERY_universal_from_scratch.md
- regression-monopoly-worldcup-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212558/MONOPOLY_WORLD_CUP_universal_from_scratch.md
- regression-newbie-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212635/BEGINNER_TASK_universal_from_scratch.md
- regression-race-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212651/RACE_COMPETITION_universal_from_scratch.md
- regression-recharge-trans-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212705/RECHARGE_TRANS_TASK_universal_from_scratch.md
- regression-tracepro-universal-from-scratch: PASS /Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/universal-regression/20260531_212729/TRACE_PRO_universal_from_scratch.md

- 编排用例（4）：PASS 0 / FAIL 0 / SKIPPED 4
- ALL: SKIPPED（默认关闭：避免状态污染与额外耗时；如需执行请加 --include-orchestration）

## 原始报告与证据
- lottery-regression reportRoot：/Users/gabriel/Downloads/admin_dashboard/agent-skills-test/orchestrations/lottery-regression/artifacts/reports/20260531_205800
- 汇总 JSON：/Users/gabriel/Downloads/admin_dashboard/agent-skills-test/result/full-regression/20260531_205800/summary.json
