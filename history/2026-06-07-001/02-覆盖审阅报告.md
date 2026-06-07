# 覆盖审阅

## 是否纳入覆盖
- 结论：纳入自动化覆盖，`coverageDecision=APPROVE`。

## 通过依据
- 链路分析已确认现状为 `PARTIAL`，但仓库内已经具备可复用的主干覆盖：`lottery` 后管选择集、`13` 条通用活动后管脚本，以及 `后管回归` 聚合入口。
- 2026-06-07 已有两类真实执行证据：一类是 `--selection '后管回归'` 的聚合执行，一类是按 subagent 拆分的 lottery + universal 执行，说明该需求具备继续自动化整合的实际价值和基础。
- 当前缺口集中且明确，主要是 `lottery` 任务阶段稳定性问题，以及 `AGENT` 在线活动前置检查缺失；这类问题属于“补稳后继续推进”，不构成拒绝纳入覆盖的理由。

## 替代方案
- 短期可继续把 `node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run` 作为已有聚合结果参考入口。
- 但该总入口只能作为对照或阶段子入口，不能替代本次 `automation_review_pipeline` 下的 `script_integration` 正式整合。

## 下一步
- 继续进入 `script_integration`。
- 优先整合并复用：
  - `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection '后管回归' --recharge-amount 1000 --wait-for-start-ms 60000`
  - `skills/weex-admin-ops/scripts/regression-*-universal-from-scratch.mjs` 共 `13` 条
- 整合前先补两项固定缺口：
  - `lottery-admin-main-regression.mjs` 的任务详情 `7076` / reward-mode 回查稳定性
  - `regression-agent-universal-from-scratch.mjs` 的在线 `AGENT` 活动前置检查
