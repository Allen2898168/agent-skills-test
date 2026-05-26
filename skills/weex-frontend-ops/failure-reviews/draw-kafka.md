# 转盘 Kafka 回调任务失败复盘

## 2026-05-25 MQ 充值回调发送成功但抽奖次数仍为 0

- 日期：2026-05-25
- 页面/流程：转盘活动页（STG）报名后，通过 FIN 动作缓存 `mq_recharge_callback_send` 发送充值回调，再回活动页验证 `可用抽奖次数`。
- 失败表现：回调脚本返回 `ok=true`、Kafka produce HTTP 200 且 messageId 可在列表中命中；但活动页刷新并等待 5 秒后 `drawCount` 仍为 `0`，未进入可抽奖状态，导致单抽用例无法继续。
- 可能原因：回调消息已送达但任务计数/抽奖次数生成存在延迟；或该活动绑定的“充值任务”与回调 bizType/bizSubType 不匹配；或需要额外条件（例如活动报名/任务完成回查接口轮询）才能刷新次数。
- 临时处理：把“次数变更”为必须断言；当 `drawCount` 未增长时，不要继续执行抽奖动作。可手动延长等待并轮询 `raffle/frequency` 或 `taskCompletions`（以真实网络响应为准），确认是否存在延迟完成。
- 验证信息：活动别名 `lf25085715`，账号 `8186595891@weex.com` / UID `8186595891`，amount `1000`。
- 关联流程或脚本：前端 `scripts/lottery-frontend-main-flow.mjs`（`recharge/full` 阶段）、FIN `scripts/run-cached-action.mjs --action mq_recharge_callback_send`。

## 2026-05-25 轮询抽奖次数时页面偶发变为未登录（guest）

- 日期：2026-05-25
- 页面/流程：转盘活动页（STG）报名后执行 `frontend_recharge_prepare`，发送 MQ 回调后轮询抽奖次数刷新。
- 失败表现：轮询过程中页面偶发进入 guest/未登录态（非显式登出），导致抽奖次数读取不稳定；需要重注入 cookie 并重开账号页后继续轮询。
- 临时处理：保持“未登录态检测 -> 重注入 cookie -> 重开页面”的自动恢复；若连续多次仍进入 guest，应优先检查前端域名跳转、cookie 作用域和当前账号登录态是否过期。
- 验证信息：报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_191737`，活动别名 `n29471800`；轮询中触发 5 次 guest 检测后恢复，最终 `drawCount` 刷新到 `110`。
- 关联流程或脚本：`skills/weex-frontend-ops/scripts/business/draw-kafka/flow.mjs`、`skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs`。
- 后续处理状态：已吸收到固定流程（当前链路内置最多 5 次重注入与重开重试）；如仍频繁出现，建议补充更细的网络证据（以真实网络响应为准）定位登录态丢失原因。

## 2026-05-25 100+ manifest 重跑时单抽接口返回系统繁忙

- 日期：2026-05-25
- 页面/流程：100+ manifest 全量入口中，前端 normal 活动完成报名和 MQ 充值后执行 `frontend_single_draw`。
- 失败表现：活动别名 `lf25154530`，充值后抽奖次数刷新到 `110`；点击单抽后产生一次抽奖请求，但接口返回业务 `code=50000`、`msg=系统繁忙，请稍后再试！`，未展示奖品弹窗，次数未扣减。
- 失败原因：当前证据指向抽奖接口服务端瞬时失败，不是奖品阶段超时修复引入的问题；本轮未继续改前端抽奖重试策略，避免把服务端失败误判为通过。
- 临时处理：保持单抽失败为真实失败；后续如要降低环境抖动，可对 `50000` 做短间隔重试，但必须确保只在未扣减次数、未产生中奖记录时重试。
- 验证信息：100+ manifest 重跑中后管 `PM-01`-`PM-07` 已通过，前端 `frontend_single_draw` 下 `FE-32`-`FE-35` 失败，奖励记录阶段被跳过。
- 补充复现：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs`（报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_180119`）中 normal 活动别名 `n24894463` 同样在单抽阶段返回 `code=50000`，导致 `FE-32`-`FE-35` 失败、奖励记录阶段跳过。
- 补充复现：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs`（报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_184100`）中 normal 活动别名 `n27275652` 同样在单抽阶段返回 `code=50000`，导致 `FE-32`-`FE-35` 失败、奖励记录阶段跳过。
- 补充复现：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "全部"`（报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_191737`）中 normal 活动别名 `n29471800` 同样在单抽阶段返回 `code=50000`，导致 `FE-32`-`FE-35` 失败、奖励记录阶段跳过。
- 关联流程或脚本：`orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs`、`skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs`。
- 后续处理状态：未吸收到固定流程；下一步如处理前端剩余失败，应先补安全重试或定位服务端 `50000` 原因。

## Kafka UI 提交按钮视口外导致普通点击失败

- 日期：2026-05-13
- 页面/流程：Kafka UI 向 `flink.exchange.spot_capital_order_info` 发送转盘活动任务回调消息。
- 环境/viewport：STG 内网 Kafka UI，可见 Playwright，desktop `1440x1000`。
- 失败表现：用户要求 Kafka 发送时只填写 Value；页面存在 Key、Value、Headers 多个输入区。填写 Value 后，`Produce Message` 按钮可能在视口外，普通 locator click 无法稳定触达。
- 失败原因：Kafka UI 表单高度超过当前视口，按钮在页面底部；只用可见 locator 点击容易受滚动位置影响。
- 解决方式：只填写第二个可见 textarea 作为 Value；保持 key/header 默认空值。提交前用页面上下文查找可见文本为 `Produce Message` 的按钮，`scrollIntoView` 后点击最后一个可见按钮。
- 验证结果：活动 `9099` / 别名 `zp3t0d` 的充值回调消息发送成功，HTTP 200，partition 0 offset 从 `4780` 增至 `4781`。
- 关联流程或脚本：临时可见 Playwright Kafka UI 链路；`references/operations/draw.md` 的 `Draw Task Completion By Kafka Callback`。
- 后续处理状态：已写入固定 playbook；若后续沉淀脚本，应把 Value textarea 定位和按钮点击抽为 Kafka UI helper。

## 回活动页验证时 loginTool 临时返回 20105

- 日期：2026-05-13
- 页面/流程：Kafka 回调后回到转盘活动页验证任务完成状态。
- 环境/viewport：STG 前端，可见 Playwright，desktop `1440x1000`。
- 失败表现：首次回活动页验证前，`loginTool verify-login` 返回 `20105 Operation failed. Try again.`，未能生成可用登录态。
- 失败原因：前端登录态生成接口存在短暂失败；该错误不代表 Kafka 回调未生效，也不代表活动任务失败。
- 解决方式：对 `20105` 执行短延迟重试，成功生成 cookie 后再打开活动页并轮询 `taskCompletions` 与 `raffle/frequency`。
- 验证结果：重试后账号 `codexapi1778683806339@weex.com` / UID `9224904392` 打开 `https://stg-www.weex.tech/zh-CN/events/draw/zp3t0d`，`taskCompletions` 返回充值任务 `taskId=4991`、`status=COMPLETED`，`frequency.doTaskGetCount=1`。
- 关联流程或脚本：前端 `loginTool` 登录态注入；`references/operations/draw.md` 的 `Draw Task Completion By Kafka Callback`。
- 后续处理状态：已写入固定 playbook；后续脚本化该链路时应内置 `20105` 登录态重试。

