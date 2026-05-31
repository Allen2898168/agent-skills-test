# 活动任务管理失败复盘

## 2026-05-04 混合奖励保存失败
- 业务线：活动任务管理。
- 场景：新增 `转盘抽奖 / 混合奖励` 活动任务。
- 失败表现：`POST /prod-api/activity/task` 返回 HTTP 200，但页面提示 `system busy, please retry later` 和 `保存任务失败`，按任务别名搜索无结果。
- 失败原因：后端业务处理失败，不能以 HTTP 200 判定创建成功。
- 解决方式：标记为阻断，等待开发修复后重新验证；成功判断必须包含业务响应、toast/message 和列表回查。
- 验证结果：当前未走通，未创建任务。
- 关联文件：`references/operations/activity-task-roulette-reward-modes.md`。
- 后续处理：开发修复后重新跑该链路，并更新 skill 与复盘。

## 2026-05-04 首次登录 APP 奖励类型不匹配
- 业务线：活动任务管理。
- 场景：创建 `转盘抽奖 / 首次登录APP / 单一奖励`。
- 失败表现：接口响应 `code=500`，提示 `任务奖品只能选择合约抵扣金`。
- 失败原因：该任务条件有后端奖品类型限制，默认抽奖次数奖品不适用。
- 解决方式：后续创建该任务条件时必须选择合约抵扣金奖品。
- 验证结果：本轮未重跑成功。
- 关联文件：`references/operations/activity-task-roulette-conditions.md`。
- 后续处理：重跑成功后把限制前置到创建脚本或默认选择逻辑。

## 2026-05-05 新老现货划转任务业务唯一性限制
- 业务线：活动任务管理。
- 场景：创建 `转盘抽奖 / 新老现货划转任务 / 单一奖励`。
- 失败表现：接口响应 `code=500`，提示 `新老划转任务重复，已配置新老划转任务的编号是:964`。
- 失败原因：后端存在同类任务唯一性限制。
- 解决方式：除非复用、修改或删除已有编号 `964` 的任务，否则不能继续创建新的同类任务。
- 验证结果：本轮未创建新任务。
- 关联文件：`references/operations/activity-task-roulette-conditions.md`。
- 后续处理：创建该类型前必须先查询是否已有配置。

## 2026-05-28 clone 任务时 linkTaskId 绑定冲突（人人代理活动）
- 业务线：活动任务管理。
- 场景：按活动类型筛选模板任务后 clone 创建“最小配置任务”（无头 API）。
- 失败表现：`POST /prod-api/activity/task` 返回 `code=500`，提示 `被邀请任务已被任务编号：6039绑定`（或同类文案）。
- 失败原因：`INVITE_FRIEND` 模板任务通常带 `linkTaskId` 指向一条 `INVITED` 被邀请任务；直接 clone 会复用同一个被邀请任务，触发后端“一对一绑定”校验。
- 解决方式：当模板含 `linkTaskId` 时，先 clone 创建新的 `INVITED` 被邀请任务，再创建 `INVITE_FRIEND` 邀请任务并把 `linkTaskId` 指向新建任务；清理时需要删除两条任务。
- 验证结果：已沉淀到脚本，待在 staging 跑 `verify-nonlottery-api-full-config-staging.mjs --only agent` 验证 min/full/cleanup 闭环。
- 关联文件：`scripts/create-agent-invite-task-fast-api.mjs`、`scripts/create-agent-full-config-explicit-deps-fast-api.mjs`。

## 2026-05-31 大富翁每日骰子任务“从零创建”接口返回 system error
- 业务线：活动任务管理。
- 场景：用于 MONOPOLY_WORLD_CUP 的“每日合约交易量→发骰子”任务，尝试用最小 payload 直接 `POST /prod-api/activity/task`（不 clone 模板）。
- 失败表现：业务响应 `code=500`，`msg=system error`。
- 失败原因：payload 缺少后端依赖字段（如 `conditions`、`labelDescI18`、以及更完整的 `taskAward` 结构），触发后端空指针/反序列化异常。
- 解决方式：按已存在的大富翁 DAILY/TRADING_VOLUME 任务结构补齐缺省字段（但仍保持“从零构造 payload”），并把 `requirement.isMultiplierCoupon` 设为 `0`。
- 验证结果：修复后该任务可稳定创建并回查；用于通用回归脚本 `regression-monopoly-worldcup-universal-from-scratch.mjs` 已跑通并可清理。
- 关联脚本：`skills/weex-admin-ops/scripts/create-monopoly-worldcup-daily-dice-task-from-scratch-fast-api.mjs`。

## 2026-05-31 小丑牌 INVITE_FRIEND 任务“从零创建”字段缺省风险
- 业务线：活动任务管理。
- 场景：用于 FLIP 通用回归脚本，新增 `INVITE_FRIEND` 任务并绑定虚拟奖品（FLIP_CARD/FLIP_INTEGRAL）。
- 风险点：`POST /prod-api/activity/task` 对 INVITE_FRIEND 的字段容忍度低（如缺少 `conditions.allowRangeLogic`、`labelDescI18`、或 `taskAward.invitePrizeId` 等），可能触发 `code=500 system error`。
- 固定路径：按已存在 FLIP 任务结构补齐 `conditions.allowRangeLogic=\"UNION\"`、完整 `taskAward`（含 invite* 字段）与基础 i18n 字段；保持 payload 由脚本显式构造（不 clone 模板）。
- 验证结果：`skills/weex-admin-ops/scripts/regression-flip-universal-from-scratch.mjs` 已跑通创建/校验/清理闭环。
- 关联脚本：`skills/weex-admin-ops/scripts/create-flip-invite-task-from-scratch-fast-api.mjs`。
