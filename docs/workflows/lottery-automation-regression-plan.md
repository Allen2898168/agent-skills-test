# 转盘抽奖自动化回归落地方案

Status: archived index
Archived full version: `docs/workflows/archive/lottery-automation-regression-plan-full-2026-05-25.md`
Archived on: 2026-05-25
Original line count: 395

## Current Use

This file is kept as the stable entrypoint. The full historical content was archived because project rules require long Markdown files to be split or archived before continuing updates.

## Summary From Original

## 文档说明

- 适用范围：WEEX 转盘抽奖活动的后管自动化回归、前端自动化回归、专项自动化回归。
- 当前目标：把已沉淀的后管 56 条、前端 84 条回归用例，拆成可持续执行的自动化主回归与专项回归。
- 当前原则：先落稳定主链路，再补专项；不把高波动、低复现、强并发场景直接塞进日常全量回归。

## 关联文档

- 后管回归用例集：`docs/test-cases/lottery-admin-regression-cases.md`
- 前端回归用例集：`docs/test-cases/lottery-frontend-regression-cases.md`
- 编排设计稿：`docs/workflows/lottery-regression-orchestration-design.md`
- 机器可读 manifest：`docs/workflows/lottery-regression-manifest.json`
- 能力差距清单：`docs/workflows/lottery-automation-capability-gap-v3.md`

## 当前落地状态

当前已经落地：

1. `lottery_admin_main_regression`
2. `lottery_frontend_main_regression`
3. `lottery-regression-dispatcher.mjs`
4. `lottery-regression-manifest.json`

其中：

1. 后管主回归入口当前状态为 `ready`。

## Maintenance Rule

- Add new details to smaller domain-specific files instead of expanding this index.
- If historical context is needed, open `docs/workflows/archive/lottery-automation-regression-plan-full-2026-05-25.md`.
