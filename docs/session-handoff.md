# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 活动后台、FIN Admin 财务后台与前端页面操作自动化 skill、动作缓存、失败复盘和交接机制。
- 活动后台权威 skill：`skills/weex-admin-ops/`，目标环境默认 `https://stg-activity.weex.tech`。
- FIN Admin 权威 skill：`skills/weex-fin-admin-ops/`，目标环境默认 `https://stg-admin-web-fin.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-08。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 必读入口

- 项目规范：`AGENTS.md`。
- 后管 skill：`skills/weex-admin-ops/SKILL.md`。
- FIN Admin skill：`skills/weex-fin-admin-ops/SKILL.md`。
- 前端 skill：`skills/weex-frontend-ops/SKILL.md`。
- 后管失败复盘：`skills/weex-admin-ops/FAILURES.md`。
- FIN Admin 失败复盘：`skills/weex-fin-admin-ops/FAILURES.md`。
- 前端失败复盘：`skills/weex-frontend-ops/FAILURES.md`。
- 后管 operation index：`skills/weex-admin-ops/references/operations/index.md`。
- FIN Admin operation index：`skills/weex-fin-admin-ops/references/operations/index.md`。
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
- 已按用户要求使用 `frontend_register_api` 注册新的 STG 前端测试账号，并用该新账号执行 `frontend_login_cookie --visible` 浏览器模式登录验证；最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，viewport `desktop 1440x1000`，未保存截图；按当前规则，后续 STG 测试账号邮箱和 UID 可以完整记录，密码和 token 仍禁止记录。
- 已按用户要求使用 `frontend_register_api` 带邀请码注册新的短用户名 STG 前端测试账号；最终 URL `https://stg-www.weex.tech/zh-CN/account`，标题 `账号总览`，viewport `desktop 1440x1000`，未保存截图；密码、邀请码和 token 不记录。
- 已按用户确认把 FIN Admin / 财务管理后台从活动后台 skill 中剥离，新增独立 `skills/weex-fin-admin-ops/`；FIN `空投奖励(产品化活动)` 候选脚本、operation 文档和动作缓存已迁入该 skill，原 `skills/weex-admin-ops/` 中的 FIN 入口已清理。
- 已通过 CDP 探测并验证 FIN Admin `空投奖励(产品化活动)` 页面，脚本 `skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs` 和动作缓存 `finance_airdrop_reward_grant` 已验证当前 Chrome 登录态、`bizType=125`、`OTHER_ACTIVITIES/其他活动`、`USDT coinId=2`、审核类型映射，以及 staging 创建+审核通过路径。
- 已使用前端 STG 注册 API 创建新的测试账号，并通过 `skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs` 给该账号发放并审核通过 1000 USDT；验证依据为待审核列表命中、`needGaVerify` 成功、审核通过接口成功、审核后列表回查命中。验证码、token 和 cookie 不记录。
- 已按用户要求补充 skill 环境变量边界硬规则：各 skill 的本机运行配置只放对应 skill 目录 `.env.local`，根目录 `.env.local` 不作为配置来源，且不得跨 skill fallback。已迁移本机旧根目录环境变量到 `skills/weex-admin-ops/.env.local` 和 `skills/weex-fin-admin-ops/.env.local`，并移除根目录 `.env.local`。
- 已验证环境边界相关脚本和文档：语法检查通过，三个 skill 知识结构校验通过，环境加载检查显示根目录 `.env.local` 不存在且各 skill-local 配置可加载。
- 已实现 FIN Admin 持久 CDP profile 能力；旧实现曾在 FIN tab 关闭时自动打开 FIN 页面读取 localStorage。当前规则已收紧：FIN tab 关闭后默认改为直接读取 Chrome profile Local Storage 文件认证，不再自动打开 FIN tab/target。
- 已按用户确认补充 FIN Admin 使用前基础验证规则，并新增 `skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs`：使用 FIN 能力前先验证持久 CDP 登录态和基础只读接口；验证失败时要求用户在 CDP Chrome 登录，关闭 FIN 页面视为人工处理完成，关闭后复验。
- 已按用户补充规则更新 `AGENTS.md` 和 FIN skill：`fin-auth-check.mjs --wait-for-close` 默认持续等待直到用户关闭 FIN 页面；用户明确要求“充值/发放/下发”且高风险值已明确时，视为已确认 FIN 充值/发放写操作，不再二次确认，但脚本级确认 flag 仍必须传入。
- 本轮执行“创建 3 个账号，分别充值 1000u”：先创建了 3 个前端账号，但因 FIN 自动新开页短暂停在 `about:blank`，未能充值，且当时按旧规则未输出/保存完整 UID；随后修复 `readFinAuth` 等待 FIN host 加载后，重新创建 3 个 STG 前端账号，并为每个账号通过 `空投奖励(产品化活动)` 创建并审核 1000 USDT 发放订单。第 2、3 笔已审核列表即时命中；第 1 笔 `verifyPass` 成功且补查不在待审核列表。验证码、token 和 cookie 不记录。
- 已按用户新规则更新：STG/test 非生产测试账号邮箱和 UID 不脱敏，脚本输出、最终回复、交接和失败复盘可以完整记录；生产或未明确非生产时仍脱敏或避免输出。
- 已补充 FIN 执行模型说明：FIN 发放/审核脚本是 profile-auth/API 辅助执行；普通读写不再打开 FIN 页面读取 localStorage，只有登录恢复时打开可见页面让用户登录。认证可读后实际创建/审核走 FIN API，不是 UI 点击。
- 已沉淀批量“注册 + 充值”脚本：`skills/weex-fin-admin-ops/scripts/batch-register-recharge.mjs`。脚本默认 headless 读取 FIN 持久 profile 登录态，只有 token/session 失效时才关闭 headless CDP 并打开可见 FIN 页面等待用户登录关闭；随后继续无头 API 执行。dry-run 已验证：不创建账号、不充值，当前 FIN 登录态可复用，`loginRequired=false`。
- 已登记动作缓存 `batch_register_recharge`，自然语言 `创建3个账号分别充值1000 USDT` 可命中并推断 `--count 3 --amount 1000 --currency USDT --confirm-register --confirm-recharge`。
- 已按用户要求执行“创建 10 个账号，分别存 1000u”：先通过 `fin-auth-check.mjs` 验证 FIN headless 持久登录态，再通过缓存动作 `batch_register_recharge` dry-run，随后真实执行 `--count 10 --amount 1000 --confirm-register --confirm-recharge`。结果：创建 10 个 STG 前端测试账号，并为每个账号通过 FIN `空投奖励(产品化活动)` 创建并审核 1000 USDT 发放订单；最终 URL `https://stg-admin-web-fin.weex.tech/zh-CN/spotProGrant/airdropRewardProd/`。订单号：1436715507181793280、1436715586672242688、1436715647187660800、1436715705740144640、1436715768809893888、1436715827291074560、1436715906777329664、1436715965606637568、1436716045789147136、1436716104329048064；全部 `approvalVerified=true`，第 2 笔通过 `verifyPass` 成功且审核后不在待审核列表作为补充证据，其余已审核列表即时命中。验证码、token、cookie 和密码不记录。
- 已按用户确认更新 `AGENTS.md`：首次对话处理项目任务时，读取对应 skill 后必须先检查该 skill 自己的 `.env.local` / 同前缀环境变量、登录态、CDP profile、cookie/API auth 等依赖；任一必需依赖未准备完成时，不回答或处理业务提示词，不执行 dry-run、缓存动作、页面操作或写操作，先提示用户缺少什么以及应配置到哪里。
- 已按用户要求参考 `/Users/gabriel/Downloads/weexpr/loginTool` 为前端登录态新增依赖登录态的资产划转接口能力：
  - 新增脚本：`skills/weex-frontend-ops/scripts/frontend-assets-transfer.mjs`。
  - 新增可复用 helper：`scripts/lib/login-tool-adapter.mjs` 的 `loginFrontendWithTokens`，通过 loginTool 登录并仅在内存中使用 access token。
  - 新增缓存动作：`frontend_assets_transfer`，默认 STG endpoint `https://stg-gateway2.weex.tech/v1/assets/transfer`，默认 payload 为用户提供示例 `{amount:1000, fromAccountType:10, toAccountType:8, transferCoinId:"2"}`。
  - 真实划转必须先 dry-run，并显式传 `--confirm-transfer`；本次仅完成 dry-run、语法、JSON 和知识结构验证，未执行真实划转。
