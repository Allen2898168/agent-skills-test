# 抽奖活动回归自动化能力差距清单 v3

Status: archived index
Archived full version: `docs/workflows/archive/lottery-automation-capability-gap-v3-full-2026-05-25.md`
Archived on: 2026-05-25
Original line count: 253

## Current Use

This file is kept as the stable entrypoint. The full historical content was archived because project rules require long Markdown files to be split or archived before continuing updates.

## Summary From Original

## 文档说明

- 适用范围：WEEX 转盘抽奖活动后管回归、前端落地页回归、专项回归的自动化能力建设。
- 目标口径：支持用户说“进行抽奖活动回归测试”后，先展示已登记场景菜单，再按用户选择执行单场景、多场景或全部回归。
- 当前状态：已具备菜单调度、后管主回归入口、前端主回归多阶段状态机入口；距离“整套抽奖活动后管 + 前端 + 专项全自动化回归”仍有剩余能力差距。

## 最终验收口径

后续只要满足这 6 条，就算达到目标：

1. 用户说“进行抽奖活动回归测试”时，系统固定先展示场景菜单。
2. 菜单只展示 manifest 中已登记场景，并标注可执行状态。
3. 用户可选择单场景、多场景、全部。
4. 调度器只执行用户选中的范围。
5. 每个场景执行前自动补齐对应前置条件。
6. 执行结束后输出场景级和 case 级结果明细。

## 当前能力状态总览

| 级别 | 能力项 | 当前状态 | 说明 |
| --- | --- | --- | --- |
| P0 | 场景菜单与选择机制 | 已完成 | `lottery-regression-dispatcher.mjs + lottery-regression-manifest.json` 已支持菜单、单选、多选、全部。 |
| P0 | 场景状态标记 | 已完成 | manifest 已区分 `ready / partial / planned / blocked`。 |
| P0 | “全部回归”边界 | 已完成 | 当前仅执行 manifest 中 `ready / partial` 且 `allowInAll = true` 的场景。 |
| P0 | 后管主回归入口 | 已完成 | `lottery_admin_main_regression` 已覆盖后管主链路并输出 case 级结果。 |
| P0 | 前端主回归入口结构 | 已完成 | `lottery_frontend_main_regression` 已从单阶段改成多阶段状态机入口。 |

## Maintenance Rule

- Add new details to smaller domain-specific files instead of expanding this index.
- If historical context is needed, open `docs/workflows/archive/lottery-automation-capability-gap-v3-full-2026-05-25.md`.
