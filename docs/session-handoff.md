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

- 2026-05-11 已完成“创建10个账号 划转20u合约”：10 个 STG 账号创建成功，10 笔 FIN 20 USDT 发放审核验证成功，10 次前端现货到合约划转最终均返回 `00000 success`。本次按默认并发 10 执行；其中 1 个账号首次划转返回 `70008`，组合脚本内置重试第 2 次成功，未重复创建账号或重复 FIN 发放。
- 2026-05-11 已完成“创建12个账号 合约划转10u”：12 个 STG 账号创建成功，12 笔 FIN 10 USDT 发放审核验证成功；初次前端划转 7/12 成功、5/12 返回 `70008`，随后只重试失败账号划转，最终 12/12 返回 `00000 success`。已把合约充值组合脚本更新为对前端划转 `70008`/`20105` 默认延迟重试 2 次，不重复创建账号或重复 FIN 发放。
- 2026-05-11 已完成“创建30个账号 然后合约划转进去20u”：STG 30 个邮箱账号均创建成功并回查 UID，30 笔 FIN 20 USDT 发放审核通过，30 次前端现货到合约划转均返回 `00000 success`。高并发首跑出现注册后页面 DNS 失败、FIN `fetch failed` 和初次 `70008`，已按“回查 UID -> 顺序补发 -> 顺序划转”恢复，并记录到 `skills/weex-fin-admin-ops/failure-reviews/common.md`、`skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-11 已完成“创建10个账号 每个账号给合约充10u”：10 个 STG 账号创建成功，10 笔 FIN 10 USDT 发放审核验证成功；初次前端划转 2/10 成功、8/10 返回 `70008`，随后只重试失败账号划转，最终 10/10 返回 `00000 success`。本次初始执行误传 `--concurrency 1`，已按用户纠正更新 FIN 复盘、组合链路和 action-cache：后续初始执行默认并发，只有用户明确要求或失败恢复阶段才顺序处理。
- 已修复合约充值/批量充值脚本的 FIN 子进程可见登录恢复问题：父流程只做一次 FIN 登录态准备，子进程设置 `WEEX_FIN_DISABLE_VISIBLE_RECOVERY=true`，避免登录态有效时中途打开 Chrome 窗口。
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
- 合约充值批量链路如果高并发中途失败，不要重复创建整批账号；先按生成邮箱回查 UID，只补未发放 UID，再重试前端划转。当前组合脚本已内置前端划转 `70008`/`20105` 延迟重试。
- `.env.local`、`.DS_Store` 仍保持本机未跟踪；真实密码、验证码、token、cookie、API key 不提交。

## 安全说明

- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证到可提交文件。
- STG/test 测试账号邮箱和 UID 可完整记录；生产或未明确非生产时仍需脱敏。
- 截图仅在用户明确要求时保存。
