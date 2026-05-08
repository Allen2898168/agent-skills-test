# 前端账号入金到合约组合流程

## 当前结论

Status: candidate
Last updated: 2026-05-08

“创建账号并让合约账户到账指定 USDT”应作为复合链路处理：先注册 STG 前端账号，再通过 FIN Admin 发放到现货，最后用前端登录态调用资产划转接口从现货转入合约。

如果用户请求“合约账户充 110u”“转进合约”“合约有余额”等目标态：

- 先命中 `register_recharge_transfer_contract` 复合动作并 dry-run。
- 若请求中已明确账号数量、金额、币种和目标为合约到账，可执行复合链路；脚本仍必须传注册、充值和划转确认开关。
- 真实执行必须逐账号输出注册结果、FIN 发放订单、前端划转 payload 和业务响应。
- 最终回复面向用户只输出 `用户名 / UID / 结果`；FIN 订单号、payload 和详细接口响应只作为内部验证或交接/复盘需要记录，不在用户结果表中展示，除非用户明确要求。
- 如果前端划转失败，不要丢失已注册/已充值结果，不要重复创建新批次；先报告失败账号和响应码，再由用户决定是否重试划转或新建一批。

## 目标态识别

当用户说“注册一个账号转进合约 1000u”、“创建账号合约 1000u”、“新账号合约有 1000 USDT”或类似表达时，目标态是：

- 创建新的 STG 前端账号。
- 该账号最终在合约账户获得指定数量 USDT。

不要把这类请求理解为单独调用前端划转接口。新注册账号通常没有现货余额，直接划转会返回 `70008` / `超出可划转的最大金额`。

## 标准链路

标准顺序：

1. 前端注册：`skills/weex-frontend-ops/scripts/frontend-register-api.mjs`
2. FIN 充值现货：`skills/weex-fin-admin-ops/scripts/finance-airdrop-reward-grant.mjs`
3. 前端划转合约：`skills/weex-frontend-ops/scripts/frontend-assets-transfer.mjs`

注意：FIN 发放成功不等于合约已到账；最终成功必须以前端划转接口返回业务码 `00000` 为准。

批量执行时，以“单个账号完整链路”为并发单元。每个账号内部仍按注册、FIN 发放审核、前端划转的顺序执行；多个账号之间默认按用户要求的账号数量并发，最大并发数为 `100`。可以通过 `--concurrency <N>` 覆盖，但仍受最大 `100` 限制。

组合缓存动作：

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action register_recharge_transfer_contract --count 1 --amount 1000 --dry-run
```

并发执行示例：

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action register_recharge_transfer_contract --count 20 --amount 213 --confirm-register --confirm-recharge --confirm-transfer --allow-unverified-transfer-chain
```

真实执行必须显式传 `--confirm-register --confirm-recharge --confirm-transfer`；如果正在验证尚未完全稳定的链路，还需要 `--allow-unverified-transfer-chain`，并在最终结果中清楚标注每个阶段的验证依据。

## 输出规则

对用户的最终结果表固定只展示：

| 用户名 | UID | 结果 |
| --- | --- | --- |

- 用户名使用 STG/test 注册邮箱。
- UID 使用完整 STG/test UID。
- 结果写明 `合约划转成功` 或失败业务码/业务信息，例如 `失败：70008 超出可划转的最大金额`。
- 不展示 FIN 订单号；如需排障，可在交接记录或失败复盘中记录订单号。
- 不展示密码、验证码、token、cookie、fingerprint、签名或完整凭证。

## 默认参数

- 环境：STG。
- 币种：`USDT`。
- `transferCoinId`: `2`。
- 现货账户类型：`10`。
- 合约账户类型：`8`。
- FIN 发放业务：`空投奖励(产品化活动)` / `OTHER_ACTIVITIES`。

## 可替代目标

如果用户同意把目标改为“现货账户充值”，使用：

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action batch_register_recharge --count <N> --amount <AMOUNT> --dry-run
```

真实执行仍需显式注册和充值确认开关。输出新账号 email、UID、FIN 发放订单号、审核状态和回查证据；不输出密码、验证码、token、cookie、fingerprint 或签名。

## 自动维护规则

如果后续用户指出“合约入金”类 prompt 还有新的必要前置步骤、验证方式或异常处理，并且实际验证成功，必须按 `docs/workflows/compound-workflow-maintenance.md` 主动更新：

- 本 playbook。
- FIN 组合脚本和 action cache。
- 前端划转限制说明。
- 对应失败复盘和交接记录。
