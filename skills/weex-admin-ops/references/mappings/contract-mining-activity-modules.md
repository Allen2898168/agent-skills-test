# 合约挖矿活动（CONTRACT_MINING）模块：key -> 前端中文名映射

用途：当用户询问“合约挖矿活动支持配置哪些模块/字段”时，优先用这里的**前端中文模块名**回答。

来源：后管活动编辑页 `activity-web/activity-ui/src/views/activity/contractMining/edit.vue` 及其子组件。

| 模块 key | 前端中文名 | 前端组件路径 |
| --- | --- | --- |
| `base` | 活动基本信息 | `activity-web/activity-ui/src/views/activity/contractMining/components/baseInfo.vue` |
| `notLoggedDescription` | 未登录说明内容 | `activity-web/activity-ui/src/views/activity/contractMining/components/descriptionContent.vue` |
| `applyTemplate` | 用户报名模版 | `activity-web/activity-ui/src/views/activity/contractMining/components/applyConfigSelector.vue` |
| `channelConfigs` | 渠道配置管理 | `activity-web/activity-ui/src/views/activity/contractMining/edit.vue` |
| `tasks` | 任务信息 | `activity-web/activity-ui/src/views/activity/contractMining/components/activityTaskSelector.vue` |
| `miningPool` | 矿池配置 | `activity-web/activity-ui/src/views/activity/contractMining/components/miningConfig.vue` |
| `weLaunch` | WE Launch 配置 | `activity-web/activity-ui/src/views/activity/contractMining/components/weLaunchConfig.vue` |
| `buyback` | 回购栏配置 | `activity-web/activity-ui/src/views/activity/contractMining/components/backBuyConfig.vue` |
| `agentEntrance` | 人人代理第一个任务入口 | `activity-web/activity-ui/src/views/activity/contractMining/components/userAgentConfig.vue` |
| `rules` | 活动规则 | `activity-web/activity-ui/src/views/activity/contractMining/edit.vue`（`intro`） |
| `calendar` | 活动日历 | `activity-web/activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue` |

备注：
- CONTRACT_MINING 列表页“上线/下线/删除”接口为：`/prod-api/activity/mining/online|offline|delete`（见 `activity-web/activity-ui/src/api/activity/contractMining.js`）。

