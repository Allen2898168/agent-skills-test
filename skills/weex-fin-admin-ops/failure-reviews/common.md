# FIN Admin 通用失败复盘

## 2026-05-08 FIN dry-run 缺少 CDP 页面目标
- 业务线：FIN Admin 脚本运行。
- 场景：迁移 FIN skill-local `.env.local` 后，执行 `finance-airdrop-reward-grant.mjs --dry-run` 验证非写入路径。
- 失败表现：脚本返回 `No CDP page target found at http://127.0.0.1:9222`，未进入 FIN 配置解析，未创建或审核订单。
- 失败原因：当前本机没有暴露 Chrome CDP 页面目标，或 Chrome 未以 remote debugging 端口启动。
- 解决方式：已把 CDP 启动和 FIN tab 恢复吸收到脚本固定路径：CDP 不可用时自动启动持久 Chrome profile；CDP 可用但 FIN tab 不存在时自动打开 FIN 页面。
- 验证结果：关闭 FIN tab 后重跑 dry-run，脚本自动重新打开 FIN 页面并完成配置解析；未创建或审核订单。
- 关联流程或脚本：`scripts/finance-airdrop-reward-grant.mjs`、`references/operations/finance-airdrop-reward.md`。
- 后续处理：固定路径已生效；如果 session 过期，脚本仍会停在登录态缺失错误，需要用户在持久 CDP Chrome 中重新登录。

## 2026-05-08 FIN 登录页等待关闭超时
- 业务线：FIN Admin 基础登录态验证。
- 场景：执行“创建 3 个账号并分别充值 1000 USDT”前，先运行 `fin-auth-check.mjs` 和 `fin-auth-check.mjs --wait-for-close` 做只读基础验证。
- 失败表现：基础验证返回登录态不可读；等待用户在持久 CDP Chrome 中处理 FIN 页面时，脚本返回 `Timed out waiting for FIN Admin page to close`，未创建账号、未创建或审核财务订单。
- 失败原因：FIN 页面在脚本等待窗口内未关闭，脚本无法确认人工登录/处理已完成。
- 解决方式：已将 `fin-auth-check.mjs --wait-for-close` 改为默认持续等待直到用户关闭 FIN 页面；仅手动传 `--timeout-ms` 时才限制等待时间。
- 验证结果：用户关闭 FIN 页面后复验通过，基础接口 `listSystemType` 可用。
- 关联流程或脚本：`scripts/fin-auth-check.mjs`、`scripts/finance-airdrop-reward-grant.mjs`。
- 后续处理：固定路径已生效，后续 FIN 登录态失效时应持续等待用户关闭页面后复验。

## 2026-05-08 FIN 自动新开页短暂停在 about:blank
- 业务线：FIN Admin CDP/API 发放脚本。
- 场景：关闭 FIN 页面后执行新建账号并充值，`finance-airdrop-reward-grant.mjs` 自动新开 FIN 页面读取登录态。
- 失败表现：首次发放前脚本返回 `Current FIN Admin CDP page storage is not readable at about:blank`；此前已创建 3 个前端账号，但未创建或审核 FIN 订单。
- 失败原因：自动新开 FIN tab 后只等待 1 秒，CDP target 已创建但页面主体仍在 `about:blank`，localStorage 暂不可读。
- 解决方式：已在 `readFinAuth` 中增加最多 45 秒轮询，等待页面实际加载到 FIN host 且 localStorage 可读后再读取 token。
- 验证结果：修复后 FIN 基础验证通过，并成功为后续 3 个新账号执行 1000 USDT 发放和审核。
- 关联流程或脚本：`scripts/business/finance-airdrop-reward/api.mjs`、`scripts/finance-airdrop-reward-grant.mjs`。
- 后续处理：固定路径已生效；如再次遇到页面加载慢，应优先调整该等待逻辑而不是要求用户重复登录。

