# 定制化活动（CUSTOMIZED）模块：key -> 前端中文名映射

用途：当用户询问“定制化活动（CUSTOMIZED）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑弹窗 `activity-web/activity-ui/src/views/activity/commission/components/addAndEdit.vue` 及其子组件。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 基本信息（定制化活动） | `activity-web/activity-ui/src/views/activity/commission/components/baseForm.vue` |
| `tasks` | 活动任务模板 | `activity-web/activity-ui/src/views/activity/commission/components/activityTaskForm.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- CUSTOMIZED 列表页“上线/下线/删除”接口为：`/prod-api/activity/customized/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/commission.js`）。

