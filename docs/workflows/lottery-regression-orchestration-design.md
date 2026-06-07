# 转盘抽奖回归用例编排设计稿

Status: archived index
Archived full version: `docs/workflows/archive/lottery-regression-orchestration-design-full-2026-05-25.md`
Archived on: 2026-05-25
Original line count: 317

## Current Use

This file is kept as the stable entrypoint. The full historical content was archived because project rules require long Markdown files to be split or archived before continuing updates.

## Summary From Original

## 文档说明

- 适用范围：WEEX 转盘抽奖活动后管回归用例、前端落地页回归用例的自动化编排设计。
- 当前目标：先把 `后管 56 条`、`前端 84 条` 用例整理成可执行场景，再基于场景设计主回归入口与专项回归入口。
- 当前原则：不是先写“大脚本”，而是先定义 `场景`、`用例归属`、`执行顺序`、`断言边界`，确保后续自动化能做到“通过一条 case，就 pass 一条 case”。

## 关联文档

- 后管回归用例集：`docs/test-cases/lottery-admin-regression-cases.md`
- 前端回归用例集：`docs/test-cases/lottery-frontend-regression-cases.md`
- 前端回归编排版用例库：`docs/test-cases/lottery-frontend-regression-library-orchestrated.md`
- 用例分类与执行边界：`docs/workflows/lottery-regression-case-classification-v1.md`
- 自动化落地方案：`docs/workflows/lottery-automation-regression-plan.md`
- 活动模板验证清单：`docs/workflows/lottery-activity-template-validation-checklist.md`
- 机器可读 manifest：`docs/workflows/lottery-regression-manifest.json`
- 能力差距清单：`docs/workflows/lottery-automation-capability-gap-v3.md`

## 一、当前用例总览

| 维度 | 模块数 | 用例数 |
| --- | ---: | ---: |
| 后管 | 6 | 56 |
| 前端 | 12 | 84 |
| 合计 | 18 | 140 |

## 二、编排目标

## Maintenance Rule

- Add new details to smaller domain-specific files instead of expanding this index.
- If historical context is needed, open `docs/workflows/archive/lottery-regression-orchestration-design-full-2026-05-25.md`.