## 2026-05-08 FIN 审核后已审核列表即时回查不稳定
- 业务线：FIN Admin 空投奖励审核验证。
- 场景：为 3 个新账号分别创建并审核 1000 USDT 发放订单。
- 失败表现：第 1 笔 `verifyPass` 返回成功，但紧接着查询已审核列表时 `approvedListHit=false`；补充执行 approve-only 时待审核列表未找到该订单。
- 失败原因：审核通过后的已审核列表即时查询可能存在索引或筛选延迟；仅依赖 `approvedListHit` 容易形成误判。
- 解决方式：已补强审核验证：当已审核列表未命中时，继续回查待审核列表；若订单已不在待审核列表，输出 `pendingListHitAfterApprove=false` 和 `approvalVerified=true` 作为补充证据。
- 验证结果：本次第 1 笔补查不在待审核列表；第 2、3 笔已审核列表即时命中。
- 关联流程或脚本：`scripts/business/finance-airdrop-reward/grant.mjs`。
- 后续处理：后续如需要更强资金到账证明，应增加账户资产余额回查接口，不只依赖订单列表。

## 2026-05-08 批量注册充值自然语言金额未解析
- 业务线：FIN Admin 动作缓存。
- 场景：为批量“创建账号并充值”脚本登记动作缓存后，执行 `run-cached-action.mjs --query '创建3个账号分别充值1000 USDT' --dry-run`。
- 失败表现：缓存命中 `batch_register_recharge`，但命令中缺少 `--amount 1000` 和 `--currency USDT`。
- 失败原因：动作缓存 matcher 只支持 `金额 1000`、`amount 1000` 等显式字段，没有覆盖 `1000 USDT` / `1000U` 的自然表达。
- 解决方式：已扩展 matcher，支持从 `<数字> USDT` 和 `<数字>U` 推断金额与币种；“创建/注册账号 + 充值/发放/下发”会自动推断 `--confirm-register` 和 `--confirm-recharge`。
- 验证结果：dry-run 命令已正确包含 `--count 3 --amount 1000 --currency USDT --confirm-register --confirm-recharge`，未创建账号或订单。
- 关联流程或脚本：`scripts/cache/matcher.mjs`、`scripts/batch-register-recharge.mjs`。
- 后续处理：固定路径已生效；后续新增自然语言格式时继续先 dry-run 校验命令。

## 2026-05-08 合约账户充值组合链路假设错误
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“注册 10 个新账号，合约账户充 500u”。
- 失败表现：组合动作先成功创建 10 个 STG 账号并完成 10 笔 FIN `空投奖励(产品化活动)` 500 USDT 订单，但首个账号后续前端划转合约失败。
- 失败原因：`空投奖励(产品化活动)` 发放成功不代表资金进入前端划转接口可用的源账户；FIN 合约资产发放接口 `/admin/fin/asset/contract/adjust/*` 当前账号返回 `403 No permission`，不能直接完成合约入账。
- 解决方式：暂停使用该组合动作做真实合约入账；需要新增有权限的 FIN 合约发放链路，或由用户提供可用的合约充值/发放入口。
- 验证结果：同批 10 笔 FIN 订单状态均为 `成功`；首个 UID `4845048042` 资产总览显示 `showBAssets=500.00000000`，但前端划转仍失败。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/batch-register-recharge.mjs`。
- 后续处理：该条旧结论已被 2026-05-08 后续用户纠正吸收到复合链路：合约到账请求应执行“注册 -> FIN 现货充值 -> 前端划转合约”，并以每个账号的前端划转业务响应作为最终验证；不得只做 dry-run 阻断。

## 2026-05-08 FIN 登录后多 tab/localStorage 读取误判
- 业务线：FIN Admin 基础登录态验证。
- 场景：执行“创建10个账号 合约账户充110u”的复合链路后，前端划转失败，随后回查 FIN 订单时发现 token 失效，脚本打开可见 FIN 页面要求登录。
- 失败表现：用户在弹出的 FIN 页面登录后，脚本又打开新 tab；用户回到原 tab 登录并关闭两个 tab 后，复验仍返回 `Current FIN Admin CDP page has no localStorage token`。
- 失败原因：`readFinAuth` 只等待页面进入 FIN host 且 localStorage 可读，未继续等待 token 写入；多 FIN tab 同时存在时还可能读取到未完成登录或刚打开的新 tab。
- 解决方式：已修改 `readFinAuth`，轮询所有 FIN host 页面，只有读到 `tokenPresent=true` 才返回；如果页面已加载但 token 尚未写入，会继续等待而不是立即失败。
- 验证结果：修复后 `fin-auth-check.mjs` 基础验证通过，`listSystemType` 可用。
- 关联流程或脚本：`scripts/business/finance-airdrop-reward/api.mjs`、`scripts/fin-auth-check.mjs`。
- 后续处理：固定路径已生效；后续登录态失效时才允许打开可见 FIN 页面。用户关闭登录页后，`fin-auth-check.mjs` 必须切回 headless 复验和执行业务，不得继续打开可见 FIN tab。

## 2026-05-08 合约充值复合链路失败结果被吞
- 业务线：FIN Admin 与前端组合动作。
- 场景：按用户纠正确认，“创建10个账号 合约账户充110u”应执行复合链路：注册账号、FIN 现货充值、前端划转合约。
- 失败表现：真实执行到前端划转阶段时，账号 `codexapi17782688267245@weex.com` / UID `9010673441` 调用 `POST /v1/assets/transfer` 返回 HTTP 200、业务码 `20105`、`Operation failed. Try again.`；组合脚本只输出该单个错误，未输出前面已注册和已充值的完整批次结果。
- 失败原因：组合脚本对单账号划转使用抛错中断，导致批量注册和 FIN 充值结果没有随最终 JSON 输出。
- 解决方式：已修改 `register-recharge-transfer-contract.mjs`，单个账号划转失败时记录该账号的 payload、response 和 error，并继续输出完整 accounts、grants、transfers。
- 验证结果：脚本语法检查通过；未重复创建账号验证，避免产生新的重复充值批次。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/batch-register-recharge.mjs`、前端 `frontend-assets-transfer.mjs`。
- 后续处理：后续复合链路失败时必须先报告已完成阶段和失败阶段，不得直接建议改成现货充值或重复创建新批次。

