# 失败复盘索引

本文件是失败复盘入口。每次后台操作、脚本执行、页面探测、缓存命中或验证中出现失败，都必须主动记录到对应复盘文档。

## 使用规则
- 执行新流程或重试失败流程前，先查看本索引和相关业务线复盘。
- 新失败按业务线写入 `failure-reviews/`；跨业务通用问题写入 `failure-reviews/common.md`。
- 同类失败多次出现时，必须把解决方式反写到原流程、skill reference、组件 helper 或缓存脚本，并重新验证。
- 单个复盘文件接近 250 行时，必须按业务线、场景或时间拆分，再更新本索引。
- 不记录真实密码、验证码、token、cookie、API key、完整账号凭证或个人隐私数据。

## 文档索引
- `failure-reviews/README.md`：目录结构、写入规范和复盘模板。
- `failure-reviews/common.md`：登录、浏览器、Element UI、脚本运行、缓存匹配等通用失败。
- `failure-reviews/prize-management.md`：奖品管理相关失败。
- `failure-reviews/activity-task-management.md`：活动任务管理相关失败。
- `failure-reviews/activity-register-management.md`：活动用户报名管理相关失败。
- `failure-reviews/joker-activity.md`：小丑牌活动相关失败。

## 当前已知高频问题摘要
- Element UI 多选下拉选中后常需要点击弹窗空白、按 Escape 或调用公共 helper 收起，否则后续字段会被遮挡或 Vue 状态未稳定。
- 页面操作不能只看 HTTP 200；必须同时检查业务响应 `code`、toast/message、列表回查或表单状态。
- 登录页普通 `验证码` 可能短暂出现，staging 当前以 `/prod-api/captchaImage` 的 `captchaEnabled=false` 为准，不应把 Google 验证码填到普通验证码字段。
- 多语言字段必须按具体表单项分别打开和回填，不能用全局第一个 `英语` 输入框。