- 本轮执行“注册一个账号，转进合约 1000u”：前端注册成功，账号 `codexapi1778266620635@weex.com`、UID `7281095039`，账号页 `/zh-CN/account` 验证通过；随后用该账号调用前端划转接口 `POST https://stg-gateway2.weex.tech/v1/assets/transfer`，payload 为 `{amount:1000, fromAccountType:10, toAccountType:8, transferCoinId:"2"}`，接口鉴权通过但业务返回 `code=70008`、`msg=超出可划转的最大金额`。已补充前端失败复盘和流程限制；如需完成划转，需要先通过 FIN Admin 给该 STG 账号现货账户充值/发放 1000 USDT 后重试。
- 已按用户确认补充“注册新账号并转进合约”目标态编排：
  - 新增跨 skill 工作流文档：`docs/workflows/frontend-fin-account-funding.md`。
  - 新增 FIN 侧组合脚本：`skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`。
  - 新增缓存动作：`register_recharge_transfer_contract`，自然语言 `注册一个账号 转进合约1000u` 已 dry-run 命中该动作。
  - 组合链路固定为：前端注册新账号 -> FIN Admin 发放/充值 USDT 到现货 -> 前端登录态接口从现货账户类型 `10` 划转到合约账户类型 `8`。
  - dry-run 已验证：前端注册配置、FIN headless 登录态、前端划转配置均可用；未执行真实注册、充值或划转。