## 2026-05-08 批量合约充值部分前端划转失败
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“创建10个账号 合约账户充110u”，先注册 10 个 STG 前端账号，再通过 FIN `空投奖励(产品化活动)` 发放并审核 110 USDT，最后调用前端划转合约接口。
- 失败表现：10 笔 FIN 发放订单均 `approvalVerified=true`，但前端划转只有 8 个账号返回 `00000 success`；UID `4714521632`、`2329983569` 首次划转返回 `20105`，随后单独重试返回 `70008 超出可划转的最大金额`。
- 失败原因：FIN 发放审核成功只能证明 FIN 订单完成，不能证明前端划转源账户立刻具备足额可划转余额。
- 解决方式：已按固定规则保留完整 accounts、grants、transfers 输出，并只重试失败账号划转；不重复注册或重复发放。最终结果按前端划转业务响应逐账号判定。
- 验证结果：注册成功 10 个账号，FIN 审核通过 10 笔订单，合约划转成功 8 个账号，失败 2 个账号。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/batch-register-recharge.mjs`、前端 `frontend-assets-transfer.mjs`。
- 后续处理：需要补充余额或可划转余额回查接口，作为 `register_recharge_transfer_contract` 的失败账号诊断步骤；补充前不得将该复合链路标记为 verified。

## 2026-05-08 20账号合约充值前端划转部分失败
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“创建20个账号 合约划进去213u”，先注册 20 个 STG 前端账号，再通过 FIN `空投奖励(产品化活动)` 发放并审核 213 USDT，最后调用前端划转合约接口。
- 失败表现：20 笔 FIN 发放订单均 `approvalVerified=true`，前端划转初次成功 17 个账号；失败账号中 UID `1760722353` 单独重试成功，UID `8809513388`、`9372870551` 重试返回 `70008 超出可划转的最大金额`。
- 失败原因：FIN 发放审核成功只能证明 FIN 订单完成，不能证明前端划转源账户立刻具备足额可划转余额；同批账号仍可能出现部分可划转、部分余额不足。
- 解决方式：只重试失败账号的前端划转，不重复注册或重复发放；最终结果按前端划转业务响应逐账号判定。
- 验证结果：注册成功 20 个账号，FIN 审核通过 20 笔订单，合约划转成功 18 个账号，失败 2 个账号。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/batch-register-recharge.mjs`、前端 `frontend-assets-transfer.mjs`。
- 后续处理：需要补充余额或可划转余额回查接口，作为 `register_recharge_transfer_contract` 的失败账号诊断步骤；补充前不得将该复合链路标记为 verified。

