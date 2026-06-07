# 活动列表 / 交易竞速赛（RACE_COMPETITION）失败复盘

## 2026-05-31 竞速赛从零创建 payload 字段不全导致 `系统繁忙`
- 业务线：活动列表 / 交易竞速赛（RACE_COMPETITION）。
- 场景：编写“通用回归（从零配置，不 clone）”脚本，依赖均从零创建（报名模板/赠金奖品/交易量任务），最后 `POST /prod-api/activity/config` 创建活动草稿。
- 失败表现：HTTP 200 但业务 `code=500`，提示 `系统繁忙，请稍后再试！`；列表按别名回查 `total=0`，说明实际未创建成功。
- 失败原因：RACE_COMPETITION 的 `/activity/config` 创建对 payload 的“字段齐全度/类型”更敏感；只提交少量模块字段会触发后端内部异常，返回统一的 `系统繁忙` 文案（并非真实的系统负载问题）。
- 解决方式：
  - 在回归脚本中引入一个“字段齐全的 baseline payload”（不包含任何运行时 clone 行为），创建时以 baseline 深拷贝为起点，只覆盖本次回归的动态字段：
    - `title/showUrl/startTime/endTime`
    - `applyConfigId/applyConfig`（使用新创建的报名模板详情回填）
    - `raceFixBonusPoolParams`（绑定新任务ID + 新奖品ID）
    - `banner/share` 等图片 URL（统一替换为本次上传图）
  - baseline 存放在：`skills/weex-admin-ops/references/payload-baselines/race-competition.activity-config.baseline.json`。
- 验证结果：重跑 `regression-race-universal-from-scratch.mjs --confirm-run` 创建草稿→回查→上线/下线→解绑依赖→清理均成功，并输出 md 审阅产物。
- 关联脚本：`skills/weex-admin-ops/scripts/regression-race-universal-from-scratch.mjs`。
- 后续处理：已吸收到固定执行路径；后续新增/改动竞速赛字段时，优先更新 baseline 的字段形态再回归验证。

