# 交易竞速赛（活动配置 payload）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由脚本执行模块级更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 临时兜底，跑通后再补齐映射。

| 字段 key | 前端中文名 |
| --- | --- |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `showUrl` | 活动别名（showUrl） |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `configType` | 配置类型 |
| `activityOwner` | 配置人 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `periods` | 是否为平台活动 |
| `showCountdown` | 倒计时 |
| `applicationMode` | 报名方式（applicationMode） |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `isPreApply` | 是否预报名 |
| `preApplyConfigId` | 预报名模板（preApplyConfigId） |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |
| `requirements` | 赛事合约限制（requirements） |
| `rankType` | 竞速数据（rankType） |
| `applyConfigId` | 用户报名模板（applyConfigId） |
| `bonusPoolType` | 奖池选择（bonusPoolType） |
| `raceParams` | 奖池展示配置（raceParams） |
| `raceParams.isParticipantsNum` | 参与人数展示 |
| `raceParams.isTotalPricePoolAmount` | 奖池总金额展示开关 |
| `raceParams.totalPricePoolAmount` | 奖池总金额（静态展示） |
| `raceFixBonusPoolParams` | 奖品档位（raceFixBonusPoolParams） |
| `raceFixBonusPoolParams[].taskId` | 任务要求（taskId） |
| `raceFixBonusPoolParams[].dynamicsPicture` | 奖池动图（gif） |
| `raceFixBonusPoolParams[].isRewardNum` | 限制人数开关 |
| `raceFixBonusPoolParams[].rewardNum` | 奖励人数 |
| `raceRankingParams` | 排行榜配置（raceRankingParams） |
| `raceRankingParams.isShow` | 是否展示排行榜 |
| `raceRankingParams.minRank` | 排行榜展示起始名次 |
| `raceRankingParams.maxRank` | 排行榜展示结束名次 |
| `introTitle` | 活动介绍标题（introTitle） |
| `introContent` | 活动介绍内容（introContent） |
| `projectName` | 项目名称（projectName） |
| `projectRule` | 项目规则（projectRule） |
| `rules` | 活动规则（rules） |
| `requirements` | 参与要求（requirements） |
| `ruleTitle` | 规则标题（ruleTitle） |
| `webBannerUrl` | PC Banner 图 |
| `appBannerUrl` | APP Banner 图 |
| `webShareUrl` | PC 分享图 |
| `appShareUrl` | APP 分享图 |
| `shareContent` | 分享文案 |
| `agentShareContent` | 代理分享文案 |
| `ogImageUrl` | SEO/OG 图（ogImageUrl） |
| `activityConfigI18n` | 多语言内容（activityConfigI18n） |
| `questions` | 常见问题（questions） |
| `syncCalendarFlag` | 是否同步活动日历 |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |

