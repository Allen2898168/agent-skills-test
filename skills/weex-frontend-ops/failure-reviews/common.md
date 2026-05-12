# 通用失败复盘

本文件记录 WEEX 前端页面操作与检查中的通用问题。页面专属问题应拆到对应业务域文件。

## 待记录

- 暂无待补充失败。

## 活动页先访问后注入登录态导致验证不可靠

- 日期：2026-05-11
- 页面/流程：前端转盘抽奖活动页 `https://stg-www.weex.tech/zh-CN/events/draw/<活动别名>`
- 环境/viewport：STG，desktop `1440x1000`
- 失败表现：如果直接访问活动 URL 再处理登录态，页面可能停留在游客态、登录跳转态或非预期缓存状态；同时草稿活动 URL 即使可打开，也不能证明真实前端展示链路可用。
- 失败原因：转盘抽奖前端页是登录相关活动页，验证目标是已登录用户看到已上线活动；认证 cookie 必须在首个页面请求前进入浏览器上下文。后台草稿状态不是前端可参与/展示目标态。
- 解决方式：先通过前端 `loginTool` 生成并注入 `WEEX_TOKEN_COOKIE_STAGING`，再打开 draw URL；后台侧必须先把活动上线并回查状态 `ONLINE`。
- 验证结果：账号 `codexapi1778492089526@weex.com` / UID `7901867346` 注入登录态后，5 个已上线转盘抽奖活动页面均命中活动标题，无登录表单，token cookie 存在，无失败响应。
- 关联流程或脚本：`references/operations/draw.md`、`references/runtime-auth.md`、后台 `references/operations/activity-management-lottery.md`。
- 后续处理状态：已吸收到前端 draw 页面 playbook；后续同类验证必须先注入登录态再导航。

## 新注册账号直接划转合约余额不足

- 日期：2026-05-08
- 页面/流程：前端登录态接口 `POST https://stg-gateway2.weex.tech/v1/assets/transfer`
- 环境/viewport：STG，API-only，无页面 viewport
- 失败表现：新注册 STG 前端账号登录后执行 `amount=1000`、`fromAccountType=10`、`toAccountType=8`、`transferCoinId=2` 的划转，HTTP 200 但业务返回 `code=70008`、`msg=超出可划转的最大金额`。
- 失败原因：新注册账号现货账户没有足够可划转 USDT；前端划转接口只负责账户间划转，不会自动充值或发放资产。
- 解决方式：执行划转前必须先确保源账户类型 `10` 有足够余额；如需给 STG 测试账号充值，必须按 FIN Admin 流程另行确认并执行充值/发放，再回到前端划转接口重试。
- 验证结果：注册成功且账号页登录态验证通过；划转接口鉴权成功但因余额不足被业务拒绝。
- 关联流程或脚本：`scripts/frontend-register-api.mjs`、`scripts/frontend-assets-transfer.mjs`、缓存动作 `frontend_register_api`、`frontend_assets_transfer`
- 后续处理状态：已补充到前端认证/资产划转流程限制；后续“注册新账号并转进合约”的目标态请求由 FIN 侧 `register_recharge_transfer_contract` 复合链路处理：先注册、再 FIN 现货充值、最后调用前端划转，并以前端划转业务响应验证最终结果。

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

## FIN 发放后前端划转合约仍无可划转余额

- 日期：2026-05-08
- 页面/流程：组合动作 `register_recharge_transfer_contract` 的前端划转阶段。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：首个新账号 `codexapi17782672126781@weex.com` / UID `4845048042` 完成 FIN 500 USDT 发放订单后，前端划转 `fromAccountType=10 -> toAccountType=8` 先返回 `20105 Operation failed. Try again.`，稍后重试返回 `70008 超出可划转的最大金额`；改用 `fromAccountType=11` 仍返回 `70008`。
- 失败原因：FIN `空投奖励(产品化活动)` 成功订单不等价于前端资产划转接口可用的现货/资金可划转余额；该组合脚本把“FIN 发放到现货 -> 前端划转到合约”当作固定路径是不完整假设。
- 解决方式：不要把 FIN 发放成功单独视为合约到账；后续合约账户到账请求必须进入 `register_recharge_transfer_contract` 复合链路，并逐账号检查前端划转业务响应。
- 验证结果：FIN 资产总览显示首个 UID 有 `showBAssets=500.00000000`，但前端划转源账户类型 `10`、`11` 均不可划转到合约。
- 关联流程或脚本：`skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`、`scripts/frontend-assets-transfer.mjs`。
- 后续处理状态：已修正组合 playbook、FIN action cache 和前端划转说明；复合链路可执行但仍为 candidate，真实跑通前不得标记为 verified。

