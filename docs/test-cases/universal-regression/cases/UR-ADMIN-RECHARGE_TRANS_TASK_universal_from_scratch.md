# 充值交易(RECHARGE_TRANS_TASK) 通用回归（从零配置）

## 用例信息
- 用例编号: UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch
- 套件: universal-regression
- 子用例总数: 10
- 脚本入口: skills/weex-admin-ops/scripts/regression-recharge-trans-universal-from-scratch.mjs
- 标签: admin, universal-regression, from-scratch, RECHARGE_TRANS_TASK
- 用例描述: 验证充值交易(RECHARGE_TRANS_TASK)在 staging 环境从零创建依赖与活动（含交易量任务），完成草稿检查、上线/下线，并按需清理创建物。

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 预期结果 |
| --- | --- | --- | --- |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-01 | upload_banner | 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。 | 上传成功并返回可访问的资源 URL。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-02 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | 创建成功并获得模板 ID；活动创建时可绑定该模板。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-03 | create_recharge_trans_trading_volume_task_from_scratch | 从零创建充值交易活动(RECHARGE_TRANS_TASK)依赖：交易量任务。 | 创建成功并获得 taskId；可绑定到活动任务配置。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-04 | refresh_api_session_before_activity_create | 刷新后管 API 会话，确保后续创建接口具备有效登录态。 | 会话刷新成功，后续创建接口不再出现登录态/权限错误。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-05 | create_recharge_trans_activity | 从零创建充值交易活动(RECHARGE_TRANS_TASK)草稿。 | 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-06 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | 检查通过；fullConfigChecks 无阻塞项。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-07 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | 上线成功；活动状态变为在线/进行中/待开始（取决于时间窗口）。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-08 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | 下线成功；活动状态变为下线/已撤销。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-09 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | 尽力删除/解绑创建物；核心对象不再出现在列表回查中。 |
| UR-ADMIN-RECHARGE_TRANS_TASK_universal_from_scratch-TC-10 | cleanup_on_failure | 失败场景下的补偿清理，降低环境污染。 | 在可执行范围内完成清理或记录清理失败原因。 |
