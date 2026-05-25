# lottery-automation-capability-gap-v3-full-2026-05-25 - Part 2

Source archive split from `docs/workflows/archive/lottery-automation-capability-gap-v3-full-2026-05-25.md`.
Lines: 201-253 of 253.


1. 扩充 `FE-02 ~ FE-06`
2. 扩充 `FE-09 ~ FE-15`
3. 扩充 `FE-51 ~ FE-56`

## P2：后续增强项

### 1. 异常制造与容错回归

目标：

1. 后端异常返回
2. 接口超时
3. 弱网 / 重试
4. 风控失败 UI

当前状态：未形成稳定制造路径，不纳入首轮自动化。

### 2. 并发与概率统计

目标：

1. 多账号并发抢奖
2. 普通权重大样本概率统计

当前状态：不纳入当前主回归范围。

## 当前最合理的落地顺序

1. 打通 fresh 活动自动创建与上线链路
2. 用 fresh 活动真实跑通 `FE-81 / FE-82 / FE-84`
3. 把 manifest / dispatcher 同步到编排版用例库粒度
4. 补 `NORMAL_ACTIVITY_DRAW_GT5` 自动前置
5. 实现 `lottery_low_stock_regression`
6. 实现 `lottery_weight_regression`
7. 实现 `lottery_five_draw_regression`
8. 最后扩更多前端展示类 case

## 当前结论

如果现在有人说“进行抽奖活动回归测试”，系统已经能做到：

1. 展示后管 / 前端 / 专项的场景菜单
2. 标出哪些场景可执行、部分可执行、未接自动化、当前阻塞
3. 对已接入的后管主回归和前端主回归首批 case 生成分阶段执行计划
4. 对普通前端主回归，识别并自动处理登录、上线、报名、补次、奖励记录等待等普通前置条件

当前距离“整套抽奖活动后管 + 前端 + 专项全自动化回归”还差 3 个核心缺口：

1. fresh 活动自动创建并上线后，再跑 dispatcher 级真实主回归
2. 专项入口与专项活动自动化
3. manifest 与编排版完整用例库的统一执行源
