# 脚本整合

## 任务输入
- runId：`2026-06-07-001`
- 原始需求：`全量回归活动后管`
- 当前阶段：`automation_review_pipeline / script_integration`
- 本阶段只输出可执行整合方案，不真正执行回归。

## 复用入口
- `lottery` 后管子阶段继续复用：
  - `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection '后管回归' --recharge-amount 1000 --wait-for-start-ms 60000`
- `universal` 后管子阶段继续复用以下 `13` 条脚本，由主 agent 在 `execution_run` 阶段拆成独立 subagent 子任务执行，不能再包回一个总入口串行跑完：
  - `node skills/weex-admin-ops/scripts/regression-agent-tracepro-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-competition-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-contract-mining-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-customized-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-flip-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-guess-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-lottery-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-monopoly-worldcup-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-newbie-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-race-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-recharge-trans-universal-from-scratch.mjs --confirm-run`
  - `node skills/weex-admin-ops/scripts/regression-tracepro-universal-from-scratch.mjs --confirm-run`
- `node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run` 仅保留为结果对照入口；不能替代本次 `automation_review_pipeline` 的父编排调度。

## 需新增/修改的脚本整合点
- 本轮执行前必须先补两处固定缺口；本阶段不直接改代码，只把修复项前置为执行门禁：
  - `skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs`
    - 修正任务阶段对详情基线 `7076` 的依赖。
    - 补强 reward-mode 新建任务后的列表回查，避免 `TM-10~TM-11` 因单次检索失真误判失败。
  - `skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs`
    - 在 `online` 前增加“当前是否已有在线 `AGENT` 活动”只读前置检查。
    - 若环境已存在在线 `AGENT` 活动，直接按前置条件阻塞返回，不再创建完草稿后撞后端 `code=500`。
- 除上述两个现有脚本补稳点外，本轮不建议新增新的总入口脚本，理由：
  - `lottery` 与 `universal` 的可执行入口已经存在。
  - 本次缺的不是入口数量，而是两个已知失败点未前移到固定路径。
  - 新增一个“活动后管全量回归总脚本”会把多 subagent 编排再次压回单 agent 串行，不符合本次协议。

## 执行拆分
1. `preflight_and_fix_gate`
   - 执行者：主 agent 指派的修复/预检 subagent。
   - 动作：
     - `node tools/first-run-check.mjs --skill admin`
     - 完成上述两处脚本补稳。
     - 对补稳点做最小针对性验证；未通过则不进入真实回归。
2. `lottery_admin_stage`
   - 执行者：`lottery` 后管 subagent。
   - 命令：
     - `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection '后管回归' --recharge-amount 1000 --wait-for-start-ms 60000`
   - 产物：
     - 原始报告目录：`orchestrations/lottery-regression/artifacts/reports/<stamp>/`
     - 关键原始文件：`admin.json`
     - 最终由父编排器在 `history/2026-06-07-001/06-执行报告.*` 中引用该目录与统计。
3. `universal_admin_stage`
   - 执行者：主 agent 再拆 `13` 个 activity-type subagent；每个 subagent 只负责一条 `regression-*-universal-from-scratch.mjs`。
   - 命令：见上方 `13` 条脚本列表，统一使用 `--confirm-run`。
   - 产物：
     - 原始结果目录：`result/universal-regression/<stamp>/`
     - 原始结果文件：每条脚本各自产出 `*_universal_from_scratch.md`
     - 最终由父编排器在 `history/2026-06-07-001/06-执行报告.*` 中汇总 `13` 条脚本口径。
4. `aggregate_and_compare`
   - 执行者：主 agent。
   - 动作：
     - 聚合 `lottery` 与 `universal` 两个子阶段结果。
     - 如需对照，可额外参考 `node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run` 的汇总结构，但该命令不作为主执行链路。

## 执行产物计划
- 本阶段产物：
  - `history/2026-06-07-001/tmp-script-integration.md`
  - `history/2026-06-07-001/tmp-script-integration.json`
- 后续执行阶段必须保留的原始产物：
  - `orchestrations/lottery-regression/artifacts/reports/<stamp>/admin.json`
  - `result/universal-regression/<stamp>/*.md`
- 后续流水线归档产物：
  - `history/2026-06-07-001/05-校验审阅报告.md`
  - `history/2026-06-07-001/05-校验审阅报告.json`
  - `history/2026-06-07-001/06-执行报告.md`
  - `history/2026-06-07-001/06-执行报告.json`
- `06-执行报告.*` 需要至少包含：
  - `lottery` 子阶段命令、原始报告目录、`PASS/FAIL/SKIPPED` 统计
  - `universal` `13` 条脚本各自结果文件路径与汇总统计
  - 是否使用 `run-full-regression` 做结果对照，以及该对照仅作参考而非主执行入口

## 下一步
- 进入 `validation_review`。
- 校验重点不是“是否已有总入口”，而是：
  - 两个补稳点是否被明确列为执行前门禁
  - `lottery` 与 `universal` 是否已拆成独立 subagent 子阶段
  - 原始结果目录与 `history/<runId>/` 汇总落点是否清晰
- 若校验通过，`execution_run` 应先派发修复/预检子任务，再派发 `lottery` 子任务与 `13` 个 `universal` 子任务，最后由主 agent 汇总。
