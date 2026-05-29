# 交易竞速赛（活动类型相关页面）模块：key -> 前端中文名映射

用途：当用户询问“交易竞速赛（RACE_COMPETITION）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/speedRace/edit.vue` 与其子组件 `el-card header`。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 交易竞速赛基本信息 | `activity-web/activity-ui/src/views/activity/speedRace/components/baseInfo.vue` |
| `userApply` | 用户报名 | `activity-web/activity-ui/src/views/activity/competition/components/userApply.vue` |
| `speedConfig` | 竞速配置 | `activity-web/activity-ui/src/views/activity/speedRace/components/speedConfig.vue` |
| `prizePoolConfig` | 奖池配置 | `activity-web/activity-ui/src/views/activity/speedRace/components/prizePoolConfig.vue` |
| `leaderboardConfig` | 排行榜配置 | `activity-web/activity-ui/src/views/activity/speedRace/components/leaderboardConfig.vue` |
| `pageSetting` | 活动页面设置 | `activity-web/activity-ui/src/views/activity/competition/components/pageSetting.vue` |
| `i18n` | 多语言 | `activity-web/activity-ui/src/views/activity/competition/components/langContentSetting.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/lottery/components/FAQForm.vue` |

备注：
- 竞速赛编辑页当前复用交易大赛的 `用户报名`、`活动页面设置`、`多语言` 组件。
- 竞速赛“上线/下线/删除”当前复用交易大赛接口：`/activity/competition/online|offline|delete`（见 `activity-web/activity-ui/src/views/activity/speedRace/index.vue`）。

