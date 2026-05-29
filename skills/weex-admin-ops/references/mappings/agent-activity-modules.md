# 人人代理活动（AGENT）模块：key -> 前端中文名映射

用途：当用户询问“人人代理活动（AGENT）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/agency/components/addAndEdit.vue` 与 `baseForm.vue`。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 活动基本信息（人人代理） | `activity-web/activity-ui/src/views/activity/agency/components/baseForm.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- AGENT 列表页“上线/下线/删除”接口为：`/prod-api/activity/agent/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/agent.js`）。

