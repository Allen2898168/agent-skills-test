# 小活动型活动（TRACE_PRO）模块：key -> 前端中文名映射

用途：当用户询问“小活动型活动（TRACE_PRO）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/copyTrading/config.vue` 与其子组件 `el-card header`。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 基本信息（小活动） | `activity-web/activity-ui/src/views/activity/copyTrading/components/baseForm.vue` |
| `material` | 素材上传 | `activity-web/activity-ui/src/views/activity/copyTrading/components/MaterialImageForm.vue` |
| `registration` | 报名配置/用户报名 | `activity-web/activity-ui/src/views/activity/copyTrading/components/RegistrationForm.vue` |
| `subActivities` | 子活动配置 | `activity-web/activity-ui/src/views/activity/copyTrading/components/SubActivityForm.vue` |
| `tradingPairInfo` | 交易币对信息 | `activity-web/activity-ui/src/views/activity/copyTrading/components/TradingPairInfoForm.vue` |
| `resourceCard` | 资源位信息卡片 | `activity-web/activity-ui/src/views/activity/copyTrading/components/ResourceCardForm.vue` |
| `rules` | 规则信息 | `activity-web/activity-ui/src/views/activity/copyTrading/components/RulesForm.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/copyTrading/components/FAQForm.vue` |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |
| `entry` | 路径一入口配置 | `activity-web/activity-ui/src/views/activity/copyTrading/components/PathEntryForm.vue` |
| `activityData` | 活动数据点配置 | `activity-web/activity-ui/src/views/activity/copyTrading/components/ActivityDataForm.vue` |
| `userData` | 用户数据配置 | `activity-web/activity-ui/src/views/activity/copyTrading/components/UserDataForm.vue` |

备注：
- TRACE_PRO 列表页的“上线/下线/删除”接口为：`/prod-api/activity/tracePro/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/copyTrading.js`）。

