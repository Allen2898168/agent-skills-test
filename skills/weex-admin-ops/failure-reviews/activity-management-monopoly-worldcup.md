# 活动列表 / 大富翁世界杯（MONOPOLY_WORLD_CUP）失败复盘

## 2026-06-07 大富翁通用回归 cleanup 重复下线
- 业务线：活动列表 / 大富翁世界杯（MONOPOLY_WORLD_CUP）。
- 场景：执行 `regression-monopoly-worldcup-universal-from-scratch.mjs --confirm-run`，主流程已完成 `online -> offline` 后继续进入 cleanup。
- 失败表现：cleanup 再次调用 `/prod-api/activity/monopoly/offline`，返回 HTTP 200 但业务 `code=500`，`msg=任务不是上线状态不可下线`；活动和依赖仍可继续删除，最终回归结果被标记为 PASS。
- 失败原因：cleanup 默认总是先执行一次下线，没有识别主流程已经完成下线校验。
- 解决方式：`attemptCleanup` 增加 `skipOffline` 开关；主流程在 `offline` 成功后进入 cleanup 时直接跳过重复下线，仅保留解绑和删除。
- 验证结果：2026-06-07 复跑活动 `10023 / mwcr50320332`，cleanup 输出 `offline.skipped=true`，后续解绑、删除活动、删除任务、删除奖品、删除报名模板均返回 `code=200`，活动别名回查为空。
- 关联流程：`skills/weex-admin-ops/scripts/regression-monopoly-worldcup-universal-from-scratch.mjs`。
- 后续处理：已吸收到固定执行路径，后续不再按失败路径处理。

## 2026-05-31 大富翁世界杯活动创建提示“仅支持用户手动点击报名”
- 业务线：活动列表 / 大富翁世界杯（MONOPOLY_WORLD_CUP）。
- 场景：从零创建大富翁通用回归活动时，使用默认报名模板 participantMode（如 `REGISTERED_MANUAL`）。
- 失败表现：`POST /prod-api/activity/config` 返回 `code=500`，`msg=大富翁活动用户报名模板仅支持用户手动点击报名`。
- 失败原因：该活动类型对报名模板的 `participantMode` 有硬性约束，仅允许 `MANUAL`（用户手动点击报名）。
- 解决方式：创建报名模板时指定 `participantMode=["MANUAL"]`（或直接复用一个符合该约束的模板）。
- 验证结果：通用回归脚本 `skills/weex-admin-ops/scripts/regression-monopoly-worldcup-universal-from-scratch.mjs` 已改为创建 `MANUAL` 报名模板并跑通。