## 合约充值复合链路前端划转返回 20105

- 日期：2026-05-08
- 页面/流程：组合动作 `register_recharge_transfer_contract` 的前端划转阶段。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：账号 `codexapi17782688267245@weex.com` / UID `9010673441` 在 FIN 110 USDT 发放成功后调用 `POST https://stg-gateway2.weex.tech/v1/assets/transfer`，payload `{amount:110, fromAccountType:10, toAccountType:8, transferCoinId:"2"}`，HTTP 200 但业务返回 `code=20105`、`msg=Operation failed. Try again.`。
- 失败原因：前端划转接口业务侧拒绝；仅从该响应无法确认是余额延迟、源账户不可划转、风控或账户状态问题。
- 解决方式：组合脚本已改为保留每个账号的划转响应；后续应优先对失败账号做余额/账户类型回查或稍后重试划转，不要重复创建新批次。
- 验证结果：本次未完成合约到账验证；FIN 登录态读取误判已在 FIN skill 中修复。
- 关联流程或脚本：`skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`、`scripts/frontend-assets-transfer.mjs`。
- 后续处理状态：待补充余额回查断言和 `20105` 的稳定处理方式。

## 批量合约充值部分账号划转成功、部分账号余额不足

- 日期：2026-05-08
- 页面/流程：组合动作 `register_recharge_transfer_contract` 的前端划转阶段。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：执行“创建10个账号 合约账户充110u”时，10 个账号均注册成功且 FIN 110 USDT 发放审核通过；前端划转阶段 8 个账号返回 `code=00000`，2 个账号先返回 `20105 Operation failed. Try again.`，重试后返回 `70008 超出可划转的最大金额`。失败账号为 `codexapi17782696618992@weex.com` / UID `4714521632`、`codexapi17782697455438@weex.com` / UID `2329983569`。
- 失败原因：同一批 FIN 发放审核成功后，部分账号前端可划转余额未立即可用或业务侧未开放该源账户余额；单看 FIN 订单成功不能证明合约到账。
- 解决方式：组合链路保持逐账号输出 transfer 响应；失败账号只重试划转，不重复创建账号或重复充值。最终成功标准仍是前端划转业务码 `00000`。
- 验证结果：8/10 个账号划转合约成功；2/10 个账号未完成合约到账验证。
- 关联流程或脚本：`skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`、`scripts/frontend-assets-transfer.mjs`。
- 后续处理状态：需补充前端余额/可划转余额回查接口；在回查能力可用前，批量合约充值结果必须逐账号报告，不能只按 FIN 订单判断成功。

## 批量合约充值重试后仍有账号余额不足

- 日期：2026-05-08
- 页面/流程：组合动作 `register_recharge_transfer_contract` 的前端划转阶段。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：执行“创建20个账号 合约划进去213u”时，20 个账号均注册成功且 FIN 213 USDT 发放审核通过；前端划转初次 17 个账号返回 `00000 success`，3 个账号失败。单独重试后 `codexapi17782702259001@weex.com` / UID `1760722353` 成功，`codexapi17782702560173@weex.com` / UID `8809513388`、`codexapi17782703026366@weex.com` / UID `9372870551` 返回 `70008 超出可划转的最大金额`。
- 失败原因：FIN 发放审核成功后，部分账号前端源账户类型 `10` 的可划转余额仍不足或未及时可用；初次失败中也可能出现登录校验短暂 `20105`。
- 解决方式：保持只重试失败账号的前端划转，不重复创建账号或重复 FIN 发放；最终成功仍以前端划转业务码 `00000` 为准。
- 验证结果：最终 18/20 个账号划转合约成功；2/20 个账号未完成合约到账验证。
- 关联流程或脚本：`skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`、`scripts/frontend-assets-transfer.mjs`。
- 后续处理状态：仍需补充余额或可划转余额回查接口；补充前继续逐账号报告成功/失败，不按 FIN 订单成功推断合约到账。

## 批量前端注册高并发部分 20105