## 页面内直接 fetch 活动接口返回非 JSON Shell

- 日期：2026-05-13
- 页面/流程：Kafka 回调链路中，回活动页后用 `page.evaluate(fetch(...))` 直接请求 `applyStatus/taskCompletions`。
- 环境/viewport：STG 前端，可见 Playwright，desktop `1440x1000`。
- 失败表现：`page.evaluate` 抛出 `Unexpected token 'P', "Page is Not Found" is not valid JSON`，流程被中断。
- 失败原因：该链路下直接 page-context fetch 命中前端 shell/路由返回，不稳定地返回 HTML，而不是 JSON。
- 解决方式：改为监听页面真实网络响应（`/v1/activity/general/applyStatus`、`taskCompletions`、`raffle/frequency`）并据此判断任务完成，不再把 page-context fetch 作为主验证路径。
- 验证结果：活动 `9101` / 别名 `zp0513171053` 在新账号 `codexapi1778685384170@weex.com` / UID `3083326425` 下，`taskCompletions` 返回 `taskId=4991`、`status=COMPLETED`，`frequency.doTaskGetCount=1`。
- 关联流程或脚本：`scripts/frontend-draw-kafka-recharge-verify.mjs`。
- 后续处理状态：已吸收为固定执行路径。

## Kafka Value 输入区由 ACE 编辑器承载导致 textarea 定位失败

- 日期：2026-05-13
- 页面/流程：Kafka UI 回调发送步骤。
- 环境/viewport：STG 内网 Kafka UI，可见 Playwright，desktop `1440x1000`。
- 失败表现：旧脚本按 `textarea` 直接填值时提示 `kafka value textarea not found`。
- 失败原因：当前 Kafka UI 使用 ACE 编辑器承载输入，`textarea` 不是稳定业务输入入口；需先打开 produce modal 再写 ACE editor。
- 解决方式：固定为 `点击 Produce Message 打开弹窗 -> 定位可见 ACE editor -> 写入第二个 editor(Value) -> 点击弹窗内 Produce Message`。
- 验证结果：`POST /api/clusters/new-stg-kafka/topics/flink.exchange.spot_capital_order_info/messages` 返回 HTTP 200，随后活动页回查充值任务完成。
- 关联流程或脚本：`scripts/frontend-draw-kafka-recharge-verify.mjs`、`references/operations/draw.md`。
- 后续处理状态：已吸收为固定执行路径。

## 抽奖按钮文案变体导致“抽5次”定位失败

- 日期：2026-05-13
- 页面/流程：活动 `9101` 完成任务后执行抽奖按钮分支（`>5` 先抽5次，再抽1次）。
- 环境/viewport：STG 前端，可见 Playwright，desktop `1440x1000`。
- 失败表现：按固定文案 `抽5次/抽五次` 未命中按钮；首次脚本只执行了单次抽奖。
- 失败原因：页面真实文案是 `抽奖 × 5` 与 `抽奖 × 1`，与旧 selector 预期不一致。
- 解决方式：抽奖按钮改为“包含 `抽` 且包含 `5/五`”判定五连抽，“包含 `抽` 且不含 `5/五` 且含 `1/一`”判定单抽；同时记录可见按钮列表作为证据。
- 验证结果：账号 `codexapi1778688037137@weex.com` / UID `9500733879` 在活动页成功执行 `抽奖 × 5`，奖励弹窗点击 `确认` 关闭；随后执行 `抽奖 × 1` 并关闭弹窗。
- 关联流程或脚本：当前会话内可见浏览器抽奖执行脚本。
- 后续处理状态：已吸收为固定定位规则；后续抽奖操作不得再依赖单一固定中文文案。
