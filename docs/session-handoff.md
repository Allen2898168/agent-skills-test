# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 活动后台、FIN Admin 财务后台与前端页面操作自动化 skill、动作缓存、失败复盘、运行时依赖和首次配置检查。
- 活动后台权威 skill：`skills/weex-admin-ops/`，默认 staging：`https://stg-activity.weex.tech`。
- FIN Admin 权威 skill：`skills/weex-fin-admin-ops/`，默认 staging：`https://stg-admin-web-fin.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-13。
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

- 2026-05-13 已按“复制失败则重新创建、开赛时间 5 分钟后、活动名称/标题/副标题不超过 15 个字符”重新创建并上线转盘抽奖活动 ID `9095`。标题 `飞镖合约抽奖`（6 字符）、副标题 `5分后开赛`（5 字符），别名 `lottery-dart-5min-20260513112327`，抽奖样式 `飞镖转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间最终刷新为 `2026-05-13 19:32:10` 至 `2026-05-20 19:27:10`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`；上线前模型级刷新 `baseForm.form.startTime/endTime` 后 `PUT /prod-api/activity/config` 返回 `code=200`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 返回 `code=200`；详情回查 `status=ONLINE`、`stage=NOT_START`、`taskConfigIds=[4873]`。已把标题/副标题长度硬性规则写入 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`。
- 2026-05-13 已修复并上线转盘抽奖活动 ID `9093`：标题 `4分钟开赛飞镖合约转盘20260513110241`，别名 `lottery-4min-dart-contract-20260513110241`，抽奖样式 `飞镖转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间更新为 `2026-05-13 19:45:51` 至 `2026-05-20 19:15:51`。详情回查 `status=ONLINE`、`stage=NOT_START`、`taskConfigIds=[4873]`，任务为 `自动化测试-转盘-合约100-奖次1000-20260507`，`taskType=TRADING_VOLUME`，`requiredVolume=100`。本轮失败点：活动任务下拉选择后未落行、排序系数未填导致 `activityTaskForm=false`；编辑页只改可见日期输入未同步 `baseForm.form.startTime/endTime`，保存接口仍提交旧时间；按模型和可见输入同时更新后，`PUT /prod-api/activity/config` 与 `POST /prod-api/activity/lottery/online` 均返回 `code=200`。修复已写入 `skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs` 和后台复盘。
- 2026-05-13 已按用户纠正将 9046 转盘合约任务默认交易标的改为 BTC-USDT，要求新账号、浏览器模式、页面下单/页面平仓，不再使用 OpenAPI 下单。新前端账号 `codexapi17786669465371@weex.com` / UID `8377200673` FIN 发放审核 1100 USDT 成功但前端划转返回 `70008/20105`，未到账；新系统/API账号 `3447598495@weex.com` / UID `3447598495` FIN 发放审核 1100 USDT 成功，前端划转返回 `70011 划转处理中`，但 BTC 合约页仍显示 `可用 0.0000`、`保证金余额 0.0000 USDT`，因此未执行页面下单。旧账号 `7479616356@weex.com` 回查 9046 已完成 `taskId=4882`、`tradingVolume=1689.1317324`、`doTaskGetCount=1`，但不能作为本次新账号成功证据。复盘见 `skills/weex-frontend-ops/failure-reviews/draw-contract.md` 和 `skills/weex-fin-admin-ops/failure-reviews/common.md`。
- 2026-05-12 已按“重来 / 浏览器模式”重新创建并上线 6 分钟后开赛的转盘抽奖活动：活动 ID `9087`，标题 `6分钟开赛合约转盘20260512174523`，别名 `lottery-6min-contract-20260512174523`，抽奖样式 `圆形转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间 `2026-05-13 01:51:23` 至 `2026-05-20 01:51:23`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`，详情回查 `showBeginnerTaskConfig` 包含 `{ taskType: "TRADING_VOLUME", sorted: 2 }`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 返回 `code=200`，最终列表回查 `status=ONLINE`、`stage=NOT_START`。首次强制选择长任务名 `自动化测试-转盘-合约100-奖次1000-20260507` 时 `activityTaskForm=false` 未创建，重跑改用页面可用转盘任务并显式开启 `新手活动合约任务` 成功；失败复盘已写入 `skills/weex-admin-ops/failure-reviews/activity-management.md`。
- 2026-05-12 已按“浏览器模式 + 报名后交易才生效”在新活动 ID `9084`（alias `signup-trade-draw-20260512163959`）复现成功链路。账号 `7670579106@weex.com` / UID `7670579106` 在活动页点击 `立即报名` 后，网关请求 `apply` 返回 `code=00000`，`applyStatus=true`。随后用同账号 API 凭证下 ETHUSDT 市价多单（orderId `749122929354080954`），进入真实前端合约页 `https://stg-www.weex.tech/zh-CN/futures/ETH-USDT` 点击 `一键平仓` 并确认，仓位从 `仓位(1)` 变为 `仓位(0)`。回活动页刷新后，`/v1/activity/general/taskCompletions` 返回 `taskId=4882`、`status=COMPLETED`、`tradingCount=1`、`tradingVolume=3393.84`；`/v1/activity/general/raffle/frequency` 返回 `doTaskGetCount=1`。本次再次确认：该类任务必须先报名，且以活动任务接口回查为准，UI 文案可有延迟。
- 2026-05-12 已将上述链路沉淀到前端 skill：新增组合脚本 `skills/weex-frontend-ops/scripts/frontend-draw-signup-trade-close-verify.mjs`，动作缓存 `skills/weex-frontend-ops/scripts/action-cache.json` action `frontend_draw_signup_trade_close_verify`，并更新 `skills/weex-frontend-ops/references/operations/draw.md`、`skills/weex-frontend-ops/references/operations/index.md`、`skills/weex-frontend-ops/references/action-cache.md`。该动作支持 `--dry-run`、`--confirm-run`、`--visible`、`--task-id`，默认顺序固定为“先报名 -> API 开仓 -> futures 一键平仓 -> taskCompletions 回查”。
- 2026-05-12 已跑通活动 ID `9046` 足球射门转盘活动合约任务恢复链路：新建 API 账号 `9207496838@weex.com` / UID `9207496838` / 合约账号 ID `748964672547324474`，FIN 发放并审核 1100 USDT，前端现货到合约划转返回 `00000 success`。先用合约 Open API 下 ETHUSDT 多单，订单 `748965118397645370` 成交额 `1004.547478 USDT`，活动页仍未计入；随后在真实前端合约页处理持仓/订单新手引导，点击 `一键平仓` 并确认，`closeAllPosition` 返回 `SUCCESS`，平仓订单 `748968366269530682` 成交额 `1001.731270 USDT`。活动页刷新后显示 `可用次数：1`、累计 `1,001.73`，`taskCompletions` 返回 `status=COMPLETED`、`tradingVolume=1001.73127000000000`。失败/恢复复盘已写入 `skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-12 已完成“创建带 API 账号并下 10u ETH 多单”：FIN Admin 创建系统/API账号 `1752792315@weex.com` / UID `1752792315` / 合约账号 ID `748959187416908410`；生成的 API 密钥只保存在本机忽略目录 `generated/fin-system-accounts/fin-system-accounts-api-1-20260512T060305.*`。新账号初始合约余额为 0，先通过 FIN `空投奖励(产品化活动)` 给 UID `1752792315` 发放并审核 20 USDT，随后用该账号前端登录态执行现货到账户类型 `8` 合约账户划转，`/v1/assets/transfer` 返回 `00000 success`。用合约 Open API 按 ETHUSDT 最新价约 `2311.026875` 折算下单数量 `0.0043 ETH`，`POST /capi/v3/order` 返回成功，订单 ID `748959975606321786`。下单后余额回查：`balance=19.99661646`、`availableBalance=19.50004171`、`unrealizePnl=0.004558`。
- 该链路已沉淀为 FIN Admin 组合脚本 `skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs`，playbook `skills/weex-fin-admin-ops/references/operations/api-account-contract-order.md`，动作缓存 `create_api_account_fund_contract_order`。后续同类“创建带 API 账号并下合约单”请求应优先运行该脚本 dry-run，再按用户明确请求传入确认开关执行；短句 `创建个带api账号 下个10u eth多单` 已能命中该动作，脚本默认 `userType/remark=codex_api_order`。
- 2026-05-12 已通过用户可见 CDP 操作完整捕获 FIN Admin `系统账户管理` 创建带 API 账号链路：`POST /api/admin/fin/asset/system/account/add` -> 轮询 `add_progress` -> `temporary/list` 取回 UID、邮箱、合约账号 ID 与 API 三件套。已沉淀脚本 `skills/weex-fin-admin-ops/scripts/system-account-create.mjs` 和 playbook `skills/weex-fin-admin-ops/references/operations/system-account.md`；脚本复现创建 1 个 STG API 账号 `4163385380@weex.com` / UID `4163385380` / 合约账号 ID `748958173183869082`，并用生成的 API 三件套验证 `stg-api-contract` 私有余额接口 HTTP 200。含密钥结果只保存到本机忽略目录 `generated/fin-system-accounts/`，不写入 docs 或 skill。
- 2026-05-12 继续排查活动 `9046` 合约交易页链路：用户指出本地普通 Chrome 能正常加载订单簿并下单，Agent 之前使用 Playwright 隔离 profile 导致订单簿 WS/可开数量状态不完整。改用 CDP 后发现当前可连接的 9222 调试 Chrome 仍不是用户普通交易页 profile；连接该 profile 打开 `/zh-CN/futures/BTC-USDT` 可见余额但订单簿/可开数量仍不可用，未执行真实下单。已把“必须连接用户实际可用 CDP profile，不能用其他 9222 profile 替代”记录到 `skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-12 已按“前端流程 / 活动 ID 9046 / 浏览器模式”探索足球射门转盘活动合约交易任务：活动后台只读回查 `9046` 为 `ONLINE / IN_PROGRESS`，别名 `frontend-draw-football-20260511093107`，任务为合约交易量 `>=1000 USDT`，`taskUrlWeb=null`。新建并充值合约账号 `codexapi17785621110411@weex.com` / UID `5845940922`，FIN 1000 USDT 发放审核成功，前端现货到合约划转第 2 次返回 `00000 success`。可见 Chrome 打开活动页后登录态正常，页面无 `立即报名`（`isPreApply=0`），任务区显示累计 0；点击 `去交易` 未跳转，改用 `/zh-CN/futures/BTC-USDT`。合约页可见保证金余额 1000 USDT，但市价下单输入 `5000` 默认按 BTC 超出最大可开；切换数量单位到 USDT 后页面显示 `数量 ≈ Infinity`、`可开 0.0000 USDT`，点击 `买入开多` 仍被 `委托数量大于最大可开仓数量` 拦截，未发出下单接口；回活动页 `/v1/activity/general/taskCompletions` 返回 `completions: []`。阻塞已记录到 `skills/weex-frontend-ops/failure-reviews/common.md`，暂不沉淀固定流程。
- 2026-05-12 已完成“重新配置上线一个 10mins 后开始的转盘抽奖活动”：活动后台 staging 创建并上线活动 ID `9049`，标题 `10分钟后转盘抽奖20260512034826`，别名 `lottery-10min-20260512034826`，抽奖样式 `圆形转盘`，`是否支持预报名=不支持`，后台业务时区活动时间 `2026-05-12 11:58:22` 至 `2026-05-19 11:58:22`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`，上线接口 `POST /prod-api/activity/lottery/online` 返回 `code=200`，最终列表回查 `status=ONLINE`、`stage=NOT_START`。首次按本地 CEST 近未来时间提交被后端判定 `开始时间不可小于现在时间`，已把“近未来时间按后台 UTC+8 业务时区计算、无预报名分支不填预报名时间”记录到 `skills/weex-admin-ops/references/operations/activity-management-lottery.md` 和 `skills/weex-admin-ops/failure-reviews/activity-management.md`。
- 2026-05-11 已把转盘抽奖活动创建链路中的 `用户报名模版` 固定默认值沉淀到 `weex-admin-ops`：后续配置 `活动列表 / 转盘抽奖` 时，`用户报名模版` 默认固定选择 `2729` `【2729】 自动化报名模板_auto_manual_20260505161031`，不再按“第一个兼容模板”处理。已同步到脚本 `skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、计划文件 `skills/weex-admin-ops/scripts/business/activity-management/lottery-draft-plan.mjs`、操作文档 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`、关系和 defaults 文档。
- 2026-05-11 已完成“创建 3 个账号，合约划进去 213u”：`codexapi17785033381951@weex.com` / UID `3794362461`、`codexapi17785033381952@weex.com` / UID `9044888775`、`codexapi17785033381953@weex.com` / UID `2775257930` 已创建成功；3 笔 FIN `空投奖励(产品化活动)` 213 USDT 发放审核均成功。组合脚本首轮把前端子进程 warning 误记为 transfer 失败，随后按固定恢复思路只对 3 个账号单独补执行前端现货到合约划转，3/3 最终均返回 `00000 success`。复盘已写入 `skills/weex-fin-admin-ops/failure-reviews/common.md`。
- 2026-05-11 已按“重来 浏览器模式”重跑圆形转盘前端链路，账号 `codexapi1778492089526@weex.com` / UID `7901867346`，活动 `frontend-draw-round-20260511085251`，可见 Chrome desktop `1440x1000`。活动页登录态和展示正常；点击 `立即报名` 被资格弹窗拦截：`您无法参加该活动，请关注平台其他活动`。关闭弹窗后任务仍显示 `合约交易 新用户冒烟1000 去交易 累计 0 合约交易量 ≥1,000 USDT × 1`。正确合约交易入口确认为 `https://stg-www.weex.tech/zh-CN/futures/BTC-USDT`，旧猜测 `/zh-CN/futures/usdt/BTCUSDT` 返回 404。合约页可见 1,000 USDT 保证金余额；已切换 `市价`、数量输入 `5000`、点击 `买入开多`，页面提示 `交易买入量不可小于最小买入量`，回活动页任务进度仍为累计 0。阻塞已记录到 `skills/weex-frontend-ops/failure-reviews/common.md`，本次探索暂未沉淀固定流程。
- 2026-05-11 已完成“前端转盘抽奖 5 种抽奖样式展示验证”：创建前端账号 `codexapi1778492089526@weex.com` / UID `7901867346`；活动后台创建并上线 5 个转盘抽奖活动，样式分别为圆形转盘、飞镖转盘、彩蛋、环形跑马灯、足球射门，最终均为 `ONLINE`、`stage=NOT_START`。前端验证使用 desktop `1440x1000`，先注入该账号登录态再访问 `https://stg-www.weex.tech/zh-CN/events/draw/<alias>`；5 个页面均命中活动标题、无登录表单、token cookie 存在、无失败响应。已将“创建一个 -> 上线一个 -> 注入登录态验证一个”、彩蛋 `彩蛋类型` 必填、上线前活动时间校验等沉淀到 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`、`skills/weex-frontend-ops/references/operations/draw.md` 和对应失败复盘。
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
