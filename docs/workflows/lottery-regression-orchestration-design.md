# 转盘抽奖回归用例编排设计稿

## 文档说明

- 适用范围：WEEX 转盘抽奖活动后管回归用例、前端落地页回归用例的自动化编排设计。
- 当前目标：先把 `后管 56 条`、`前端 84 条` 用例整理成可执行场景，再基于场景设计主回归入口与专项回归入口。
- 当前原则：不是先写“大脚本”，而是先定义 `场景`、`用例归属`、`执行顺序`、`断言边界`，确保后续自动化能做到“通过一条 case，就 pass 一条 case”。

## 关联文档

- 后管回归用例集：`docs/test-cases/lottery-admin-regression-cases.md`
- 前端回归用例集：`docs/test-cases/lottery-frontend-regression-cases.md`
- 自动化落地方案：`docs/workflows/lottery-automation-regression-plan.md`
- 活动模板验证清单：`docs/workflows/lottery-activity-template-validation-checklist.md`
- 机器可读 manifest：`docs/workflows/lottery-regression-manifest.json`

## 一、当前用例总览

| 维度 | 模块数 | 用例数 |
| --- | ---: | ---: |
| 后管 | 6 | 56 |
| 前端 | 12 | 84 |
| 合计 | 18 | 140 |

## 二、编排目标

编排后的自动化执行结果必须满足：

1. 每条用例有独立的 `caseId`、前置场景、执行动作、断言结果。
2. 每条用例执行后能明确输出 `PASS / FAIL / BLOCKED / SKIPPED`。
3. 主回归与专项回归分开执行，不把二次权重、小库存、五连抽等高依赖场景混进普通活动。
4. 测试数据按活动隔离，避免一条用例污染下一条用例。

## 三、场景模型

后续编排不直接按“页面”驱动，而是先准备可复用场景。每条 case 只依赖它需要的场景键。

| 场景键 | 含义 | 主要来源 |
| --- | --- | --- |
| `ADMIN_SESSION` | 后台已登录 | 后管登录态 |
| `FRONTEND_SESSION` | 前端已登录 | 前端 cookie 登录 |
| `REGISTER_TEMPLATE_READY` | 已有可绑定报名模版 | 报名模版模块 |
| `ROULETTE_TASK_READY` | 已有可绑定转盘任务 | 任务管理模块 |
| `PRIZE_SET_READY` | 已有可绑定奖品集 | 奖品管理模块 |
| `NORMAL_ACTIVITY_DRAFT` | 普通回归活动草稿已创建 | 普通模板 |
| `NORMAL_ACTIVITY_ONLINE` | 普通回归活动已上线 | 普通模板 + 上线 |
| `NORMAL_ACTIVITY_SIGNED_UP` | 普通回归活动已报名 | 上线活动 + 前端报名 |
| `NORMAL_ACTIVITY_DRAW_GE1` | 普通回归活动可用次数至少 1 | 报名后完成前置任务 |
| `NORMAL_ACTIVITY_DRAW_GT5` | 普通回归活动可用次数大于 5 | 报名后完成前置任务 |
| `WEIGHT_ACTIVITY_ONLINE` | 二次权重专项活动已上线 | 二次权重模板 |
| `WEIGHT_ACTIVITY_DRAW_GE3` | 二次权重专项活动可连续抽 3 次 | 二次权重模板 + 次数准备 |
| `LOW_STOCK_ACTIVITY_ONLINE` | 小库存专项活动已上线 | 小库存模板 |
| `LOW_STOCK_ACTIVITY_DRAW_GT5` | 小库存专项活动可用次数大于 5 | 小库存模板 + 次数准备 |
| `REWARD_RECORD_DELAY_READY` | 抽奖后已等待 5 秒再查奖励记录 | 前端抽奖成功后 |

## 四、后管用例梳理

### 1. 后管基础查询包

| 编排包 | 覆盖用例 | 场景依赖 | 说明 |
| --- | --- | --- | --- |
| `admin_activity_list_readonly` | `AL-01 ~ AL-05` | `ADMIN_SESSION` | 只读搜索，不产出新数据 |
| `admin_register_template_readonly` | `RT-01 ~ RT-02` | `ADMIN_SESSION` | 只读搜索 |
| `admin_task_readonly` | `TM-01 ~ TM-06` | `ADMIN_SESSION` | 只读搜索 |
| `admin_prize_readonly` | `PM-01 ~ PM-03` | `ADMIN_SESSION` | 只读搜索 |

