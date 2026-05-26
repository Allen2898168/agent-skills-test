# lottery-automation-capability-gap-v3-full-2026-05-25 - Part 1

Source archive split from `docs/workflows/archive/lottery-automation-capability-gap-v3-full-2026-05-25.md`.
Lines: 1-200 of 253.

# 抽奖活动回归自动化能力差距清单 v3

## 文档说明

- 适用范围：WEEX 转盘抽奖活动后管回归、前端落地页回归、专项回归的自动化能力建设。
- 目标口径：支持用户说“进行抽奖活动回归测试”后，先展示已登记场景菜单，再按用户选择执行单场景、多场景或全部回归。
- 当前状态：已具备菜单调度、后管主回归入口、前端主回归多阶段状态机入口；距离“整套抽奖活动后管 + 前端 + 专项全自动化回归”仍有剩余能力差距。

## 最终验收口径

后续只要满足这 6 条，就算达到目标：

1. 用户说“进行抽奖活动回归测试”时，系统固定先展示场景菜单。
2. 菜单只展示 manifest 中已登记场景，并标注可执行状态。
3. 用户可选择单场景、多场景、全部。
4. 调度器只执行用户选中的范围。
5. 每个场景执行前自动补齐对应前置条件。
6. 执行结束后输出场景级和 case 级结果明细。

## 当前能力状态总览

| 级别 | 能力项 | 当前状态 | 说明 |
| --- | --- | --- | --- |
| P0 | 场景菜单与选择机制 | 已完成 | `lottery-regression-dispatcher.mjs + lottery-regression-manifest.json` 已支持菜单、单选、多选、全部。 |
| P0 | 场景状态标记 | 已完成 | manifest 已区分 `ready / partial / planned / blocked`。 |
| P0 | “全部回归”边界 | 已完成 | 当前仅执行 manifest 中 `ready / partial` 且 `allowInAll = true` 的场景。 |
| P0 | 后管主回归入口 | 已完成 | `lottery_admin_main_regression` 已覆盖后管主链路并输出 case 级结果。 |
| P0 | 前端主回归入口结构 | 已完成 | `lottery_frontend_main_regression` 已从单阶段改成多阶段状态机入口。 |
| P0 | 主调度器长链路进度可见性 | 已完成 | `lottery-regression-dispatcher.mjs` 已改成流式透传子流程 stderr，fresh 主回归不再是黑盒等待。 |
| P0 | 前端主回归前置条件自动补齐 | 部分完成 | 复用已上线活动路径下，普通主回归已自动处理 `FRONTEND_SESSION / NORMAL_ACTIVITY_ONLINE / NORMAL_ACTIVITY_SIGNED_UP / NORMAL_ACTIVITY_DRAW_GE1 / REWARD_RECORD_DELAY_READY`；fresh 活动路径仍待补齐。 |
| P0 | 结果输出标准化 | 已完成 | 调度器已输出场景级 summary 与 case 级 `PASS / FAIL / SKIPPED / BLOCKED`。 |
| P0 | 编排版完整用例库 | 已完成 | 前端 84 条 case 已重构为 13 个编排包，形成编排版完整用例库。 |
| P0 | 主回归真实环境常态跑通 | 部分完成 | dry-run、单测、复用活动 alias 的 dispatcher 级真实样本已通过；fresh 活动自动创建链路仍待打通。 |
| P1 | 五连抽专项入口 | 未完成 | 尚未实现 `lottery_five_draw_regression`。 |
| P1 | 小库存专项入口 | 未完成 | 尚未实现 `lottery_low_stock_regression`。 |
| P1 | 二次权重专项入口 | 未完成 | 尚未实现 `lottery_weight_regression`。 |
| P1 | manifest 执行源切换到编排版用例库 | 未完成 | 当前编排版文档已完成，但 manifest 仍使用旧 scenario 组织。 |
| P1 | 前端展示/UI 覆盖扩面 | 未完成 | `FE-02 ~ FE-06`、多样式展示、更多奖励记录断言未接。 |
| P2 | 异常注入与容错 UI | 未完成 | 超时、失败、弱网、异常提示等还未形成稳定制造路径。 |
| P2 | 并发抢奖回归 | 未纳入当前范围 | 当前不做多账号并发。 |
| P2 | 普通概率大样本统计 | 未纳入当前范围 | 当前仅要求二次权重确定性校验。 |

## 当前已完成的关键进展

### 1. 前端主回归已多阶段化

当前 `lottery_frontend_main_regression` 已拆为 5 个阶段：

1. `frontend_readonly_checks`
2. `frontend_signup_flow`
3. `frontend_recharge_prepare`
4. `frontend_single_draw`
5. `frontend_reward_record`

已纳入的主回归首批 case：

1. 只读首屏：`FE-79 / FE-01 / FE-07 / FE-17 / FE-19`
2. 报名链路：`FE-81 / FE-82 / FE-83`
3. 充值补次：`FE-84 / FE-22`
4. 单抽事务：`FE-32 / FE-33 / FE-34 / FE-35`
5. 奖励记录：`FE-48 / FE-49 / FE-50`

补充：

1. `FE-21 / FE-24 / FE-26 / FE-28` 已接入真实执行链路。
2. `FE-26` 已按真实产品规则改口径为“抽奖旋转期间再次点击仍只生效一次”，不再错误要求按钮必须出现独立禁用态。

### 2. 普通前置条件已接入 auto-handled

当前 dispatcher dry-run 下，这些前置条件已经会被标记为自动处理：

