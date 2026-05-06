# 活动用户报名管理失败复盘

## 2026-05-05 限制用户权限未进入动作缓存
- 业务线：活动用户报名管理。
- 场景：创建报名模板时指定 `限制用户权限=看到和进入页面`。
- 失败表现：自然语言 dry-run 命中 `create_register_templates`，但脚本无法表达权限参数，只能回退手动链路。
- 失败原因：缓存脚本已有创建能力，但没有暴露 `限制用户权限` 参数。
- 解决方式：扩展脚本参数 `--permissions signup|view|signup,view`，并修复自然语言中 `报名模板` 的 `报名` 误判。
- 验证结果：dry-run 生成命令包含 `--permissions view --visible --dry-run`；组合权限 dry-run 正确。
- 关联文件：`skills/weex-admin-ops/scripts/create-register-templates.mjs`、`skills/weex-admin-ops/scripts/cache/matcher.mjs`、`skills/weex-admin-ops/references/action-cache.md`。
- 后续处理：新增可参数化字段时必须同步评估缓存脚本参数。

## 2026-05-05 指定国家或地区多选未落值
- 业务线：活动用户报名管理。
- 场景：创建报名模板或任务时选择国家/地区多选。
- 失败表现：页面已点击选项，但提交仍提示未选择国家或地区。
- 失败原因：多选下拉未收起或选项命中旧浮层，Vue 状态未稳定。
- 解决方式：定位当前表单项内下拉，选择最后打开的可见 dropdown 项，点击父级 dialog 空白处收起，并断言表单项内出现 `.el-tag`。
- 验证结果：后续 `指定国家或地区` 活动任务和报名模板平台范围链路均创建成功。
- 关联文件：`skills/weex-admin-ops/scripts/lib/element-ui/`、`skills/weex-admin-ops/references/components/activity-register-management.md`。
- 后续处理：业务脚本必须复用公共多选 helper。
