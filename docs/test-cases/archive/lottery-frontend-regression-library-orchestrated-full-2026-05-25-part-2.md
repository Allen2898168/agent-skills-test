# lottery-frontend-regression-library-orchestrated-full-2026-05-25 - Part 2

Source archive split from `docs/test-cases/archive/lottery-frontend-regression-library-orchestrated-full-2026-05-25.md`.
Lines: 201-261 of 261.

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
