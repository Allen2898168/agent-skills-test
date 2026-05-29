# 竞猜大赛（GUESS）模块：key -> 前端中文名映射

用途：当用户询问“竞猜大赛（GUESS）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/guessCompetition/addAndEdit.vue` 及其子组件。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 竞猜活动基本信息 + 用户报名 | `activity-web/activity-ui/src/views/activity/guessCompetition/components/baseForm.vue` |
| `integralTasks` | 积分任务配置 | `activity-web/activity-ui/src/views/activity/guessCompetition/components/integralTaskConfig.vue` |
| `seasons` | 赛事分期 + 竞猜任务配置 | `activity-web/activity-ui/src/views/activity/guessCompetition/components/seasonForm.vue` |
| `prizeConfig` | 奖品配置（积分兑换时间 + 奖品表格） | `activity-web/activity-ui/src/views/activity/guessCompetition/components/prizeManage.vue` |
| `pageSetting` | 活动页面设置 | `activity-web/activity-ui/src/views/activity/competition/components/pageSetting.vue` |
| `i18n` | 多语言 | `activity-web/activity-ui/src/views/activity/competition/components/langContentSetting.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/lottery/components/FAQForm.vue` |
| `guessConfigs` | 渠道配置管理（官网/渠道 Tab + guessList） | `activity-web/activity-ui/src/views/activity/guessCompetition/addAndEdit.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- GUESS 列表页“上线/下线/删除”接口为：`/prod-api/activity/guess/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/guessCompetition.js`）。
- GUESS 的创建/编辑/详情仍走活动通用接口：`/prod-api/activity/config`、`/prod-api/activity/config/{id}`（见 `activity-web/activity-ui/src/api/activity/index.js`）。
