# 交易大赛（活动配置 payload）字段：key -> 前端中文名映射（精选）

用途：
- 当用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由脚本执行模块级更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用 `rawTopLevel` 临时兜底，跑通后再补齐映射。

| 字段 key | 前端中文名 |
| --- | --- |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `showUrl` | 活动别名（showUrl） |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `configType` | 配置类型 |
| `activityOwner` | 活动负责人 |
| `channelCategory` | 渠道分类 |
| `priority` | 优先级 |
| `applicationMode` | 报名方式/参赛方式（applicationMode） |
| `guideTemplateId` | 流程引导模板 |
| `multiLanguageTemplateId` | 多语言模板 |
| `showCountdown` | 是否展示倒计时 |
| `showSchedule` | 是否展示日程 |
| `activitySchedule` | 活动日程（列表） |
| `applyConfigId` | 用户报名模板（applyConfigId） |
| `initBonusValue` | 初始赠金（initBonusValue） |
| `isPreApply` | 是否预报名 |
| `preApplyConfigId` | 预报名模板（preApplyConfigId） |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |
| `prize` | 奖品管理（prize 列表） |
| `prizePoolIds` | 奖池/奖品池ID列表（prizePoolIds） |
| `dynamicBonusSharingParams` | 动态奖池分成配置（dynamicBonusSharingParams） |
| `fixedBonusSharingParams` | 固定奖池分成配置（fixedBonusSharingParams） |
| `fixedTotalBonusAmount` | 固定奖池总额（fixedTotalBonusAmount） |
| `hasConsolationBonus` | 是否有安慰奖 |
| `consolationBonusParams` | 安慰奖配置 |
| `rankingParams` | 排名规则配置（rankingParams） |
| `rankingParamsMap` | 排名规则映射（rankingParamsMap） |
| `rankingRatioMap` | 排名奖励比例（rankingRatioMap） |
| `teamRewardParams` | 团队奖励参数（teamRewardParams） |
| `teamBonusSharingParams` | 队内奖励分成（teamBonusSharingParams） |
| `teamStatsParams` | 团队统计参数（teamStatsParams） |
| `virtualRankingParams` | 虚拟排行参数（virtualRankingParams） |
| `introTitle` | 活动介绍标题（introTitle） |
| `introContent` | 活动介绍内容（introContent） |
| `projectName` | 项目名称（projectName） |
| `projectRule` | 项目规则（projectRule） |
| `rules` | 活动规则（rules） |
| `requirements` | 参与要求（requirements） |
| `ruleTitle` | 规则标题（ruleTitle） |
| `landingPageType` | 落地页类型（landingPageType） |
| `webBannerUrl` | PC Banner 图 |
| `appBannerUrl` | APP Banner 图 |
| `webShareUrl` | PC 分享图 |
| `appShareUrl` | APP 分享图 |
| `shareContent` | 分享文案 |
| `agentShareContent` | 代理分享文案 |
| `ogImageUrl` | SEO/OG 图（ogImageUrl） |
| `activityConfigI18n` | 多语言内容（activityConfigI18n） |
| `questions` | 常见问题（questions） |
| `questionsI18n` | FAQ 多语言（questionsI18n） |
| `syncCalendarFlag` | 是否同步活动日历 |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `imageUrlI18n` | 活动日历图片多语言（imageUrlI18n） |
| `iconUrlI18n` | 活动日历图标多语言（iconUrlI18n） |

