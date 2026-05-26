# 转盘抽奖活动前端回归用例库（编排版）

Status: archived index
Archived full version: `docs/test-cases/archive/lottery-frontend-regression-library-orchestrated-full-2026-05-25.md`
Archived on: 2026-05-25
Original line count: 261

## Current Use

This file is kept as the stable entrypoint. The full historical content was archived because project rules require long Markdown files to be split or archived before continuing updates.

## Summary From Original

## 文档说明

- 适用范围：WEEX 转盘抽奖活动前端落地页回归。
- 当前目标：基于 `前端回归 Case 状态污染矩阵`，把 84 条前端 case 重构为可执行编排库。
- 当前原则：先定义正确的 `执行顺序 / 共享链路 / 互斥场景 / 专项活动`，再进入自动化落地。
- 当前口径：本文件是 `编排版完整用例库`；详细步骤、原始预期仍以 `docs/test-cases/lottery-frontend-regression-cases.md` 为准。
- 用例分类与执行边界：`docs/workflows/lottery-regression-case-classification-v1.md`

## 一、编排总览

前端 84 条 case 已全部纳入编排，无遗漏、无重复。

| 类型 | 编排包数 | case 数 |
| --- | ---: | ---: |
| 普通主回归共享链路 | 8 | 45 |
| 互斥/多活动专项 | 5 | 39 |
| 合计 | 13 | 84 |

主回归链路执行顺序：

1. `P01` 普通活动-只读首屏与基础展示
2. `P04` 报名链路事务组-未报名到已报名
3. `P05` 已报名零次数状态组
4. `P06` 充值补次与可抽奖次数状态组
5. `P07` 单抽事务组
6. `P08` 单抽后奖励记录闭环组

## Maintenance Rule

- Add new details to smaller domain-specific files instead of expanding this index.
- If historical context is needed, open `docs/test-cases/archive/lottery-frontend-regression-library-orchestrated-full-2026-05-25.md`.
