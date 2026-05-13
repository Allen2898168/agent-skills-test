# 转盘 Kafka 回调任务失败复盘

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