### 2. 后管数据构建包

| 编排包 | 覆盖用例 | 场景依赖 | 产出场景 |
| --- | --- | --- | --- |
| `admin_register_template_write` | `RT-03 ~ RT-09` | `ADMIN_SESSION` | `REGISTER_TEMPLATE_READY` |
| `admin_task_write` | `TM-07 ~ TM-11` | `ADMIN_SESSION` | `ROULETTE_TASK_READY` |
| `admin_prize_write` | `PM-04 ~ PM-11` | `ADMIN_SESSION` | `PRIZE_SET_READY` |

### 3. 后管活动配置包

| 编排包 | 覆盖用例 | 场景依赖 | 产出场景 |
| --- | --- | --- | --- |
| `admin_activity_draft_core` | `AC-01 ~ AC-08` | `ADMIN_SESSION`、`REGISTER_TEMPLATE_READY`、`ROULETTE_TASK_READY`、`PRIZE_SET_READY` | `NORMAL_ACTIVITY_DRAFT` |
| `admin_activity_extended_config` | `AC-09 ~ AC-14` | `NORMAL_ACTIVITY_DRAFT` | 更新草稿配置 |
| `admin_activity_copy` | `AC-15`、`AL-07` | `NORMAL_ACTIVITY_DRAFT` 或已存在活动 | 复制出新草稿 |

### 4. 后管状态流转包

| 编排包 | 覆盖用例 | 场景依赖 | 产出场景 |
| --- | --- | --- | --- |
| `admin_activity_status_flow` | `AL-06`、`ST-01 ~ ST-03` | `NORMAL_ACTIVITY_DRAFT` | `NORMAL_ACTIVITY_ONLINE` 或删除结果 |

## 五、前端用例梳理

### 1. 前端普通主回归包

| 编排包 | 覆盖用例 | 场景依赖 | 说明 |
| --- | --- | --- | --- |
| `frontend_page_basic` | `FE-01 ~ FE-08` | `NORMAL_ACTIVITY_ONLINE` | 页面基础展示 |
| `frontend_style_display` | `FE-09 ~ FE-15` | `NORMAL_ACTIVITY_ONLINE` 或其他样式活动 | 样式 UI；多样式可拆子任务 |
| `frontend_state_ui` | `FE-16 ~ FE-23` | `FRONTEND_SESSION`、`NORMAL_ACTIVITY_ONLINE` | 登录态、活动态、次数态 |
| `frontend_interaction_basic` | `FE-24 ~ FE-31` | `NORMAL_ACTIVITY_DRAW_GT5` | 单抽按钮、五连抽按钮、弹窗开关 |
| `frontend_signup_flow` | `FE-79 ~ FE-83` | `FRONTEND_SESSION`、`NORMAL_ACTIVITY_ONLINE` | 报名链路 |
| `frontend_backend_linkage` | `FE-73 ~ FE-78`、`FE-84` | `NORMAL_ACTIVITY_ONLINE`、必要时 `NORMAL_ACTIVITY_SIGNED_UP` | 后管改动前端回显、充值任务联动 |

### 2. 前端单抽回归包

| 编排包 | 覆盖用例 | 场景依赖 | 说明 |
| --- | --- | --- | --- |
| `frontend_single_draw` | `FE-32 ~ FE-39` | `NORMAL_ACTIVITY_DRAW_GE1` | 单抽主流程、次数扣减、失败不扣次 |
| `frontend_reward_record` | `FE-48 ~ FE-56` | `NORMAL_ACTIVITY_DRAW_GE1`、`REWARD_RECORD_DELAY_READY` | 奖励记录和弹窗一致性 |

### 3. 前端专项回归包

| 编排包 | 覆盖用例 | 场景依赖 | 说明 |
| --- | --- | --- | --- |
| `frontend_five_draw` | `FE-40 ~ FE-47` | `NORMAL_ACTIVITY_DRAW_GT5` | 五连抽主流程，不含小库存拦截 |
| `frontend_low_stock` | `FE-45`、`FE-46`、`FE-57` | `LOW_STOCK_ACTIVITY_DRAW_GT5` | 小库存模板下验证五连抽被拦截、提示正确、次数不扣减 |
| `frontend_weight_special` | `FE-64 ~ FE-67` | `WEIGHT_ACTIVITY_DRAW_GE3` | 二次权重 N+1 生效 |

