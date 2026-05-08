# 通用失败复盘

本文件记录 WEEX 前端页面操作与检查中的通用问题。页面专属问题应拆到对应业务域文件。

## 待记录

- 暂无待补充失败。

## 注册页浏览器验证码不适合自动滑块处理

- 日期：2026-05-08
- 页面/流程：前端注册页 `https://stg-www.weex.tech/zh-CN/register`
- 环境/viewport：STG，desktop `1440x1000`
- 失败表现：点击 `注册立领 $30,000` 后页面加载 Aliyun/Geetest 验证资源；DOM 中存在隐藏的 `#aliyunCaptcha-sliding-slider`，但实际页面文案出现图形点选验证，滑块元素不可见且无法拖动。
- 失败原因：当前 STG 注册页的验证码通道由后端 `validate/config` 动态返回，浏览器 DOM 里可能同时存在隐藏滑块和实际生效的点选验证；仅按滑块选择器自动化会误判。
- 解决方式：在用户明确允许接口层注册后，改用 STG 测试 header 调用注册接口链路，并在 `register/check` payload 中携带测试验证结果。
- 验证结果：接口注册成功后通过 token cookie 注入打开 `/zh-CN/account`，标题为 `账号总览`，token cookie 存在，账号页内容可见。
- 关联流程或脚本：前端注册链路探测，尚未沉淀为缓存脚本。
- 后续处理状态：需用户确认后，将接口注册路径沉淀到 `skills/weex-frontend-ops/` 的 operation 和脚本。

## 注册提交 payload 不完整导致操作失败

- 日期：2026-05-08
- 页面/流程：前端注册接口 `/v1/user/register/submit`
- 环境/viewport：STG 接口探测，无页面 viewport
- 失败表现：只提交 `serialNO`、`loginName`、`pwd` 时，接口返回业务失败。
- 失败原因：注册提交不是登录提交；注册接口需要完整注册 payload，包括 `pwd`、`rePwd`、`languageType`、`serialNO`、`email`、`type=email` 和 `terminalCode`。
- 解决方式：参考前端注册组件的提交逻辑补齐 payload；密码仍使用前端 MD5 base64 变换，仅在内存中处理。
- 验证结果：补齐 payload 后接口返回成功，并可用返回 token 打开账号页验证登录态。
- 关联流程或脚本：前端注册链路探测，尚未沉淀为缓存脚本。
- 后续处理状态：若沉淀注册脚本，应把完整 payload 作为固定路径，避免复用登录提交 payload。

## 登录 dry-run 提前加载 Playwright

- 日期：2026-05-08
- 页面/流程：前端登录缓存动作 `frontend_login_cookie`
- 环境/viewport：本地 dry-run，未打开浏览器
- 失败表现：`run-cached-action.mjs --action frontend_login_cookie --dry-run` 在缺少账号配置时提前加载 `scripts/lib/browser.mjs`，系统 Node 找不到 `playwright` 后报错，未输出缺失账号配置摘要。
- 失败原因：登录脚本在模块顶层静态导入浏览器 helper，dry-run 阶段也会解析 Playwright 依赖。
- 解决方式：将 `business/auth-pages.mjs` 和 `lib/browser.mjs` 改为非 dry-run 执行阶段的动态导入；dry-run 只解析目标 URL、账号配置和断言计划。
- 验证结果：缺少账号配置时 dry-run 正常输出 `missingConfig`；提供一次性占位账号密码时 dry-run 输出计划且不加载浏览器。
- 关联流程或脚本：`scripts/frontend-login-cookie.mjs`、`scripts/run-cached-action.mjs`
- 后续处理状态：已吸收到登录脚本固定路径；后续新增脚本应避免在 dry-run 顶层加载 Playwright 或其他重依赖。
