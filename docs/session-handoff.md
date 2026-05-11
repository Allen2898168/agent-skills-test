# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 活动后台、FIN Admin 财务后台与前端页面操作自动化 skill、动作缓存、失败复盘、运行时依赖和首次配置检查。
- 活动后台权威 skill：`skills/weex-admin-ops/`，默认 staging：`https://stg-activity.weex.tech`。
- FIN Admin 权威 skill：`skills/weex-fin-admin-ops/`，默认 staging：`https://stg-admin-web-fin.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-11。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 必读入口

- 项目规范：`AGENTS.md`。
- 当前首次检查：`node tools/first-run-check.mjs --skill <admin|fin|frontend|all>`。
- 对话配置写入：`node tools/configure-skill-env.mjs --skill <admin|fin|frontend> --from-stdin`。
- 后管 skill：`skills/weex-admin-ops/SKILL.md`。
- FIN Admin skill：`skills/weex-fin-admin-ops/SKILL.md`。
- 前端 skill：`skills/weex-frontend-ops/SKILL.md`。
- 三个失败复盘入口：`skills/weex-admin-ops/FAILURES.md`、`skills/weex-fin-admin-ops/FAILURES.md`、`skills/weex-frontend-ops/FAILURES.md`。

## 最近完成

- 已内置前端 `loginTool` 最小运行时到 `skills/weex-frontend-ops/vendor/loginTool/`，不再依赖 `/Users/gabriel/Downloads/weexpr/loginTool`。
- 已新增根 `package.json` / `package-lock.json`，前端和后管缺少 `playwright` 时默认自动执行 `npm install --no-audit --no-fund`，可用 `WEEX_AUTO_INSTALL_DEPS=false` 禁用。
- 已修复 FIN 登录态未就绪时的处理：FIN 发放、批量充值、合约充值脚本现在自动打开持久 CDP FIN 登录页，等待用户登录并关闭页面后复验，再继续流程。
- 已新增首次启动检查 `tools/first-run-check.mjs`，检查项目依赖、skill-local `.env.local` 必需项和 FIN 登录态。
- 已新增对话配置工具 `tools/configure-skill-env.mjs`，支持把用户在对话中提供的缺失值写入对应 skill 的 `.env.local`，输出不回显真实值。
- 已更新 `AGENTS.md`：首次对话必须先检查依赖/配置；缺失时必须说明缺失项、放置路径、文件配置方式、对话配置方式和脚本配置方式。
- 已归档本轮运行时自包含改造：`docs/session-handoffs/2026-05-11-runtime-self-contained.md`。

## 当前 Git 状态

- 当前分支：`dev`。
- 最近本地提交：`b882407 fix: vendor frontend login runtime and auto-install deps`。
- 本轮首次检查/对话配置脚本、AGENTS/README/docs 更新尚未提交。

## 后续接力建议

- 新会话处理业务任务前，先运行 `tools/first-run-check.mjs` 检查对应 skill。
- 若缺配置，优先让用户选择：
  - 文件方式：复制对应 `.env.example` 到 skill `.env.local` 后填写。
  - 对话方式：用户直接提供缺失值，Codex 写入对应 skill `.env.local`，不回显真实值。
  - 脚本方式：通过 `tools/configure-skill-env.mjs --from-stdin` 写入。
- FIN 登录态不能随仓库提交；同事首次使用 FIN 能力时需要在自动打开的持久 CDP FIN 页面登录并关闭该页面。
- `.env.local`、`.DS_Store` 仍保持本机未跟踪；真实密码、验证码、token、cookie、API key 不提交。

## 安全说明

- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证到可提交文件。
- STG/test 测试账号邮箱和 UID 可完整记录；生产或未明确非生产时仍需脱敏。
- 截图仅在用户明确要求时保存。
