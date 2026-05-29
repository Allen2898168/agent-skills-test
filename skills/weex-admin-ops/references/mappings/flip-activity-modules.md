# 小丑牌活动（FLIP）模块：key -> 前端中文名映射

用途：当用户询问“小丑牌活动（FLIP）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/jokerCard/modal.vue` 及其子组件。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 基础信息（含报名信息） | `activity-web/activity-ui/src/views/activity/jokerCard/components/baseForm.vue` |
| `notLoggedDescription` | 未登录说明内容 | `activity-web/activity-ui/src/views/activity/jokerCard/components/descriptionContent.vue` |
| `flipConfigs` | 配置管理（官网/渠道 Tab） | `activity-web/activity-ui/src/views/activity/jokerCard/modal.vue` |
| `card` | 游戏玩法信息 / 牌局信息 / 牌型信息 | `activity-web/activity-ui/src/views/activity/jokerCard/components/cardForm.vue` |
| `tasks` | 任务配置（抽牌任务/积分任务） | `activity-web/activity-ui/src/views/activity/jokerCard/components/task/index.vue` |
| `buff` | Buff 配置 | `activity-web/activity-ui/src/views/activity/jokerCard/components/buff/index.vue` |
| `rewardRule` | 奖励规则（每局/每小周期/排行榜等） | `activity-web/activity-ui/src/views/activity/jokerCard/components/rewardRule/index.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- FLIP 列表页“上线/下线/删除”接口为：`/prod-api/activity/flip/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/jokerCard.js`）。
- FLIP 的创建/编辑/详情仍走活动通用接口：`/prod-api/activity/config`、`/prod-api/activity/config/{id}`（见 `activity-web/activity-ui/src/api/activity/index.js`）。

