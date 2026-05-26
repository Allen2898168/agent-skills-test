# 抽奖回归失败复盘（前端）

## `logFlowProgress is not defined` 导致报名/充值阶段全链路阻塞

- 日期：2026-05-26
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 全部`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop（默认）
- 失败表现：
  - 前端回归阶段 `frontend_signup_flow` / `frontend_recharge_prepare` 报错：`logFlowProgress is not defined`
  - FAIL 用例：`FE-81`、`FE-82`、`FE-83`（报名链路），`FE-22`（次数>0 展示）
  - 后续用例大量被 `blocked by frontend_signup_flow` / `blocked by frontend_recharge_prepare` 标记为 `SKIPPED`
- 失败原因：
  - `skills/weex-frontend-ops/scripts/lib/lottery-frontend-main-flow-helpers.mjs` 内部调用 `logFlowProgress(...)`，但该函数未在模块内定义，也未从外部导入，触发 `ReferenceError`。
- 解决方式：
  - 在 `skills/weex-frontend-ops/scripts/lib/lottery-frontend-main-flow-helpers.mjs` 增加本地 `logFlowProgress(phase, message)`，统一写入 `stderr`，避免流程被日志函数缺失中断。
- 验证结果：
  - 已修复代码（待用户确认后重跑失败 selection 验证恢复）。
- 关联报告：
  - `orchestrations/lottery-regression/artifacts/reports/20260526_170823/summary.json`

## `repoRoot is not defined` 导致“奖励记录”阶段脚本异常（FE-36/37/48/49/50/55/56）

- 日期：2026-05-26
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 全部`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop（默认）
- 失败表现：
  - 前端回归阶段 `frontend_reward_record` 报错：`repoRoot is not defined`
  - FAIL 用例：`FE-36`、`FE-37`、`FE-48`、`FE-49`、`FE-50`、`FE-55`、`FE-56`
- 失败原因：
  - “奖励记录”阶段使用了未定义变量 `repoRoot`，导致阶段内断言与后续检查无法执行。
- 解决方式：
  - 在触发脚本内补齐 `repoRoot` 的定义（与其他阶段一致从 `import.meta.url` 反推 repo root），或移除对 `repoRoot` 的依赖并改用明确的 `reportRoot`/`artifacts` 路径。
- 验证结果：
  - 本次仅记录失败与汇总，未自动修复/重跑。
- 关联报告：
  - `orchestrations/lottery-regression/artifacts/reports/20260526_172109/summary.json`
