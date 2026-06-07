# 大富翁世界杯（MONOPOLY_WORLD_CUP）模块：key -> 前端中文名映射

用途：当用户询问“大富翁世界杯（MONOPOLY_WORLD_CUP）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/monopoly/modal.vue` 及其子组件。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 大富翁活动基本信息 | `activity-web/activity-ui/src/views/activity/monopoly/components/baseForm.vue` |
| `userApply` | 用户报名 | `activity-web/activity-ui/src/views/activity/monopoly/components/userApplyForm.vue` |
| `notLoggedDescription` | 未登录说明内容 | `activity-web/activity-ui/src/views/activity/monopoly/components/descriptionContent.vue` |
| `monopolyConfigs` | 配置管理（默认/官网/渠道 Tab + monopolyList） | `activity-web/activity-ui/src/views/activity/monopoly/modal.vue` |
| `board` | 棋盘配置 | `activity-web/activity-ui/src/views/activity/monopoly/components/boardForm.vue` |
| `rewardPool` | 奖励列表（积分池） | `activity-web/activity-ui/src/views/activity/monopoly/components/rewardPoolForm.vue` |
| `tasks` | 任务配置（竞猜/膨胀券/限时/每日/累计/积分里程碑） | `activity-web/activity-ui/src/views/activity/monopoly/components/taskForm.vue` |
| `risk` | 风控阈值设置 | `activity-web/activity-ui/src/views/activity/monopoly/components/riskForm.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/lottery/components/FAQForm.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- MONOPOLY_WORLD_CUP 列表页“上线/下线/删除”接口为：`/prod-api/activity/monopoly/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/monopoly.js`）。
- MONOPOLY_WORLD_CUP 的创建/编辑/详情仍走活动通用接口：`/prod-api/activity/config`、`/prod-api/activity/config/{id}`（见 `activity-web/activity-ui/src/api/activity/index.js`）。