- 日期：2026-05-08
- 页面/流程：STG 前端注册 API 批量创建账号，邀请码 `8mja`。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：一次并发 100 个账号注册时，65 个成功，35 个在 `/v1/user/register/submit` 返回 `code=20105`、`msg=Operation failed. Try again.`。
- 失败原因：高并发注册提交存在后端短暂业务失败；失败账号未返回 UID，视为未创建成功。
- 解决方式：不重试同一邮箱，重新生成 35 个新邮箱并发补建；补建 35 个全部成功。
- 验证结果：最终累计创建 100 个 STG 测试账号成功；邀请码均使用 `8mja`。密码、token、cookie 未输出或记录。
- 关联流程或脚本：`scripts/frontend-register-api.mjs`，本次使用同注册 API 链路的临时批量 runner。
- 后续处理状态：适合沉淀批量注册脚本和动作缓存；沉淀时应支持默认并发等于账号数、最大 100，并在 `20105` 时自动补建缺口账号。

## loginTool 依赖外部本机路径导致同事不可复现

- 日期：2026-05-11
- 页面/流程：前端登录态、注册后 cookie 注入、前端资产划转。
- 环境/viewport：本地脚本配置检查，API-only。
- 失败表现：同事拉取项目后执行前端相关脚本提示 `loginTool not found`。
- 失败原因：`login-tool-adapter.mjs` 默认 fallback 到 `/Users/gabriel/Downloads/weexpr/loginTool`，这是个人机器路径，未随项目提交。
- 解决方式：已将最小 `loginTool` 运行时复制到 `skills/weex-frontend-ops/vendor/loginTool`，默认优先使用 skill 内置副本；`WEEX_FRONTEND_LOGIN_TOOL_DIR` 仅保留为可选覆盖。内置 `http.mjs` 改用 Node 原生 `fetch`，不再依赖外部 `node_modules`。
- 验证结果：`check-auth-config.mjs` 在无外部路径覆盖时可发现内置 `loginTool`；相关脚本语法检查通过。
- 关联流程或脚本：`scripts/lib/login-tool-adapter.mjs`、`vendor/loginTool/lib/weex-login.mjs`、`vendor/loginTool/lib/weex-auth-cookie.mjs`、`vendor/loginTool/lib/http.mjs`。
- 后续处理状态：固定路径已生效；后续新增外部工具必须放入对应 skill 或明确改为可选依赖。

## Playwright 依赖缺失导致前端/后管浏览器脚本不可运行

- 日期：2026-05-11
- 页面/流程：前端浏览器验证、活动后台浏览器自动化。
- 环境/viewport：本地 Node 运行环境。
- 失败表现：同事拉取项目后如果本机没有 Codex runtime 或全局 Playwright，浏览器脚本可能提示找不到 `playwright`。
- 失败原因：旧逻辑依赖本机外部 runtime 或人工安装，没有项目级 `package.json` 和自动安装路径。
- 解决方式：新增仓库根 `package.json`/`package-lock.json`，并在前端和后管 browser runtime 中加入自动依赖安装 helper；缺少 `playwright` 时默认执行 `npm install --no-audit --no-fund` 安装到项目内。
- 验证结果：语法检查通过；依赖解析走项目根 `package.json`，可用 `WEEX_AUTO_INSTALL_DEPS=false` 禁用自动安装。
- 关联流程或脚本：`package.json`、`skills/weex-frontend-ops/scripts/lib/dependencies.mjs`、`skills/weex-admin-ops/scripts/lib/dependencies.mjs`。
- 后续处理状态：固定路径已生效；新增 Node 依赖必须登记到根 `package.json`。

## 批量注册后账号页验证 DNS 失败但账号已创建

- 日期：2026-05-11
- 页面/流程：`register_recharge_transfer_contract` 内部调用 `frontend-register-api.mjs` 创建 STG 账号后打开 `/zh-CN/account` 验证。
- 环境/viewport：STG，注册为 API 路径，账号页验证为隐藏 Playwright 浏览器默认 desktop。
- 失败表现：30 并发创建账号时，多笔注册在 `page.goto https://stg-www.weex.tech/zh-CN/account` 返回 `net::ERR_NAME_NOT_RESOLVED`，导致单账号脚本没有输出 UID；但对应邮箱后续通过登录接口均可登录并取得 UID。
- 失败原因：注册 API 已成功返回 token/用户信息后，后置浏览器账号页验证依赖 `stg-www.weex.tech` DNS/页面可达性；高并发下该验证失败会把已创建账号误报为注册失败。
- 解决方式：不要按“注册失败”重复创建同邮箱或整批账号；先用登录接口按邮箱回查 UID，再继续 FIN 发放和前端划转。后续组合脚本应优先使用 `frontend-register-batch-api.mjs` 或为内部注册增加跳过页面验证的 API-only 模式。
- 验证结果：本次 17 个页面验证失败邮箱均可登录并取得 UID；最终 30 个账号均完成 20 USDT 合约划转，前端划转业务码均为 `00000 success`。
- 关联流程或脚本：`scripts/frontend-register-api.mjs`、`scripts/frontend-register-batch-api.mjs`、FIN `scripts/register-recharge-transfer-contract.mjs`。
- 后续处理状态：恢复路径已记录；待脚本固定化，避免后续高并发组合链路把页面验证失败误判为账号未创建。

