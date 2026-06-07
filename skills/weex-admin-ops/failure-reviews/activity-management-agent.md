# 人人代理（AGENT）活动失败复盘

## 2026-06-07 通用回归上线前存在其他在线 AGENT 活动
- 业务线：活动列表 / 人人代理（AGENT）/ 通用回归。
- 场景：执行 `skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs --confirm-run`，从零创建依赖、草稿检查后进入上线前检查。
- 失败表现：旧路径在上线接口返回 `code=500 / 已有上线状态的人人代理活动`；补前置检查后的最新路径改为直接失败 `precondition failed: existing online AGENT activity 9978 (allming-6233470)`，失败产物为 `result/universal-regression/20260607_202428/AGENT_universal_from_scratch_failed.md`。
- 失败原因：staging 已存在其他在线 `AGENT` 活动，后端限制同一时间只能存在一个在线人人代理活动；当前环境阻塞已被前移到脚本前置条件。
- 解决方式：固定保留“发现在线 AGENT 即直接失败，不自动下线存量活动”的口径；如果需要继续执行，必须先人工处理现存在线活动，再重新跑通用回归。
- 验证结果：旧失败产物 `result/universal-regression/20260607_194944/AGENT_universal_from_scratch_failed.md` 与最新产物 `result/universal-regression/20260607_202428/AGENT_universal_from_scratch_failed.md` 均证明环境中存在同类在线活动，但最新脚本已不再创建到上线阶段才撞后端。
- 关联文件：`skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs`、`docs/session-handoff.md`。
- 后续处理：当前失败已吸收到固定执行路径；后续重点转为维护环境可用性，而不是继续让脚本撞上线接口。
