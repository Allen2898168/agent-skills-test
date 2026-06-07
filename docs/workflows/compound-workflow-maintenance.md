# 复合链路自动沉淀规则

## 触发条件

当出现以下情况，并且用户给出的解决方案随后验证成功时，必须主动沉淀：

- agent 只调用了单个 skill，但用户目标需要多个 skill 组合。
- agent 把目标态误解成单个接口或页面动作。
- 缺少必要前置步骤，例如先充值再划转、先创建配置再检查前端展示。
- 用户指出“应该分别调用已有能力完成需求”或给出可泛化的组合顺序。

## 必做更新

1. 更新相关 skill 的 operation playbook。
2. 如果可复用且参数化成本合理，新增或更新组合脚本。
3. 更新 `scripts/action-cache.json` 和自然语言 matcher，让类似 prompt 能直接命中组合链路。
4. 更新失败复盘，记录错误理解、用户纠正、最终固定路径和验证结果。
5. 更新 `docs/session-handoff.md`，只保留摘要和文件路径，不重复粘贴完整流程。

## 复合链路文档字段

- 目标态：用户最终想看到的业务结果。
- 触发话术：容易出现的自然语言表达。
- 参与 skill：每一步使用哪个 skill。
- 标准顺序：按执行依赖排列。
- 前置条件：登录态、余额、配置、审核、验证码等。
- 确认开关：所有写操作对应的确认参数。
- 验证依据：接口 code、页面状态、订单回查、余额回查、截图等。
- 失败回退：失败时先查哪个复盘或回退到哪条链路。

## 已沉淀示例

- `docs/workflows/frontend-fin-account-funding.md`
- `skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs`
- FIN action cache: `register_recharge_transfer_contract`