- 已按用户确认补充复合链路自动沉淀规则：当 agent 未实现或误解复合链路，用户给出正确解决方案且后续验证成功时，视为已授权自动沉淀，必须更新 playbook、组合脚本或动作缓存、失败复盘和交接记录。规则已写入 `AGENTS.md` 和 `docs/workflows/compound-workflow-maintenance.md`。
- 已按用户要求更新 `AGENTS.md`：输出只保留必要内容，任务执行过程中的动作类更新必须极简，不写无必要解释、背景或寒暄。
- 本轮执行“注册 10 个新账号，合约账户充 500u”：FIN 基础验证通过，组合动作 dry-run 命中；真实执行已创建 10 个 STG 账号并完成 10 笔 FIN `空投奖励(产品化活动)` 500 USDT 成功订单，但首个账号前端划转到合约失败，返回 `20105` 后重试为 `70008`。同批成功订单 UID/订单号：`4845048042/1436722371814600704`、`3815850320/1436722449040125952`、`9761770230/1436722528236974080`、`3717187714/1436722586143535104`、`3360119394/1436722648655441920`、`8966768361/1436722706994016256`、`4676015185/1436722765605220352`、`8856359958/1436722824174481408`、`9703549361/1436722882366255104`、`7595929790/1436722941371723776`。
- 已将 `register_recharge_transfer_contract` 标记为 blocked，并更新脚本默认拒绝真实执行；原因是 FIN 现有发放成功不等于前端可划转源余额，当前 FIN 账号访问合约资产发放接口返回 `403 No permission`。失败已写入 FIN/前端通用复盘。
- 本轮处理“创建10个账号 合约账户充110u”：用户纠正确认为复合链路，应执行“前端注册 -> FIN 现货充值 -> 前端划转合约”。已更新 `docs/workflows/frontend-fin-account-funding.md`、FIN action cache、FIN operation、前端资产划转说明和失败复盘，不再把该类请求直接 blocked。
- 真实执行复合链路时，批量注册/FIN 发放阶段完成后，前端划转阶段账号 `codexapi17782688267245@weex.com` / UID `9010673441` 调用 `POST /v1/assets/transfer`，payload `{amount:110, fromAccountType:10, toAccountType:8, transferCoinId:"2"}`，HTTP 200 但业务返回 `20105 Operation failed. Try again.`，本次未完成合约到账验证。FIN 回查确认该 UID 有成功订单 `1436729135045914624`，金额 `110.00000000 USDT`，状态 `成功`。
- 已修复三个执行问题：`readFinAuth` 现在会轮询所有 FIN tab 并等待 localStorage token 写入，避免登录后多 tab/新 tab 误判；`fin-auth-check.mjs --wait-for-close` 在用户关闭登录页后强制切回 headless 复验，不再继续打开可见 FIN tab；`register-recharge-transfer-contract.mjs` 现在在单账号划转失败时保留 accounts、grants、transfers 完整结果，不再只输出单个错误。未重复创建新批次，避免重复充值。
- 本轮再次执行“创建10个账号 合约账户充110u”：前置检查通过，缓存 dry-run 命中 `register_recharge_transfer_contract`；真实执行创建 10 个 STG 账号并完成 10 笔 FIN 110 USDT 发放审核，订单号分别为 `1436732578007461888`、`1436732636937433088`、`1436732694781079552`、`1436732754134675456`、`1436732812271923200`、`1436732870455308288`、`1436732928470921216`、`1436732988294279168`、`1436733067096862720`、`1436733125947142144`。前端现货到合约划转成功 8 个账号；失败 2 个账号：`codexapi17782696618992@weex.com` / UID `4714521632`、`codexapi17782697455438@weex.com` / UID `2329983569`，首次返回 `20105`，单独重试返回 `70008 超出可划转的最大金额`。已更新 FIN 和前端通用失败复盘；未保存截图。
- 本轮执行“创建20个账号 合约划进去213u”：前置检查通过，FIN 登录态可用，缓存 dry-run 命中 `register_recharge_transfer_contract`；真实执行创建 20 个 STG 账号并完成 20 笔 FIN 213 USDT 发放审核。前端现货到合约划转初次成功 17 个账号；失败账号中 `codexapi17782702259001@weex.com` / UID `1760722353` 单独重试成功，最终成功 18 个账号。仍失败 2 个账号：`codexapi17782702560173@weex.com` / UID `8809513388`、`codexapi17782703026366@weex.com` / UID `9372870551`，重试返回 `70008 超出可划转的最大金额`。已更新 FIN 和前端通用失败复盘；未保存截图。
- 已按用户确认把 `register_recharge_transfer_contract` 改为单账号完整链路并发模型：每个账号内部顺序为前端注册 -> FIN 发放审核 -> 前端划转合约；多个账号默认按用户要求账号数量并发，最大并发 `100`，也可用 `--concurrency <N>` 覆盖但仍受 `100` 限制。已更新 FIN action cache、operation 文档和 `docs/workflows/frontend-fin-account-funding.md`；dry-run 和自然语言缓存命中验证通过，未执行真实写操作。
- 已按用户要求收紧 FIN 登录态与打开页面规则：用户登录并关闭 FIN tab 后，后续默认禁止自动打开任何 FIN tab/target；脚本先读已有 FIN tab，若没有 tab 则直接读 Chrome profile Local Storage 文件认证。只有显式登录恢复流程 `fin-auth-check.mjs --wait-for-close` 才允许临时打开可见 FIN 页面，用户关闭后继续回到无 tab/profile-auth 模式。
- 本轮执行“给我100个账号 邀请码8mja”：使用 STG 前端注册 API 并发创建账号，邀请码 `8mja`。首轮并发 100 成功 65 个，35 个在 `register/submit` 返回 `20105 Operation failed. Try again.`；随后补建 35 个账号并发 35 全部成功，最终累计 100 个账号创建成功。未保存截图，未输出或记录密码、token、cookie。
- 已按用户确认沉淀批量前端注册链路：新增 `skills/weex-frontend-ops/scripts/frontend-register-batch-api.mjs` 和缓存动作 `frontend_register_batch_api`，支持 `--count`、`--invite-code`、默认并发等于数量且最大 100、`20105` 等失败自动换新邮箱补建、可选 `--output-csv` 只写 `email,uid`。dry-run 和缓存入口验证通过。
- 近期后管转盘抽奖、报名模板、奖品管理、资产迁移和失败复盘历史已归档到 `docs/session-handoffs/`。

