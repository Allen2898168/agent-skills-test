# 2026-05-11 运行时自包含与首次配置检查归档

## 目标

- 让同事拉取仓库后不再依赖个人机器路径或 Codex 本机 runtime。
- 首次对话时先检查依赖、配置和登录态；缺失时给出明确配置方式。
- 支持用户通过对话提供缺失配置，由 Codex 写入对应 skill 的 `.env.local`，不回显真实值。

## 已完成

- 前端 `loginTool` 依赖已内置到 `skills/weex-frontend-ops/vendor/loginTool/`。
  - `lib/weex-login.mjs`
  - `lib/weex-auth-cookie.mjs`
  - `lib/http.mjs`
- `login-tool-adapter.mjs` 默认使用内置 `vendor/loginTool`，`WEEX_FRONTEND_LOGIN_TOOL_DIR` 仅作为可选覆盖。
- 内置 `http.mjs` 使用 Node 原生 `fetch`，不依赖外部 `node_modules`。
- 新增项目根 `package.json` / `package-lock.json`，登记 `playwright`。
- 前端和活动后台 browser runtime 新增依赖自动安装 helper；缺少 `playwright` 时默认执行：
  - `npm install --no-audit --no-fund`
  - 可用 `WEEX_AUTO_INSTALL_DEPS=false` 禁用。
- FIN 发放、批量充值、合约充值脚本接入 `ensureFinAuthReady`：
  - 登录态可用时直接使用 profile/CDP auth。
  - 登录态缺失时自动打开持久 CDP FIN 页面。
  - 用户登录并关闭 FIN 页面后自动复验基础只读接口，再继续原流程。
- 新增首次启动检查：
  - `tools/first-run-check.mjs`
  - `npm run first-run`
  - 支持 `--skill admin|fin|frontend|all`。
- 新增对话配置写入工具：
  - `tools/configure-skill-env.mjs`
  - 支持 `--from-stdin`，只输出更新的 key，不输出真实值。
- 已更新 `AGENTS.md`：
  - 首次对话必须先检查依赖和对应 skill 配置。
  - 缺配置时必须说明缺失变量、目标 `.env.local`、文件方式、对话方式和脚本方式。
  - 收到用户在对话中提供的配置后，只写入对应 skill `.env.local`，不写入 docs/skill/AGENTS/temp。

## 验证

- `node --check tools/first-run-check.mjs`
- `node --check tools/configure-skill-env.mjs`
- `npm run check:frontend`
- `npm run check:fin`
- `npm run check:admin`
- `tools/first-run-check.mjs` 和前端配置检查可识别内置 `vendor/loginTool`。

## 注意

- `.env.local`、`.DS_Store` 保持未跟踪，不进入提交。
- 真实密码、Google 验证码、token、cookie、API key 仍不得提交；STG 测试账号邮箱和 UID 可以完整记录。
- FIN 登录态不能随仓库提交，只能由同事在本机持久 CDP Chrome 登录一次后复用。