### 4. 前端观察性 / 兼容性包

| 编排包 | 覆盖用例 | 场景依赖 | 说明 |
| --- | --- | --- | --- |
| `frontend_exception_ui` | `FE-58 ~ FE-63` | 特定异常注入条件 | 需要后续补充异常制造方式 |
| `frontend_responsive_ui` | `FE-68 ~ FE-72` | `NORMAL_ACTIVITY_ONLINE` | 适合单独跑，不建议混入主回归 |

## 六、主回归入口设计

### 1. 后管主回归入口

建议入口名：`lottery_admin_main_regression`

执行顺序：

1. `admin_prize_write`
2. `admin_register_template_write`
3. `admin_task_write`
4. `admin_activity_draft_core`
5. `admin_activity_extended_config`
6. `admin_activity_status_flow`
7. `admin_activity_list_readonly`

覆盖目标：

- 后管 56 条中的稳定主链路
- 输出本轮活动 ID、活动别名、模版 ID、任务 ID、奖品 ID

### 2. 前端主回归入口

建议入口名：`lottery_frontend_main_regression`

执行顺序：

1. 依赖 `NORMAL_ACTIVITY_ONLINE`
2. `frontend_signup_flow`
3. 准备 `NORMAL_ACTIVITY_DRAW_GE1`
4. `frontend_page_basic`
5. `frontend_state_ui`
6. `frontend_interaction_basic`
7. `frontend_single_draw`
8. `frontend_reward_record`
9. `frontend_backend_linkage`

覆盖目标：

- 前端稳定主链路
- 不混入二次权重、小库存、并发等专项场景

## 七、专项回归入口设计

### 1. 五连抽专项入口

建议入口名：`lottery_five_draw_regression`

依赖场景：

- `NORMAL_ACTIVITY_DRAW_GT5`

覆盖用例：

- `FE-25`
- `FE-29`
- `FE-40 ~ FE-47`

### 2. 二次权重专项入口

建议入口名：`lottery_weight_regression`

依赖场景：

- `WEIGHT_ACTIVITY_DRAW_GE3`

覆盖用例：

- `FE-64 ~ FE-67`
- 对应后管 `AC-14`

### 3. 小库存专项入口

建议入口名：`lottery_low_stock_regression`

依赖场景：

- `LOW_STOCK_ACTIVITY_DRAW_GT5`

覆盖用例：

- `FE-45`
- `FE-46`
- `FE-57`
- 必要时联动后管 `AC-07`

## 八、case 执行结果模型

后续每条用例执行后，必须输出统一结果结构：

| 字段 | 含义 |
| --- | --- |
| `caseId` | 用例编号，例如 `FE-57` |
| `caseName` | 用例名称 |
| `packId` | 所属编排包 |
| `scenarioKey` | 执行场景键 |
| `status` | `PASS / FAIL / BLOCKED / SKIPPED` |
| `evidence` | 页面文本、接口响应、次数变化、活动 ID、任务 ID 等证据 |
| `errorMessage` | 失败原因或阻塞原因 |
| `startedAt` | 开始时间 |
| `endedAt` | 结束时间 |

## 九、当前编排落地建议

当前最适合先落的，不是 140 条全开，而是先做 3 个最小入口：

1. `lottery_admin_main_regression`
2. `lottery_frontend_main_regression`
3. `lottery_low_stock_regression`

原因：

- 后管主回归可以先稳定输出活动和依赖数据。
- 前端主回归可以先稳定覆盖报名、单抽、奖励记录主链路。
- 小库存专项已经有真实验证文案，最适合作为第一个专项入口。

## 十、当前不纳入首轮编排的内容

- 多账户并发抢奖
- 普通概率大样本统计
- 未形成稳定制造路径的异常注入
- 强依赖多终端或多视口的人机视觉比对

## 十一、下一步落地顺序

1. 先把这份设计稿作为权威编排文档固定下来。
2. 已完成：基于 `编排包 + 场景键` 定义机器可读 case manifest，见 `docs/workflows/lottery-regression-manifest.json`。
3. 先实现 `lottery_admin_main_regression`。
4. 再实现 `lottery_frontend_main_regression`。
5. 最后实现 `lottery_low_stock_regression` 和 `lottery_weight_regression`。
