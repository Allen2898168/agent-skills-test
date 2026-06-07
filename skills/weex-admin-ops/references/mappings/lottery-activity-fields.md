# 转盘抽奖（LOTTERY）字段：key -> 前端中文名映射

说明：字段 key 以 `lottery-activity-module-config-fast-api.mjs` 的 `modules.*` spec 为准；复杂数组/对象建议整段覆盖对应模块字段。

| 字段 key | 前端中文名 |
| --- | --- |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `showUrl` | 活动别名（showUrl） |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `applyConfigId` | 用户报名模版 |
| `raffleStyle` | 抽奖样式（raffleStyle） |
| `taskConfig` | 活动任务配置（taskConfig） |
| `showBeginnerTaskConfig` | 新手任务展示配置（showBeginnerTaskConfig） |
| `prize` | 奖品池（prize，需8个） |
| `prizeWeightConfig` | 累计次数再权重配置总开关（prizeWeightConfig） |
| `prizeWeight` | 累计次数再权重配置列表（prizeWeight） |
| `prizeColorTagWeightConfig` | 色签权重配置（prizeColorTagWeightConfig） |
| `prizeLimited` | 每日限制（prizeLimited） |
| `activityConfigI18n` | 多语言配置（activityConfigI18n） |
| `questions` | 常见问题（questions） |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `isPreApply` | 是否开启预报名（isPreApply） |
| `preApplyConfigId` | 预报名模板ID（preApplyConfigId） |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |

