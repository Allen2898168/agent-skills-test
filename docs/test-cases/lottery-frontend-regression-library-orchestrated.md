# 转盘抽奖活动前端回归用例库（编排版）

## 文档说明

- 适用范围：WEEX 转盘抽奖活动前端落地页回归。
- 当前目标：基于 `前端回归 Case 状态污染矩阵`，把 84 条前端 case 重构为可执行编排库。
- 当前原则：先定义正确的 `执行顺序 / 共享链路 / 互斥场景 / 专项活动`，再进入自动化落地。
- 当前口径：本文件是 `编排版完整用例库`；详细步骤、原始预期仍以 `docs/test-cases/lottery-frontend-regression-cases.md` 为准。
- 用例分类与执行边界：`docs/workflows/lottery-regression-case-classification-v1.md`

## 一、编排总览

前端 84 条 case 已全部纳入编排，无遗漏、无重复。

| 类型 | 编排包数 | case 数 |
| --- | ---: | ---: |
| 普通主回归共享链路 | 8 | 45 |
| 互斥/多活动专项 | 5 | 39 |
| 合计 | 13 | 84 |

主回归链路执行顺序：

1. `P01` 普通活动-只读首屏与基础展示
2. `P04` 报名链路事务组-未报名到已报名
3. `P05` 已报名零次数状态组
4. `P06` 充值补次与可抽奖次数状态组
5. `P07` 单抽事务组
6. `P08` 单抽后奖励记录闭环组

必须拆开的专项：

1. `P02` 互斥状态专项-未登录/未开始/已结束
2. `P03` 样式展示专项-多样式活动
3. `P09` 五连抽专项
4. `P10` 小库存专项
5. `P11` 异常注入专项
6. `P12` 二次权重专项
7. `P13` 响应式与兼容性专项

## 二、执行规则

核心规则：

1. `FE-81 -> FE-82 -> FE-83` 是同一条报名状态链路，不能颠倒顺序。
2. `FE-84` 必须在 `已报名且充值任务未完成` 场景执行，不与 `FE-81` 共用未报名初始态。
3. `FE-32 ~ FE-35` 属于单抽事务组，共用一次真实单抽动作。
4. `FE-36 / FE-37 / FE-50 / FE-52 ~ FE-56` 必须承接单抽成功后的奖励记录回查。
5. `FE-80` 与 `FE-81` 时间态互斥，必须拆到不同活动时间窗口。
6. `FE-25 / FE-29 / FE-40 ~ FE-47` 是五连抽链路，不混入普通单抽主回归。
7. `FE-23 / FE-45 / FE-46 / FE-57` 必须绑定小库存专项活动。
8. `FE-64 ~ FE-67` 必须绑定二次权重专项活动。

状态类型说明：

- `只读`：不改变报名态、次数态、记录态、库存态。
- `只读交互`：会点按钮或开弹窗，但不改变业务状态。
- `状态断言`：只读检查某个业务状态。
- `状态迁移`：执行后会改变报名态或次数态。
- `单抽事务 / 五连抽事务 / 库存事务 / 权重事务 / 异常事务`：执行后会改变后续可执行条件。

## 三、编排包总表

| 编排包 | 包名称 | case 数 | 是否主回归 | 是否需要 Fresh | 说明 |
| --- | --- | ---: | --- | --- | --- |
| `P01` | 普通活动-只读首屏与基础展示 | 23 | 是 | 否 | 在线活动的只读与轻交互检查 |
| `P02` | 互斥状态专项-未登录/未开始/已结束 | 4 | 否 | 是 | 时间态/登录态互斥 |
| `P03` | 样式展示专项-多样式活动 | 7 | 否 | 否 | 多活动样式展示，不消费状态 |
| `P04` | 报名链路事务组-未报名到已报名 | 3 | 是 | 是 | 主链路第一段，消耗未报名态 |
| `P05` | 已报名零次数状态组 | 1 | 是 | 否 | 承接报名后、充值前 |
| `P06` | 充值补次与可抽奖次数状态组 | 3 | 是 | 部分是 | 由 0 次推进到可抽奖 |
| `P07` | 单抽事务组 | 7 | 是 | 否 | 单抽请求、弹窗、扣次、防重 |
| `P08` | 单抽后奖励记录闭环组 | 7 | 是 | 否 | 单抽成功后的记录回查 |
| `P09` | 五连抽专项 | 8 | 否 | 是 | 五连抽完整主流程 |
| `P10` | 小库存专项 | 4 | 否 | 部分是 | 小库存拦截与提示 |
| `P11` | 异常注入专项 | 8 | 否 | 否 | 依赖异常制造能力 |
| `P12` | 二次权重专项 | 4 | 否 | 部分是 | N+1 生效与记录回查 |
| `P13` | 响应式与兼容性专项 | 5 | 否 | 否 | 多视口校验 |

## 四、完整编排用例库

### P01 普通活动-只读首屏与基础展示

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-79 | P0 | 活动别名 URL 打开正确活动页 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 2 | FE-01 | P0 | 落地页打开正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 3 | FE-02 | P0 | 首屏主视觉展示正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 4 | FE-03 | P0 | 活动标题展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 5 | FE-04 | P1 | 活动副标题展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 6 | FE-05 | P1 | 活动规则展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 7 | FE-06 | P1 | 奖池区域展示正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 8 | FE-07 | P1 | 我的奖品入口展示正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 9 | FE-08 | P1 | 页面基础模块无错位 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 10 | FE-17 | P0 | 已登录态页面展示正常 | `FRONTEND_SESSION` | 只读 | 否 | - |
| 11 | FE-19 | P0 | 活动进行中展示正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | - |
| 12 | FE-30 | P1 | 我的奖品入口可点击 | `NORMAL_ACTIVITY_ONLINE` | 只读交互 | 否 | - |
| 13 | FE-31 | P1 | 弹窗关闭交互正常 | `NORMAL_ACTIVITY_ONLINE` | 只读交互 | 否 | - |
| 14 | FE-48 | P0 | 我的奖品入口打开奖励记录弹窗 | `NORMAL_ACTIVITY_ONLINE` | 只读交互 | 否 | - |
| 15 | FE-49 | P0 | 奖励记录弹窗基础 UI 正常 | `NORMAL_ACTIVITY_ONLINE` | 只读交互 | 否 | `FE-48` |
| 16 | FE-51 | P1 | 奖励记录空数据态展示正常 | `NORMAL_ACTIVITY_ONLINE` | 只读 | 否 | `FE-48` |
| 17 | FE-55 | P1 | 弹窗关闭后页面状态正常 | `NORMAL_ACTIVITY_ONLINE` | 只读交互 | 否 | `FE-48` |
| 18 | FE-73 | P0 | 后管活动标题改动后前端展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |
| 19 | FE-74 | P1 | 后管副标题改动后前端展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |
| 20 | FE-75 | P1 | 后管多语言配置后前端切语言展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |
| 21 | FE-76 | P1 | 后管 FAQ 配置后前端展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |
| 22 | FE-77 | P1 | 后管奖池配置后前端奖品展示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |
| 23 | FE-78 | P1 | 后管活动日历入口开启后前端显示正确 | `NORMAL_ACTIVITY_ONLINE` | 只读联动 | 否 | - |

### P02 互斥状态专项-未登录/未开始/已结束

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-16 | P0 | 未登录态页面展示正常 | `NORMAL_ACTIVITY_ONLINE` | 互斥状态 | 是 | - |
| 2 | FE-18 | P0 | 活动未开始态展示正常 | `NORMAL_ACTIVITY_ONLINE` | 互斥状态 | 是 | - |
| 3 | FE-20 | P0 | 活动已结束态展示正常 | `NORMAL_ACTIVITY_ONLINE` | 互斥状态 | 是 | - |
| 4 | FE-80 | P0 | 活动未开始时显示即将开始 | `NORMAL_ACTIVITY_ONLINE` | 互斥状态 | 是 | - |

### P03 样式展示专项-多样式活动

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-09 | P0 | 圆形转盘样式展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 2 | FE-10 | P1 | 飞镖转盘样式展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 3 | FE-11 | P1 | 彩蛋样式展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 4 | FE-12 | P1 | 跑马灯样式展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 5 | FE-13 | P1 | 足球射门样式展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 6 | FE-14 | P1 | 奖池图片与奖品名称展示正常 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |
| 7 | FE-15 | P1 | 非转盘样式不展示五连抽按钮 | `NORMAL_ACTIVITY_ONLINE` | 多活动只读 | 否 | - |

### P04 报名链路事务组-未报名到已报名