## 当前 Git 状态

- 当前分支：`dev`。
- 最近远端同步提交：`108d9de feat: add WEEX frontend ops skill`。
- 本轮 FIN Admin skill 拆分、`AGENTS.md` 规范更新、FIN 动作缓存迁移和交接摘要更新尚未提交。

## 后续接力建议

- 前端注册脚本已沉淀为 `frontend_register_api`；后续创建必须先 dry-run，真实执行必须显式传 `--confirm-register`。
- 前端注册脚本在 STG/test 环境输出完整邮箱；token、cookie、验证码和密码仍不得输出。本机配置只放在对应 skill 目录内的 `.env.local` 并保持未提交。
- 前端登录/注册认证链路例外已写入 `AGENTS.md`；后续前端认证默认使用已沉淀的 cookie/API 路径并验证最终登录页。
- 活动后台和 FIN Admin 写操作仍需按 `AGENTS.md` 先说明动作；高风险业务参数不得猜测。
- FIN Admin 真实发放/审核必须先运行 `skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs`；通过后再使用 `skills/weex-fin-admin-ops/scripts/run-cached-action.mjs` dry-run。创建需 `--confirm-create`，审核需 `--confirm-approve` 和 `skills/weex-fin-admin-ops/.env.local` 内的 `WEEX_FIN_GOOGLE_CODE`。如果用户已明确要求充值/发放且金额、币种、环境、目标账号/UID、审核方式明确，不需要再二次确认。
- FIN 可见页面只用于登录态失效恢复；登录页关闭后必须切回 headless/CDP/API 复验和执行业务，不能再打开可见 FIN tab 做普通验证或写操作。
- FIN 默认不再为了读取 localStorage 自动打开 headless target；如果没有 FIN tab 且 profile auth 可读，应直接通过 profile 文件认证继续。不要在普通 FIN 读写中设置 `WEEX_FIN_ALLOW_OPEN_TARGET=true`，该开关只给登录恢复流程使用。
- 后续批量“创建账号并充值”优先使用 `batch_register_recharge`：先 dry-run，再真实执行。STG/test 输出完整 email、UID、订单号和审核证据；脚本仍不得输出密码、验证码、token、cookie。
- 后续前端“现货划转合约”优先使用 `frontend_assets_transfer`：先运行 `node scripts/run-cached-action.mjs --action frontend_assets_transfer --dry-run`，确认目标账号、金额、币种 id 和账户类型后再加 `-- --confirm-transfer` 真实执行；当前还没有余额回查断言，跑通真实划转后应补充余额验证再标记为 verified。
- 后续“注册账号并让合约有 U / 转进合约 / 合约账户充 U”使用 `register_recharge_transfer_contract` 复合链路：先 dry-run，再真实执行注册、FIN 现货充值和前端划转合约；最终成功必须以前端划转业务码 `00000` 为准。面向用户的最终结果只输出 `用户名 / UID / 结果`，不展示 FIN 订单号；若划转失败，先报告失败账号和业务响应，不要重复创建新批次，优先做余额/账户类型回查或重试失败账号划转。
- 该复合链路现在默认账号级并发：多账号默认并发数等于账号数量，最大 `100`，也可传 `--concurrency <N>` 覆盖但仍受 `100` 限制。单账号内部不可并发，必须保持注册、审核、划转顺序。

## 安全说明

- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证。
- 截图仅在用户明确要求时保存。
