# 充值交易活动（RECHARGE_TRANS_TASK）模块：key -> 前端中文名映射

用途：当用户询问“充值交易活动（RECHARGE_TRANS_TASK）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/depositTrade/addAndEdit.vue` 及其子组件 `el-card header`。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 活动基本信息 | `activity-web/activity-ui/src/views/activity/depositTrade/components/BaseForm.vue` |
| `tasks` | 活动任务信息 | `activity-web/activity-ui/src/views/activity/depositTrade/components/TaskForm.vue` |
| `rules` | 活动规则信息 | `activity-web/activity-ui/src/views/activity/depositTrade/components/RulesForm.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- RECHARGE_TRANS_TASK 列表页“上线/下线/删除”接口为：`/prod-api/activity/rechargeTrans/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/depositTrade.js`）。

