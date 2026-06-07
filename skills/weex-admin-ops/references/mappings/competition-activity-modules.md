# 交易大赛（活动类型相关页面）模块：key -> 前端中文名映射

用途：当用户询问“交易大赛/交易赛（含个人/团队/复合/模拟盘）支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：`activity-web/activity-ui/src/views/activity/competition/edit.vue` 及其子组件的 `el-card header`（或动态 header 的默认值）。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 活动基本信息 | `activity-web/activity-ui/src/views/activity/competition/components/baseInfo.vue` |
| `schedule` | 活动日程 | `activity-web/activity-ui/src/views/activity/competition/components/eventSchedule.vue` |
| `userApply` | 用户报名 | `activity-web/activity-ui/src/views/activity/competition/components/userApply.vue` |
| `prize` | 奖品管理 | `activity-web/activity-ui/src/views/activity/competition/components/prizeManage.vue` |
| `contract` | 奖池配置 | `activity-web/activity-ui/src/views/activity/competition/components/contractInfo.vue` |
| `rankingReward` | 排名奖励 | `activity-web/activity-ui/src/views/activity/competition/components/rewardRanking.vue` |
| `teamAwardSetting` | 队内奖励设置 | `activity-web/activity-ui/src/views/activity/competition/components/TeamAwardSetting.vue` |
| `virtualRanking` | 交易排行榜信息 | `activity-web/activity-ui/src/views/activity/competition/components/virtualRanking.vue` |
| `team` | 团队管理 | `activity-web/activity-ui/src/views/activity/competition/components/team/index.vue` |
| `pageSetting` | 活动页面设置 | `activity-web/activity-ui/src/views/activity/competition/components/pageSetting.vue` |
| `i18n` | 多语言 | `activity-web/activity-ui/src/views/activity/competition/components/langContentSetting.vue` |
| `faq` | 常见问题 | `activity-web/activity-ui/src/views/activity/lottery/components/FAQForm.vue` |
| `calendar` | （活动日历组件） | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

交易赛分支模块（按页面分支出现）：
- `additionalAward`：额外奖励（复合个人赛）
- `activityShowType`：活动选择（复合赛展示方式）
- `poolDivision`：赛事分区（模拟盘交易赛）
- `simulateBonusPool`：奖池配置（模拟盘交易赛）

备注：
- `userApply` 的卡片标题是动态 `:header="title"`，默认值为“用户报名”。
- `contract` 的卡片标题为条件表达式 `showCard ? '奖池配置' : undefined`，默认展示为“奖池配置”。
- 交易赛包含多种 activityType（个人/团队/复合/模拟盘等），模块出现与字段可配范围需在对应“字段映射/依赖项映射”里再细分。
