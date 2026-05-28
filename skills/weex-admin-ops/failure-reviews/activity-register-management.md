# 活动用户报名管理失败复盘

## 2026-05-05 限制用户权限未进入动作缓存
- 业务线：活动用户报名管理。
- 场景：创建报名模板时指定 `限制用户权限=看到和进入页面`。
- 失败表现：自然语言 dry-run 命中 `create_register_templates`，但脚本无法表达权限参数，只能回退手动链路。
- 失败原因：缓存脚本已有创建能力，但没有暴露 `限制用户权限` 参数。
- 解决方式：扩展脚本参数 `--permissions signup|view|signup,view`，并修复自然语言中 `报名模板` 的 `报名` 误判。
- 验证结果：dry-run 生成命令包含 `--permissions view --visible --dry-run`；组合权限 dry-run 正确。
- 关联文件：`scripts/create-register-templates.mjs`、`scripts/cache/matcher.mjs`、`references/action-cache.md`。
- 后续处理：新增可参数化字段时必须同步评估缓存脚本参数。

## 2026-05-05 指定国家或地区多选未落值
- 业务线：活动用户报名管理。
- 场景：创建报名模板或任务时选择国家/地区多选。
- 失败表现：页面已点击选项，但提交仍提示未选择国家或地区。
- 失败原因：多选下拉未收起或选项命中旧浮层，Vue 状态未稳定。
- 解决方式：定位当前表单项内下拉，选择最后打开的可见 dropdown 项，点击父级 dialog 空白处收起，并断言表单项内出现 `.el-tag`。
- 验证结果：后续 `指定国家或地区` 活动任务和报名模板平台范围链路均创建成功。
- 关联文件：`scripts/lib/element-ui/`、`references/components/activity-register-management.md`。
- 后续处理：业务脚本必须复用公共多选 helper。

## 2026-05-06 操作列查看弹窗断言误判
- 业务线：活动用户报名管理。
- 场景：验证列表操作列 `查看` 按钮。
- 失败表现：查看弹窗已打开且 `GET /prod-api/activity/apply/<id>` 返回 HTTP 200，但脚本用 `innerText` 判断模板名称时失败。
- 失败原因：查看弹窗中的模板名称是 disabled/input 值，不一定出现在 `innerText` 中；页面还可能存在其他可见 `.el-dialog`，按最后一个可见弹窗取标题会误命中非业务弹窗。
- 解决方式：查看断言改为同时检查详情接口响应 `code=200`、业务弹窗标题 `用户报名管理（查看）`，以及详情响应体中的模板名称；业务弹窗应按标题文本定位，不按最后一个可见 `.el-dialog`。
- 验证结果：使用标题定位后，临时报名模板 ID `2773` 的查看、修改、删除确认和删除后搜索回查均通过。
- 关联文件：`scripts/lib/element-ui-common.mjs`、`references/operations/activity-register-management.md`。
- 后续处理：已补充标题定位型 dialog helper，并在 `register-template-row-actions.mjs` 中验证可见和不可见模式通过；后续操作列脚本应复用该 helper，避免复用最后可见弹窗策略。

## 2026-05-06 操作列自然语言缓存误命中
- 业务线：活动用户报名管理。
- 场景：用自然语言 `活动用户报名管理 操作列 查看 修改 删除 浏览器模式` dry-run 新增的操作列缓存动作。
- 失败表现：请求误命中 `create_register_templates`，只生成创建报名模板命令，没有进入操作列验证脚本。
- 失败原因：缓存评分只按是否命中任一 object keyword 加分；`create_register_templates` 和 `verify_register_template_row_actions` 初始分数相同，manifest 顺序导致选中了创建动作。
- 解决方式：对 `supportedActions` 增加评分，并让 `verify_register_template_row_actions` 在 query 包含 `操作列` 时额外加权。
- 验证结果：同一 query dry-run 已命中 `verify_register_template_row_actions`，同时非活跃用户报名模板创建 query 仍命中 `create_register_templates`。
- 关联文件：`scripts/cache/matcher.mjs`。
- 后续处理：新增动作缓存时，如果对象关键词与既有动作重叠，必须补充差异化关键词或评分验证。

## 2026-05-06 删除已被活动引用的报名模板被后端拦截
- 业务线：活动用户报名管理。
- 场景：按 `最近编辑人=auto` 批量删除报名模板。
- 失败表现：候选模板中 ID `2729` 删除接口返回 HTTP 200 但业务 `code=500`，提示该报名模板已经被活动 `8990,8993` 使用。
- 失败原因：报名模板存在活动引用关系，后端不允许直接删除。
- 解决方式：本次只删除未被引用的精确 `operator=auto` 模板；保留被引用模板，不自动处理引用活动，避免扩大影响范围。
- 验证结果：62 条精确 `auto` 候选中 61 条删除成功；再次按 `最近编辑人=auto` 回查仅剩 ID `2729`，模糊匹配还返回 `operator=auto_test` 的 ID `177`，该记录已排除。
- 关联流程：活动用户报名管理批量删除。
- 关联文件：`scripts/delete-register-templates-by-operator.mjs`、`references/operations/activity-register-management-bulk-delete.md`。
- 后续处理：如果需要删除 ID `2729`，必须先确认活动 `8990,8993` 的处理方式，再解除引用或调整活动配置后重试。

## 2026-05-28 报名模板一旦被活动使用即无法清理（即使活动已删除）
- 业务线：活动用户报名管理。
- 场景：无头 API 创建转盘抽奖活动并显式绑定新建报名模板（applyConfigId），随后删除该活动并尝试删除报名模板。
- 失败表现：`DELETE /prod-api/activity/apply/<id>` 返回 HTTP 200 但业务 `code=500`，提示 `该报名模版已经被(<activityId>)使用`；即使活动已通过 `/prod-api/activity/lottery/delete` 删除且列表回查不存在，报名模板仍无法删除。
- 失败原因：后端对报名模板的“已被使用”判定可能包含历史引用或异步清理延迟，导致无法作为“临时依赖”实现完全清理。
- 解决方式：默认全链路回归/全配置创建时**复用已存在的稳定报名模板**（例如模板自带 `applyConfigId`），避免为“可清理验证”创建新报名模板；若必须新建报名模板，视为持久化资产，不在 cleanup 阶段强删。
- 验证结果：改用复用模板 `applyConfigId=2729` 后，转盘抽奖“显式绑定依赖（奖品/任务）创建→验证→删除”可全清理；仅跳过报名模板删除。
- 关联文件：`scripts/create-lottery-full-config-explicit-deps-fast-api.mjs`。
