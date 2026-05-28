# 新手活动模块：key -> 前端中文名映射

用途：当用户询问“新手活动配置支持哪些模块/字段”时，优先用这里的**前端中文模块名**回答（避免只输出内部 key）。

来源：`activity-web/activity-ui/src/views/activity/newbie/components/addAndEdit.vue` 的模块组件及其 `el-card header` 标题。

| 模块 key | 前端中文名（el-card header） | 前端组件路径 |
| --- | --- | --- |
| `base` | 活动基本信息 | `activity-web/activity-ui/src/views/activity/newbie/components/baseForm.vue` |
| `userApply` | 用户报名 | `activity-web/activity-ui/src/views/activity/newbie/components/userApply.vue` |
| `tasks` | 活动任务信息 | `activity-web/activity-ui/src/views/activity/newbie/components/taskForm/index.vue` |
| `resourceCard` | 资源位信息卡片 | `activity-web/activity-ui/src/views/activity/newbie/components/ResourceCardForm.vue` |
| `i18n` | 多语言 | `activity-web/activity-ui/src/views/activity/newbie/components/i18nConfigForm.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/lottery/components/FAQForm.vue` |

备注：
- `faq` 复用抽奖活动的 `FAQForm` 组件，因此路径在 `lottery/components/` 下。
