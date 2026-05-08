# 前端页面操作与注册链路归档

## 2026-05-08 前端 skill 与登录

- 创建项目内前端页面操作与检查 skill：`skills/weex-frontend-ops/`。
- 参考 `/Users/gabriel/Downloads/p2p-frontend-operator` 实现 STG 前端 cookie 登录：
  - `scripts/frontend-login-cookie.mjs`
  - `scripts/check-auth-config.mjs`
  - `scripts/action-cache.json` 中的 `frontend_login_cookie`
- 使用本机未提交 `.env.local` 中的测试账号配置完成可见浏览器验证。
- 验证结果：最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，token cookie 存在，登录表单消失，未保存截图。

## 2026-05-08 注册链路探测与沉淀

- 用户要求探测并注册 STG 前端账号，入口 `https://stg-www.weex.tech/zh-CN/register`。
- 页面探测确认：
  - 主输入框 placeholder 为 `请输入邮箱 / 手机号`。
  - 可选 `邀请码` 按钮会展开邀请码输入。
  - 注册按钮文案为 `注册立领 $30,000`。
  - 页面会加载 Aliyun/Geetest 验证资源。
- 浏览器路径问题：
  - 点击注册后实际出现图形点选验证相关文案，而隐藏的 Aliyun 滑块 DOM 未变为可操作。
  - 直接页面自动化不适合稳定快速注册。
- 接口路径已跑通：
  - `POST /v1/user/public/validate/config`
  - `POST /v1/user/register/check`
  - `POST /v1/user/register/submit`
- 关键结论：
  - `register/check` 在 STG 测试 header 下可携带 `authResult: { result: true }` 跳过图形验证并返回 `serialNO`。
  - `register/submit` 需要完整 payload：`pwd`、`rePwd`、`languageType`、`serialNO`、`email`、`type=email`、`terminalCode`。
  - 密码使用前端同款 MD5 base64 变换，只在内存中处理。
- 页面验证：
  - 注册成功后使用返回 token 构造 `WEEX_TOKEN_COOKIE_STAGING`。
  - 打开 `https://stg-www.weex.tech/zh-CN/account` 验证登录态。
  - 最终 URL `/zh-CN/account`，标题 `账号总览`，token cookie 存在，账号页内容可见，无失败响应。
- 已沉淀：
  - 新增脚本：`skills/weex-frontend-ops/scripts/frontend-register-api.mjs`。
  - 新增缓存动作：`frontend_register_api`。
  - 更新文档：`references/operations/auth.md`、`references/action-cache.md`、`references/routes.md`、`references/assertions.md`、`references/operations/index.md`。
  - 更新认证浏览器模式规则：登录/注册使用 cookie/API 路径后展示最终登录页，不要求真实点击表单。
- 验证：
  - `run-cached-action.mjs --action frontend_register_api --dry-run` 通过。
  - `run-cached-action.mjs --action frontend_register_api -- --confirm-register` 创建新 STG 测试账号并进入账号总览。
  - 真实执行默认无界面浏览器验证；只有显式传 `--visible` 才打开可见 Chrome。
