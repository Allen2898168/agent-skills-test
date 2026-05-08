# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 后管与前端页面操作自动化 skill、动作缓存、失败复盘和交接机制。
- 后管权威 skill：`skills/weex-admin-ops/`，目标环境默认 `https://stg-activity.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-08。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 必读入口

- 项目规范：`AGENTS.md`。
- 后管 skill：`skills/weex-admin-ops/SKILL.md`。
- 前端 skill：`skills/weex-frontend-ops/SKILL.md`。
- 后管失败复盘：`skills/weex-admin-ops/FAILURES.md`。
- 前端失败复盘：`skills/weex-frontend-ops/FAILURES.md`。
- 后管 operation index：`skills/weex-admin-ops/references/operations/index.md`。
- 前端 operation index：`skills/weex-frontend-ops/references/operations/index.md`。

## 最近完成

- 已创建项目内前端页面操作与检查 skill：`skills/weex-frontend-ops/`。
- 已参考 `/Users/gabriel/Downloads/p2p-frontend-operator` 实现前端 STG cookie 登录候选链路：
  - 脚本：`skills/weex-frontend-ops/scripts/frontend-login-cookie.mjs`。
  - 缓存动作：`frontend_login_cookie`。
  - 可见浏览器验证通过：最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，未保存截图。
- 已按用户确认更新 `AGENTS.md`：
  - 后管任务使用项目内 `skills/weex-admin-ops/`。
  - 前端页面操作与检查任务使用项目内 `skills/weex-frontend-ops/`。
  - 如果认为 `AGENTS.md` 需要更新，必须先提示用户、说明建议内容并等待确认；每次更新后整体检查规范，必要时修正。
- 已按用户要求探测并跑通 STG 前端邮箱注册接口链路：
  - 页面入口：`https://stg-www.weex.tech/zh-CN/register`。
  - 接口路径：`/v1/user/public/validate/config`、`/v1/user/register/check`、`/v1/user/register/submit`。
  - 使用测试 header 的接口层路径可跳过图形验证并创建账号；注册后通过 token cookie 注入打开账号页验证登录态。
  - 验证结果：最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，`WEEX_TOKEN_COOKIE_STAGING` 存在，页面可见账号总览相关内容，无失败响应；viewport `desktop 1440x1000`。
  - 已按用户确认沉淀到 `skills/weex-frontend-ops/`：新增 `scripts/frontend-register-api.mjs`、缓存动作 `frontend_register_api`，并更新 auth operation、routes、assertions 和 action-cache 文档。
  - 已验证缓存入口：dry-run 通过；真实执行 `--confirm-register` 创建新 STG 测试账号并进入 `/zh-CN/account`，标题 `账号总览`，token cookie 存在，无失败响应。
- 已按用户补充规则更新前端认证文档：前端登录/注册即使用户说浏览器模式，也优先使用已验证的 cookie/API 路径，只需展示或验证最终登录后的页面；不要求真实点击登录/注册表单，除非用户明确要求测试表单 UI。
- 已按用户确认更新 `AGENTS.md` 的前端认证例外：前端登录和注册认证链路可使用已沉淀的 cookie/API 路径完成认证或注册，并在浏览器中展示或验证最终登录后的页面，除非用户明确要求测试登录/注册表单 UI。
- 已按用户要求使用 `frontend_register_api` 注册新的 STG 前端测试账号，并用该新账号执行 `frontend_login_cookie --visible` 浏览器模式登录验证；最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，viewport `desktop 1440x1000`，未保存截图，交接不记录完整邮箱或密码。
- 已按用户要求使用 `frontend_register_api` 带邀请码注册新的短用户名 STG 前端测试账号；最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，viewport `desktop 1440x1000`，未保存截图，交接不记录完整邮箱、邀请码、密码或 token。
- 近期后管转盘抽奖、报名模板、奖品管理、资产迁移和失败复盘历史已归档到 `docs/session-handoffs/`。

## 当前 Git 状态

- 当前分支：`dev`。
- 最近远端同步提交：`9c493e0 feat: 完善后管自动化流程沉淀与复盘规范`。
- 本轮前端 skill 创建、登录链路、注册链路探测、失败复盘和交接摘要更新尚未提交。

## 后续接力建议

- 前端注册脚本已沉淀为 `frontend_register_api`；后续创建必须先 dry-run，真实执行必须显式传 `--confirm-register`。
- 前端注册脚本必须继续脱敏输出邮箱、token、cookie、验证码和密码；本机 `.env.local` 保持未提交。
- 前端登录/注册认证链路例外已写入 `AGENTS.md`；后续前端认证默认使用已沉淀的 cookie/API 路径并验证最终登录页。
- 后管写操作仍需按 `AGENTS.md` 先说明动作；高风险业务参数不得猜测。

## 安全说明

- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证。
- 截图仅在用户明确要求时保存。
