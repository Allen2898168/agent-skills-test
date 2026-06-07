# 转盘抽奖活动前端落地页回归测试用例集

Status: archived index
Archived full version: `docs/test-cases/archive/lottery-frontend-regression-cases-full-2026-05-25.md`
Archived on: 2026-05-25
Original line count: 261

## Current Use

This file is kept as the stable entrypoint. The full historical content was archived because project rules require long Markdown files to be split or archived before continuing updates.

## Summary From Original

## 文档说明

- 适用范围：WEEX 转盘抽奖活动前端落地页。
- 当前口径：以前端页面展示、抽奖交互、抽奖结果、奖励记录校验为主。
- 编排版完整用例库：`docs/test-cases/lottery-frontend-regression-library-orchestrated.md`
- 当前版本：v3。
- 用例总数：84。
- 优先级说明：
  - `P0`：主链路、阻塞性能力、上线前必回归。
  - `P1`：高频配置链路、核心分支、重要 UI 校验。
  - `P2`：补充分支、兼容性与观察性校验。

## 模块总览

| 模块 | 用例数 |
| --- | ---: |
| 页面基础 UI | 8 |
| 抽奖样式 UI | 7 |
| 页面状态 UI | 8 |
| 按钮与交互态 | 8 |
| 单抽主流程 | 8 |
| 五连抽主流程 | 8 |
| 我的奖品 / 奖励记录 | 9 |
| 异常提示与容错 UI | 7 |
| 二次权重与专项校验 | 4 |
| 响应式与兼容性 UI | 5 |

## Maintenance Rule

- Add new details to smaller domain-specific files instead of expanding this index.
- If historical context is needed, open `docs/test-cases/archive/lottery-frontend-regression-cases-full-2026-05-25.md`.
