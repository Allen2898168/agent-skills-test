# 链路分析报告

## 任务输入
- runId：`2026-06-07-001`
- 原始需求：`全量回归活动后管`
- 当前阶段：`automation_review_pipeline / linkage_analysis`
- 本阶段只分析现有仓库覆盖与推荐执行链路，不执行回归写操作。

## 当前已有覆盖判断
- 结论：`PARTIAL`
- 已有覆盖：
  - `orchestrations/full-regression/scripts/run-full-regression.mjs` 已支持 `--selection '后管回归'`，仓库内已有“仅后管范围”真实执行记录。
  - `docs/workflows/lottery-regression-manifest.json` 已定义 `后管回归` 选择集，包含 `56` 条转盘抽奖后管用例，统一入口为 `lottery_admin_main_regression`。
  - `skills/weex-admin-ops/scripts/` 已存在 `13` 条 `regression-*-universal-from-scratch.mjs`，覆盖通用活动类型后管回归。
  - `skills/weex-admin-ops/scripts/action-cache.json` 已沉淀 `lottery_admin_main_regression` 与 `regress_full_test_cases` 两类可复用入口。
- 判定为 `PARTIAL` 而不是 `FULL` 的原因：
  - 最新后管 subagent 链路中，lottery 后管子阶段结果为 `PASS 19 / FAIL 12 / SKIPPED 25`，`TM-01~TM-11` 仍存在稳定性缺口。
  - `AGENT` 通用回归仍缺少“现存在线 AGENT 活动”前置检查，2026-06-07 两次真实执行都因该限制失败。
  - action-cache 中没有一个“只针对活动后管全量回归”的独立缓存动作；当前更接近“已有可复用编排 + 已知缺口待补齐”。

## 推荐链路
1. 继续按 `automation_review_pipeline` 固定阶段推进，不把本次需求降级成主 agent 直接串行跑总入口。
2. `coverage_review` 阶段按“已有覆盖可复用，但需补缺口”处理。
3. `script_integration` 阶段优先复用以下现有子入口：
   - `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection '后管回归' --recharge-amount 1000 --wait-for-start-ms 60000`
   - `skills/weex-admin-ops/scripts/regression-*-universal-from-scratch.mjs` 共 `13` 条
4. 整合前先补两处固定缺口：
   - `skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs` 的任务详情基线 `7076` 与 reward-mode 列表回查稳定性
   - `skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs` 的在线 `AGENT` 活动前置检查
5. `orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run` 可作为仓库内已有聚合实现和结果对照入口，但不应替代本次 `automation_review_pipeline` 的父编排调度。

## 证据
- `orchestrations/automation-review-pipeline/scripts/resolve-entry-mode.mjs`：需求命中“全量回归”时，必须进入 `automation_review_pipeline`，不能直接用总入口替代父编排器。
- `orchestrations/full-regression/scripts/run-full-regression.mjs`：现有全量回归总入口支持 `--selection '后管回归'`。
- `docs/workflows/lottery-regression-manifest.json`：`后管回归` 为独立选择集，`adminCaseCount=56`，入口 `lottery_admin_main_regression`；其中 `admin_activity_config` 当前状态仍标为 `partial`。
- `skills/weex-admin-ops/scripts/action-cache.json`：已有 `lottery_admin_main_regression` 与 `regress_full_test_cases`，说明仓库已有可复用缓存入口，但并非“活动后管全量回归”单独动作。
- `docs/session-handoff.md`：2026-06-07 已记录两类真实执行证据：
  - `node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run`
  - 按 subagent 链路拆成 `lottery-regression --selection '后管回归'` 与 `13` 条通用回归脚本
- `skills/weex-admin-ops/failure-reviews/activity-task-management.md`：2026-06-07 lottery 后管回归 `TM-01~TM-11` 失败，说明任务阶段链路仍需补稳。
- `skills/weex-admin-ops/failure-reviews/activity-management.md`：2026-06-07 `AGENT` 通用回归因“已有上线状态的人人代理活动”失败，说明环境前置检查尚未吸收到固定路径。

## 下一步
- 推荐下一阶段结论：`coverage_review` 应按“`PARTIAL` 但值得继续推进”处理。
- 若覆盖审阅通过，`script_integration` 直接复用现有 lottery + universal 后管入口，并把上述两个缺口作为本轮整合前置修正项。