## 2026-05-11 FIN 登录恢复后基础接口仍提示非法 Token
- 业务线：FIN Admin 基础登录态验证。
- 场景：执行“创建20个账号 合约划进去213u”前，先运行 `fin-auth-check.mjs` 检查持久 CDP/profile 登录态。
- 失败表现：首次基础检查返回 `loginRequired=true`，基础接口提示 `非法Token,请登录`；随后执行 `fin-auth-check.mjs --wait-for-close` 进入登录恢复，但复验返回 `fetch failed`，再次基础检查仍提示 `非法Token,请登录`。未执行 dry-run、未创建账号、未创建或审核 FIN 订单、未发起前端划转。
- 失败原因：当前 FIN 持久登录态不可用，登录恢复未成功写回可通过基础只读接口验证的有效 token；`fetch failed` 可能来自登录恢复期间 CDP/网络短暂不可用。
- 解决方式：按固定流程要求用户重新打开登录恢复页，完成 FIN 登录后关闭 FIN 页面，再重新运行基础检查；基础检查通过前不得执行缓存 dry-run 或真实写操作。
- 验证结果：本次未通过基础验证，任务阻塞在 FIN 登录态准备阶段。
- 关联流程或脚本：`scripts/fin-auth-check.mjs`、`scripts/register-recharge-transfer-contract.mjs`。
- 后续处理：用户确认重新尝试后，先运行 `fin-auth-check.mjs --wait-for-close`，由该流程主动打开持久 CDP Chrome 并等待用户登录后关闭 FIN 页面；不得改为手动打开普通 Chrome。若复验通过，再执行 `register_recharge_transfer_contract` dry-run 和真实复合链路。
- 追加记录：同日多次执行“创建20个账号 合约划进去213u”时，前端配置和 FIN/前端 `.env.local` 必需项存在；FIN 基础检查仍返回 `非法Token,请登录`，登录恢复后仍返回 `fetch failed`，二次基础检查仍为非法 Token。未执行 dry-run、未创建账号、未发放或划转。
- 追加修复：确认根因之一是 `fin-auth-check.mjs --wait-for-close` 进入登录恢复后没有显式校验 FIN 页面是否真的打开；若 `readFinAuth` 先读到 profile 中的旧 token，可能直接复验失败而没有产生可见 FIN 页面。已新增 `openVisibleFinLoginPage`，恢复流程现在会强制打开可见 FIN 页面并验证 CDP target 包含 `stg-admin-web-fin.weex.tech`，否则直接报错，不再进入假等待。
- 追加修复：FIN 发放、批量充值和合约充值脚本已接入 `ensureFinAuthReady`，当登录态缺失时会自动打开持久 CDP FIN 登录页并等待用户关闭后复验；基础验证通过后继续原写操作，不再要求操作员手动把 `loginRequired=true` 转成恢复命令。