1. `FRONTEND_SESSION`
2. `NORMAL_ACTIVITY_ONLINE`
3. `NORMAL_ACTIVITY_SIGNED_UP`
4. `NORMAL_ACTIVITY_DRAW_GE1`
5. `REWARD_RECORD_DELAY_READY`

当前仍未自动处理的前置条件：

1. `NORMAL_ACTIVITY_DRAW_GT5`
2. `WEIGHT_ACTIVITY_ONLINE`
3. `WEIGHT_ACTIVITY_DRAW_GE3`
4. `LOW_STOCK_ACTIVITY_ONLINE`
5. `LOW_STOCK_ACTIVITY_DRAW_GT5`
6. `ERROR_INJECTION_READY`
7. `RESPONSIVE_VIEWPORT_READY`

### 3. 编排版完整用例库已形成

前端 84 条 case 已全部完成编排，拆为 13 个编排包：

1. `P01` 普通活动-只读首屏与基础展示
2. `P02` 互斥状态专项-未登录/未开始/已结束
3. `P03` 样式展示专项-多样式活动
4. `P04` 报名链路事务组-未报名到已报名
5. `P05` 已报名零次数状态组
6. `P06` 充值补次与可抽奖次数状态组
7. `P07` 单抽事务组
8. `P08` 单抽后奖励记录闭环组
9. `P09` 五连抽专项
10. `P10` 小库存专项
11. `P11` 异常注入专项
12. `P12` 二次权重专项
13. `P13` 响应式与兼容性专项

## P0：距离总目标还差的能力

### 1. dispatcher 级真实环境常态跑通

当前状态：`部分完成`

已具备：

1. 菜单选择 -> dispatcher -> 主回归入口 -> 多阶段 plan
2. 前端主回归的 dry-run 已按阶段输出
3. 单测已覆盖 plan、resolver、dispatcher 协同
4. 复用在线活动 alias 的真实 dispatcher 样本已跑通，命令：
   `node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --selection "页面基础展示, 登录态 / 活动态 / 次数态, 单抽主流程, 我的奖品 / 奖励记录" --activity-alias lfd3040`
5. 当前真实样本结果：`selectedScenarioCount=4`，`PASS=12`，`SKIPPED=25`，已执行 PASS case 为 `FE-01 / FE-07 / FE-17 / FE-19 / FE-22 / FE-32 / FE-33 / FE-34 / FE-35 / FE-48 / FE-49 / FE-50`
6. fresh 活动创建链路已再次验证可真实创建草稿活动，最近一次验证样本：
   - 活动别名：`lf24124108`
   - 活动 ID：`9420`
   - 奖池、任务、多语言、FAQ、活动日历均已提交成功

还差：

1. 跑通 `fresh activity` 路径，而不是仅复用已存在活动 alias
2. 把 `FE-81 / FE-82 / FE-84` 这类依赖“新活动未报名/未发 MQ”初始态的 case 拉成真实 PASS
3. 沉淀一次 fresh 活动 dispatcher real-run 记录作为权威样本

验收标准：

1. 至少一轮真实执行可完成 `FE-79 / FE-81 / FE-82 / FE-83 / FE-84 / FE-22 / FE-32 / FE-33 / FE-34 / FE-35 / FE-48 / FE-49 / FE-50`
2. 输出中每条 case 都有对应 evidence

### 2. 普通主回归和编排版用例库仍未完全对齐到 manifest

当前状态：`部分完成`

已具备：

1. 编排版完整用例库已产出
2. 主回归入口已按新编排拆阶段

还差：

1. manifest 仍以旧的 scenario 粒度组织，而不是 `P01 ~ P13`
2. dispatcher 选择“场景”时，还不是直接按编排包做最小执行单元

验收标准：

1. manifest 中的前端执行源与编排版用例库保持一致
2. dispatcher 输出的执行单元与编排包一致

### 3. fresh 活动与专项前置条件自动补齐仍缺失

当前状态：`部分完成`

仍未自动处理：

1. fresh 活动从创建草稿 -> 上线 -> 前端未报名初始态的自动准备
1. `NORMAL_ACTIVITY_DRAW_GT5`
2. `WEIGHT_ACTIVITY_ONLINE`
3. `WEIGHT_ACTIVITY_DRAW_GE3`
4. `LOW_STOCK_ACTIVITY_ONLINE`
5. `LOW_STOCK_ACTIVITY_DRAW_GT5`

验收标准：

1. 用户选 fresh 报名链路、五连抽 / 小库存 / 二次权重时，调度器能自动识别并准备对应活动与次数前置

## P1：主链路稳定后补齐的能力

### 1. 五连抽专项入口

目标：

1. 实现 `lottery_five_draw_regression`
2. 覆盖 `FE-25 / FE-29 / FE-40 ~ FE-47`
3. 支持“五连抽按钮 > 请求 > 弹窗 > 扣 5 次 > 记录回查”

### 2. 小库存专项入口

目标：

1. 实现 `lottery_low_stock_regression`
2. 覆盖 `FE-23 / FE-45 / FE-46 / FE-57`
3. 支持“小库存模板活动自动准备 + 五连抽拦截提示校验”

### 3. 二次权重专项入口

目标：

1. 实现 `lottery_weight_regression`
2. 覆盖 `AC-14` 与 `FE-64 ~ FE-67`
3. 固化规则：若配置 `累计抽奖次数 N = 2` 且 `必中奖品 = 5`，则第 `3` 次抽奖命中奖品 `5`

### 4. 前端展示类 case 扩面

目标：