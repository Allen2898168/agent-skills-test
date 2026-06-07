# 交易大赛(TRADING_COMPETITION) 通用回归（从零配置）

## 用例信息
- 用例编号: UR-ADMIN-TRADING_COMPETITION_universal_from_scratch
- 套件: universal-regression
- 子用例总数: 10
- 脚本入口: skills/weex-admin-ops/scripts/regression-competition-universal-from-scratch.mjs
- 标签: admin, universal-regression, from-scratch, TRADING_COMPETITION
- 用例描述: 验证交易大赛(TRADING_COMPETITION)在 staging 环境从零创建依赖与活动（含任务与奖池/奖品），完成草稿检查、上线/下线，并按需清理创建物。

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 预期结果 |
| --- | --- | --- | --- |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | 创建成功并获得模板 ID；活动创建时可绑定该模板。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-02 | create_gift_cash_prize_1_from_scratch | 从零创建赠金类奖品（第 1 个奖品位）。 | 创建成功并获得 prizeId；后续可绑定到活动奖池/奖品配置。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-03 | create_gift_cash_prize_2_from_scratch | 从零创建赠金类奖品（第 2 个奖品位）。 | 创建成功并获得 prizeId；后续可绑定到活动奖池/奖品配置。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-04 | create_competition_trading_volume_task_from_scratch | 从零创建交易大赛(TRADING_COMPETITION)依赖：交易量任务。 | 创建成功并获得 taskId；可绑定到活动任务配置。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-05 | create_competition_activity | 从零创建交易大赛(TRADING_COMPETITION)草稿。 | 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-06 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | 检查通过；fullConfigChecks 无阻塞项。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-07 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | 上线成功；活动状态变为在线/进行中/待开始（取决于时间窗口）。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-08 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | 下线成功；活动状态变为下线/已撤销。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-09 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | 尽力删除/解绑创建物；核心对象不再出现在列表回查中。 |
| UR-ADMIN-TRADING_COMPETITION_universal_from_scratch-TC-10 | cleanup_on_failure | 失败场景下的补偿清理，降低环境污染。 | 在可执行范围内完成清理或记录清理失败原因。 |