## 小额合约充值初次划转 70008 后重试成功

- 日期：2026-05-11
- 页面/流程：组合动作 `register_recharge_transfer_contract` 的前端划转阶段。
- 环境/viewport：STG，API-only，无页面 viewport。
- 失败表现：执行“创建10个账号 每个账号给合约充10u”时，10 个账号均创建成功且 FIN 10 USDT 发放审核验证成功；首次前端现货到合约划转只有 2 个账号返回 `00000 success`，8 个账号返回 `70008 超出可划转的最大金额`。
- 失败原因：FIN 发放审核成功后，前端源账户类型 `10` 的可划转余额可能存在短暂延迟；初次划转失败不代表账号创建或 FIN 发放失败。
- 解决方式：不重复创建账号或重复 FIN 发放，只对返回 `70008` 的账号按原 payload 重试前端划转。
- 验证结果：8 个失败账号逐个重试后均返回 HTTP 200、业务码 `00000 success`；最终 10/10 个账号完成合约划转。
- 关联流程或脚本：FIN `scripts/register-recharge-transfer-contract.mjs`、`scripts/frontend-assets-transfer.mjs`。
- 后续处理状态：2026-05-11 再次执行“创建12个账号 合约划转10u”时复现该模式，初次 5/12 返回 `70008`，只重试失败账号后 12/12 均返回 `00000 success`。已吸收到 FIN 组合脚本固定路径：`register_recharge_transfer_contract` 对 `70008`/`20105` 默认短延迟重试 2 次，且只重试前端划转，不重复注册或 FIN 发放；初始执行并发仍遵守 FIN 组合链路默认规则。

## 转盘合约任务浏览器链路被报名资格和交易校验阻塞

- 日期：2026-05-11
- 页面/流程：前端转盘抽奖圆形转盘活动页到合约交易页，活动别名 `frontend-draw-round-20260511085251`。
- 环境/viewport：STG，可见 Chrome，desktop `1440x1000`。
- 失败表现：账号 `codexapi1778492089526@weex.com` / UID `7901867346` 注入登录态后打开活动页成功，点击 `立即报名` 弹出 `您无法参加该活动，请关注平台其他活动`；关闭弹窗后任务区仍显示 `合约交易 新用户冒烟1000 去交易 累计 0 合约交易量 ≥1,000 USDT × 1`。第一次兜底使用 `/zh-CN/futures/usdt/BTCUSDT` 返回 404；从页面 DOM 确认真正合约入口为 `/zh-CN/futures/BTC-USDT`。进入合约页后可见 `可用 1,000.0000 USDT`，切换 `市价`、数量输入 `5000`、点击 `买入开多` 后页面提示 `交易买入量不可小于最小买入量`，回活动页任务进度仍为 `累计 0`。
- 失败原因：报名资格被后台活动参与条件拒绝；合约页 `5000` 被填入 BTC 数量输入框，当前交易规则或行情状态下未形成有效市价委托。直接猜测旧式 futures URL 也不可靠。
- 解决方式：后续继续该链路时，应先确认活动参与资格或更换符合资格的账号；交易页入口使用页面导航或 `/zh-CN/futures/BTC-USDT`，不要使用 `/zh-CN/futures/usdt/BTCUSDT`。下单数量参数需要按页面当前数量单位和最小下单量重新确认。
- 验证结果：本次未完成报名和合约交易任务；只验证到登录态、活动页展示、合约任务可见、正确交易页可打开、合约账户余额 1,000 USDT 可见、市价按钮和买入开多按钮可点击。
- 关联流程或脚本：临时可见 Playwright 链路；前端 `references/operations/draw.md`。
- 后续处理状态：本次为链路探索，暂不沉淀为固定流程；若后续用合格账号和正确数量跑通，再更新 draw playbook、selector/component 和动作缓存。