## 2026-05-11 30账号合约充值高并发 FIN fetch 失败后补齐成功
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“创建30个账号 然后合约划转进去20u”，目标态为 30 个 STG 新账号各收到 20 USDT 并完成现货到合约划转。
- 失败表现：`register_recharge_transfer_contract --count 30 --amount 20` 高并发执行时，30 个账号实际均已创建；但多笔 FIN grant 子进程在 dry-run/发放阶段返回 `fetch failed`，仅 UID `3825489432`、`1362655258` 完成 FIN 发放审核；两账号首次前端划转返回 `70008 超出可划转的最大金额`。
- 失败原因：30 并发下前端注册后的页面验证出现 DNS 失败，FIN grant 子进程并发读取/恢复 CDP auth 时出现 fetch 失败和可见 FIN 页面等待关闭；FIN 审核成功后前端可划转余额也存在短暂延迟。
- 解决方式：不重复创建账号；先用前端登录接口按邮箱回查页面验证失败账号的 UID，再对未发放的 28 个 UID 顺序执行 `finance-airdrop-reward-grant.mjs --confirm-create --confirm-approve`，最后对 30 个账号顺序执行 `frontend-assets-transfer.mjs --confirm-transfer --amount 20 --from-account-type 10 --to-account-type 8 --transfer-coin-id 2`。
- 验证结果：30 个账号均可登录并取得 UID；30 笔 FIN 20 USDT 发放审核均 `approvalVerified=true`；30 次前端划转均 HTTP 200、业务码 `00000 success`。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/finance-airdrop-reward-grant.mjs`、前端 `scripts/frontend-assets-transfer.mjs`。
- 后续处理：已修复子进程可见登录恢复问题：复合脚本和批量充值脚本启动时只做一次 FIN 登录态准备，随后设置 `WEEX_FIN_DISABLE_VISIBLE_RECOVERY=true`，FIN grant 子进程只复用登录态，不再自行打开可见 Chrome。高并发组合链路失败时固定恢复路径为“回查 UID -> 只补未发放账号 -> 顺序重试划转”；不得重复创建整批账号或重复给已发放 UID 充值。后续仍应把组合脚本改为注册阶段使用批量 API 或增加 `--skip-account-page-verify`。

## 2026-05-11 10账号合约充值初始执行误降并发
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“创建10个账号 每个账号给合约充10u”时，操作员在真实初始执行命令中手动传入 `--concurrency 1`。
- 失败表现：业务最终完成，但初始执行没有遵守 `register_recharge_transfer_contract` 默认并发规则；用户指出应默认并发，除非用户明确要求顺序。
- 失败原因：操作员受此前高并发失败复盘影响，把“失败恢复阶段可顺序补发/重试划转”的策略错误提前用于初始执行。
- 解决方式：已将组合链路说明和 action-cache 明确更新为：初始执行默认并发等于账号数量，禁止无用户要求时降低并发；只有用户明确要求顺序，或已出现部分失败并保留账号/发放状态后的恢复步骤，才使用顺序执行。
- 验证结果：本次 10 个账号均创建成功，10 笔 FIN 10 USDT 发放审核验证成功；初次前端划转 2 个成功、8 个返回 `70008`，随后只对 8 个失败账号重试划转，全部返回 `00000 success`。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`references/operations/finance-airdrop-reward.md`、`references/action-cache.md`。
- 后续处理：已吸收到固定流程；后续类似请求初始命令不传 `--concurrency`，恢复阶段才按失败账号顺序处理。2026-05-11 再次执行 12 个账号 10 USDT 合约划转时复现初次 `70008`，只重试 5 个失败账号后 12/12 成功；已进一步把 `70008`/`20105` 短延迟重试内置到 `scripts/register-recharge-transfer-contract.mjs`，默认只重试前端划转，不重复注册或 FIN 发放。

## 2026-05-11 3账号合约充值组合脚本将前端子进程 warning 误记为失败
- 业务线：FIN Admin 与前端组合动作。
- 场景：执行“创建 3 个账号，合约划进去 213u”，按固定链路运行 `register_recharge_transfer_contract`。
- 失败表现：3 个账号均已创建成功，3 笔 FIN 213 USDT 发放审核均成功；但组合脚本在前端划转阶段把每个账号都记为失败，`transfer.response=null`，错误内容只有 Node 输出的 `NODE_TLS_REJECT_UNAUTHORIZED=0` warning。
- 失败原因：组合链路对子进程失败信号的处理不够稳健；本次前端划转实际可单独成功执行，但组合脚本记录为 transfer 失败，导致主结果误判。
- 解决方式：不重复注册或 FIN 发放，直接对已创建账号逐个单独执行 `skills/weex-frontend-ops/scripts/frontend-assets-transfer.mjs --confirm-transfer --amount 213 --from-account-type 10 --to-account-type 8 --transfer-coin-id 2` 补划转。
- 验证结果：账号 `codexapi17785033381951@weex.com` / UID `3794362461`、`codexapi17785033381952@weex.com` / UID `9044888775`、`codexapi17785033381953@weex.com` / UID `2775257930` 单独划转均返回 HTTP 200、业务码 `00000 success`。
- 关联流程或脚本：`scripts/register-recharge-transfer-contract.mjs`、`scripts/business/contract-funding/commands.mjs`、前端 `scripts/frontend-assets-transfer.mjs`。
- 后续处理：后续应继续排查组合脚本对子进程 stderr/warning 与真实退出状态的判定，避免把可恢复 warning 误记为 transfer 失败；在修复前，出现同类结果时固定恢复路径为“保留已创建账号和已审核发放，只单独补前端划转”。
