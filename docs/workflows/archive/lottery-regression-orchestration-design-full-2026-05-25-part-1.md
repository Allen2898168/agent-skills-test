# lottery-regression-orchestration-design-full-2026-05-25 - Part 1

Source archive split from `docs/workflows/archive/lottery-regression-orchestration-design-full-2026-05-25.md`.
Lines: 1-200 of 317.

# 转盘抽奖回归用例编排设计稿

## 文档说明

- 适用范围：WEEX 转盘抽奖活动后管回归用例、前端落地页回归用例的自动化编排设计。
- 当前目标：先把 `后管 56 条`、`前端 84 条` 用例整理成可执行场景，再基于场景设计主回归入口与专项回归入口。
- 当前原则：不是先写“大脚本”，而是先定义 `场景`、`用例归属`、`执行顺序`、`断言边界`，确保后续自动化能做到“通过一条 case，就 pass 一条 case”。

## 关联文档

- 后管回归用例集：`docs/test-cases/lottery-admin-regression-cases.md`
- 前端回归用例集：`docs/test-cases/lottery-frontend-regression-cases.md`
- 前端回归编排版用例库：`docs/test-cases/lottery-frontend-regression-library-orchestrated.md`
- 用例分类与执行边界：`docs/workflows/lottery-regression-case-classification-v1.md`
- 自动化落地方案：`docs/workflows/lottery-automation-regression-plan.md`
- 活动模板验证清单：`docs/workflows/lottery-activity-template-validation-checklist.md`
- 机器可读 manifest：`docs/workflows/lottery-regression-manifest.json`
- 能力差距清单：`docs/workflows/lottery-automation-capability-gap-v3.md`

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
2. `frontend_page_basic`
3. `frontend_state_ui`
4. `frontend_signup_flow`
5. `frontend_backend_linkage`
6. 准备 `NORMAL_ACTIVITY_DRAW_GE1`
7. `frontend_interaction_basic`
8. `frontend_single_draw`
9. `frontend_reward_record`

覆盖目标：

- 前端稳定主链路
- 不混入二次权重、小库存、并发等专项场景

当前已落地首批覆盖：

- `frontend_page_basic`：`FE-01`、`FE-07`
- `frontend_state_ui`：`FE-17`、`FE-19`、`FE-22`
- `frontend_signup_flow`：`FE-79`、`FE-81`、`FE-82`、`FE-83`
- `frontend_single_draw`：`FE-32`、`FE-33`、`FE-34`、`FE-35`
- `frontend_reward_record`：`FE-48`、`FE-49`、`FE-50`
- `frontend_backend_linkage`：`FE-84`

当前状态说明：

- 该入口已接入 dispatcher 与 manifest。
- 当前属于 `partial`，还不是完整前端全量回归入口。

### 3. 前端状态污染执行规则

前端 case 不能简单按页面分组顺序串跑。凡是会改变 `报名态 / 次数态 / 奖励记录 / 库存态` 的用例，都必须按状态机编排。

核心规则：

1. `FE-81 -> FE-82 -> FE-83` 是同一条报名状态链路。
2. `FE-81` 必须在“活动进行中且账号未报名”时执行；一旦执行 `FE-82`，该账号就不再满足 `FE-81` 前置条件。
3. `FE-84` 必须在“已报名且充值任务未完成”场景执行，不应与 `FE-81` 共用“未报名”初始态。
4. `FE-32 ~ FE-35` 属于单抽事务组，会消耗 1 次抽奖次数并写入奖励记录，建议连续执行并共用一次抽奖动作。
5. `FE-48 ~ FE-50` 若只校验入口、弹窗和字段结构，可独立执行；若要校验“刚抽完后的奖励记录”，必须承接单抽之后执行。
6. `FE-80` 与 `FE-81` 时间态互斥，不能放在同一活动、同一时间窗口回归。
7. 五连抽、小库存、二次权重场景必须拆到专项入口，不能混入普通主回归。

前端主回归推荐顺序：

1. 只读首屏组：`FE-79`、`FE-01`、`FE-07`、`FE-17`、`FE-19`
2. 未报名状态组：`FE-81`