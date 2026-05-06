# 通用失败复盘

## 2026-05-05 staging 登录页普通验证码误判
- 业务线：通用登录。
- 场景：脚本登录 staging 后台时，页面短暂出现 `placeholder="验证码"`。
- 失败表现：脚本误认为需要普通图形验证码，登录流程中止或可能把 Google 验证码填错字段。
- 失败原因：页面未稳定时普通验证码 DOM 短暂存在；staging 实际接口 `/prod-api/captchaImage` 返回 `captchaEnabled=false`。
- 解决方式：登录逻辑以 `/prod-api/captchaImage` 的 `captchaEnabled` 为准；`false` 时等待普通验证码输入隐藏，短暂残留不再中止；只填写账号、密码、Google 验证码。
- 验证结果：可见模式登录 `/activity/register` 和 `/activity/task` 均成功，最终 URL 离开 `/login`，登录接口返回 `code=200`。
- 关联文件：`skills/weex-admin-ops/scripts/lib/browser.mjs`、`skills/weex-admin-ops/references/login.md`。
- 后续处理：新登录脚本必须复用公共登录 helper。

## 2026-05-06 Element UI 下拉旧浮层干扰
- 业务线：通用组件。
- 场景：连续操作多个 Element UI 单选或多选下拉。
- 失败表现：点击选项后落值不稳定，旧 dropdown 干扰新字段，后续字段被遮挡或提交提示未选择。
- 失败原因：Element UI dropdown 以浮层形式挂在 body 下，旧浮层未关闭时选择器可能命中错误下拉。
- 解决方式：选择下拉项时取最后打开的可见 dropdown；选择后通过 Escape、点击弹窗空白或公共 helper 收起，并校验表单项内 tag/value。
- 验证结果：报名模板指定国家、活动任务指定国家、仓位空投交易对等多选链路重跑通过。
- 关联文件：`skills/weex-admin-ops/scripts/lib/element-ui/`、`skills/weex-admin-ops/references/components.md`。
- 后续处理：业务脚本不得直接复制下拉 DOM 逻辑，应复用公共 helper。

## 2026-05-05 多语言字段全局输入误填
- 业务线：通用组件。
- 场景：活动任务新增或编辑时填写 `任务名称`、`任务内容`、`任务标签` 的英语多语言。
- 失败表现：只填到了第一个英语输入，其他字段英语为空。
- 失败原因：页面存在多个独立多语言组件，且隐藏 input/textarea 会被全局选择器命中。
- 解决方式：必须按表单项分别打开多语言组件，并只定位该表单项内的可见英语输入。
- 验证结果：任务 `4800` 重新编辑后，`nameI18`、`contentI18`、`labelI18` 均包含 `lang: en`。
- 关联文件：`skills/weex-admin-ops/scripts/business/activity-task-management/roulette-participant-ui.mjs`、`skills/weex-admin-ops/references/components.md`。
- 后续处理：新多语言页面必须先判断组件归属，不使用全局第一个 `英语` 输入。
