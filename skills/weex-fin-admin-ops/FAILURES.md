# FIN Admin 失败复盘索引

本文件是 WEEX FIN Admin skill 的失败复盘入口。每次 FIN 页面探测、脚本执行、缓存命中、创建、审核或验证中出现失败，都必须主动记录到对应复盘文档。

## 使用规则

- 执行新流程或重试失败流程前，先查看本索引和相关业务线复盘。
- 新失败按业务线写入 `failure-reviews/`；跨业务通用问题写入 `failure-reviews/common.md`。
- 同类失败多次出现时，必须把解决方式反写到原流程、reference、helper 或缓存脚本，并重新验证。
- 单个复盘文件接近 250 行时，必须按业务线、场景或时间拆分，再更新本索引。
- 不记录真实密码、验证码、token、cookie、API key、完整账号凭证或个人隐私数据；staging/test 测试账号邮箱和 UID 可以完整记录。

## 文档索引

- `failure-reviews/README.md`：目录结构、写入规范和复盘模板。
- `failure-reviews/common.md`：FIN 登录态、CDP、脚本运行、缓存匹配、接口认证等通用失败。

## 当前已知高频问题摘要

- FIN API 调用依赖当前 Chrome CDP 页面 localStorage 内的登录 token 和 fingerprint；不能把 token、cookie 写入日志或文档。staging/test UID 可以完整输出。
- 财务写操作不能只看 HTTP 200；必须同时检查业务响应 `code`、创建后的待审核列表、审核后的状态列表或等价结果回查。
- 审核通过需要运行时 Google code；只允许从 `skills/weex-fin-admin-ops/.env.local` 或当前进程内的 `WEEX_FIN_GOOGLE_CODE` 读取，不能 fallback 到其他 skill 的变量。