执行分类：

- `FE-81 = FRESH_ROOT`
- `FE-82 = CHAIN_CONTINUE`
- `FE-83 = CHAIN_CONTINUE`

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-81 | P0 | 活动开始后未报名显示立即报名 | `NORMAL_ACTIVITY_FRESH_UNREGISTERED` | 状态断言 | 是 | - |
| 2 | FE-82 | P0 | 点击立即报名后切换为抽奖状态 | `NORMAL_ACTIVITY_FRESH_UNREGISTERED` | 状态迁移 | 否 | `FE-81` |
| 3 | FE-83 | P0 | 已报名账号再次进入活动页直显抽奖 | `NORMAL_ACTIVITY_FRESH_SIGNED_UP` | 承接断言 | 否 | `FE-82` |

### P05 已报名零次数状态组

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-21 | P0 | 抽奖次数为0展示正常 | `NORMAL_ACTIVITY_FRESH_SIGNED_UP_ZERO_DRAW` | 状态断言 | 否 | `FE-82` |

### P06 充值补次与可抽奖次数状态组

执行分类：

- `FE-84 = CHAIN_CONTINUE`
- `FE-22 = CHAIN_CONTINUE`
- `FE-24 = CHAIN_CONTINUE`

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-84 | P0 | 充值任务-报名后发送 MQ 回调 | `NORMAL_ACTIVITY_FRESH_SIGNED_UP_ZERO_DRAW` | 状态迁移 | 否 | `FE-82` |
| 2 | FE-22 | P0 | 抽奖次数大于0展示正常 | `NORMAL_ACTIVITY_FRESH_SIGNED_UP_AFTER_MQ` | 状态断言 | 否 | `FE-84` |
| 3 | FE-24 | P0 | 单抽按钮可点击 | `NORMAL_ACTIVITY_FRESH_SIGNED_UP_AFTER_MQ` | 只读交互 | 否 | `FE-84` |

### P07 单抽事务组

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-26 | P1 | 抽奖旋转期间再次点击仍只生效一次 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-84` |
| 2 | FE-28 | P1 | 单抽按钮防重复点击 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-84` |
| 3 | FE-32 | P0 | 单抽接口正常请求 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-84` |
| 4 | FE-33 | P0 | 单抽成功展示奖品弹窗 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-32` |
| 5 | FE-34 | P0 | 单抽成功后可用次数消耗 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-32` |
| 6 | FE-35 | P0 | 单抽成功后优先按次数扣减确认成功 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-32` |
| 7 | FE-27 | P1 | 抽奖结束后按钮恢复正常 | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽事务 | 否 | `FE-32` |

### P08 单抽后奖励记录闭环组

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-36 | P1 | 单抽成功后奖励记录可回查 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-32` |
| 2 | FE-37 | P1 | 单抽成功后奖品信息符合预期 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-32` |
| 3 | FE-50 | P0 | 奖励记录字段展示正确 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-36` |
| 4 | FE-52 | P1 | 奖励记录有数据态展示正常 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-36` |
| 5 | FE-53 | P1 | 奖励记录时间筛选可操作 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-36` |
| 6 | FE-54 | P1 | 奖励记录滚动展示正常 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-36` |
| 7 | FE-56 | P1 | 奖品弹窗与奖励记录结果一致 | `REWARD_RECORD_DELAY_READY` | 抽后断言 | 否 | `FE-36` |

### P09 五连抽专项

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-25 | P0 | 可用次数大于5时展示并可点击五连抽按钮 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | - |
| 2 | FE-29 | P1 | 五连抽按钮防重复点击 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | `FE-25` |
| 3 | FE-40 | P0 | 五连抽接口正常请求 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | `FE-25` |
| 4 | FE-41 | P0 | 五连抽成功展示奖品弹窗 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | `FE-40` |
| 5 | FE-42 | P0 | 五连抽成功后抽奖次数消耗5次 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | `FE-40` |
| 6 | FE-43 | P0 | 五连抽成功后奖励记录可回查 | `REWARD_RECORD_DELAY_READY` | 五连抽事务 | 是 | `FE-40` |
| 7 | FE-44 | P0 | 五连抽奖励记录字段正确 | `REWARD_RECORD_DELAY_READY` | 五连抽事务 | 是 | `FE-40` |
| 8 | FE-47 | P1 | 五连抽结果展示完整 | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽事务 | 是 | `FE-40` |

### P10 小库存专项

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-23 | P1 | 库存不足状态展示正常 | `LOW_STOCK_ACTIVITY_ONLINE` | 库存状态 | 否 | - |
| 2 | FE-45 | P1 | 小库存模板下五连抽可能被库存规则拦截 | `LOW_STOCK_ACTIVITY_DRAW_GT5` | 库存事务 | 是 | - |
| 3 | FE-46 | P1 | 五连抽失败不消耗次数 | `LOW_STOCK_ACTIVITY_DRAW_GT5` | 库存事务 | 是 | `FE-45` |
| 4 | FE-57 | P0 | 小库存模板下五连抽库存不足提示正确 | `LOW_STOCK_ACTIVITY_DRAW_GT5` | 库存事务 | 是 | `FE-45` |

### P11 异常注入专项

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-38 | P1 | 单抽失败不展示错误奖品内容 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 2 | FE-39 | P1 | 单抽失败不消耗次数 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 3 | FE-58 | P1 | 抽奖失败提示展示正常 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 4 | FE-59 | P1 | 接口超时提示展示正常 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 5 | FE-60 | P1 | 网络异常提示展示正常 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 6 | FE-61 | P1 | 异常后按钮恢复正常 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 7 | FE-62 | P1 | 异常后不出现重复弹窗 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |
| 8 | FE-63 | P1 | 异常后页面不崩溃 | `ERROR_INJECTION_READY` | 异常事务 | 否 | - |

### P12 二次权重专项

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-64 | P0 | 二次权重专项校验-N+1生效 | `WEIGHT_ACTIVITY_DRAW_GE3` | 权重事务 | 是 | - |
| 2 | FE-65 | P1 | 未配置二次权重场景不做专项校验 | `NORMAL_ACTIVITY_DRAW_GE1` | 专项说明 | 否 | - |
| 3 | FE-66 | P1 | 需要验证二次权重时使用专项活动 | `WEIGHT_ACTIVITY_ONLINE` | 专项说明 | 否 | - |
| 4 | FE-67 | P1 | 二次权重命中后奖励记录正确 | `WEIGHT_ACTIVITY_DRAW_GE3` | 权重事务 | 是 | `FE-64` |

### P13 响应式与兼容性专项

| 顺序 | Case ID | 优先级 | 用例名称 | 场景键 | 状态类型 | Fresh 要求 | 承接 / 依赖 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | FE-68 | P1 | H5 页面展示正常 | `RESPONSIVE_VIEWPORT_READY` | 兼容性专项 | 否 | - |
| 2 | FE-69 | P1 | 常见移动端宽度下布局正常 | `RESPONSIVE_VIEWPORT_READY` | 兼容性专项 | 否 | - |
| 3 | FE-70 | P1 | 不同屏高下主按钮不被遮挡 | `RESPONSIVE_VIEWPORT_READY` | 兼容性专项 | 否 | - |
| 4 | FE-71 | P1 | 弹窗在移动端不超出屏幕 | `RESPONSIVE_VIEWPORT_READY` | 兼容性专项 | 否 | - |
| 5 | FE-72 | P1 | 长文案或长奖品名不破版 | `RESPONSIVE_VIEWPORT_READY` | 兼容性专项 | 否 | - |

## 五、使用方式

如果用户说“执行抽奖活动前端回归测试”，应先按本文件展示可选执行范围：

1. `普通前端主回归`：`P01 + P04 + P05 + P06 + P07 + P08`
2. `互斥状态专项`：`P02`
3. `样式展示专项`：`P03`
4. `五连抽专项`：`P09`
5. `小库存专项`：`P10`
6. `异常注入专项`：`P11`
7. `二次权重专项`：`P12`
8. `响应式专项`：`P13`
9. `全部前端回归`：以上所有编排包，但必须按主回归与专项分活动执行，不得使用同一活动串跑全部 case

## 六、与原始用例集的关系

- 本文件回答的是：`84 条前端 case 现在应该怎么拆分和按什么顺序执行`
- `docs/test-cases/lottery-frontend-regression-cases.md` 回答的是：`每条 case 的详细步骤和预期是什么`
- 后续若要把 dispatcher 真正改成多阶段状态机，应以本文件的 `编排包 / 承接关系 / Fresh 要求` 为权威输入
