# 代理小活动（AGENT_TRACE_PRO）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 临时兜底，跑通后再补齐映射。

| 字段 key | 前端中文名 |
| --- | --- |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `showUrl` | 活动别名（showUrl） |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `configType` | 配置类型 |
| `activityOwner` | 负责人/配置人 |
| `channelCategory` | 活动类别/类别配置 |
| `applicationMode` | 立即报名入口（显示/不显示） |
| `guideTemplateId` | 流程引导模板 |
| `visible` | 是否展示活动（visible） |
| `activityIntro` | 活动介绍（多语言） |
| `activityTags` | 活动标签（多语言/列表） |
| `introTitle` | 页面介绍标题（多语言） |
| `introContent` | 页面介绍内容（多语言） |
| `projectName` | 项目名称（多语言） |
| `projectRule` | 项目规则（多语言） |
| `webBannerUrl` | 活动Web配图（多语言） |
| `appBannerUrl` | 活动H5配图（多语言） |
| `webShareUrl` | 分享Web配图（多语言） |
| `appShareUrl` | 分享H5配图（多语言） |
| `shareContent` | 活动分享文案（多语言） |
| `agentShareContent` | 代理分享文案（多语言） |
| `webMp4Files` | web视频上传（多语言） |
| `appMp4Files` | app视频上传（多语言） |
| `ogImageUrl` | 社媒活动预览图上传（多语言） |
| `materialInfoList` | 素材上传（materialInfoList） |
| `applyConfigId` | 用户报名模板（applyConfigId） |
| `isPreApply` | 是否预报名 |
| `preApplyConfigId` | 预报名模板（preApplyConfigId） |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |
| `miniActivity` | 子活动配置（miniActivity） |
| `portalInfo` | 路径一入口配置（portalInfo） |
| `resourceConfig` | 资源位信息卡片配置（resourceConfig） |
| `showResource` | 是否展示资源信息（showResource） |
| `showResourceModel` | 资源展示方式（showResourceModel） |
| `resourceModel` | 资源模型（resourceModel） |
| `rules` | 规则信息（rules） |
| `questions` | 常见问题（questions） |
| `activityData` | 活动数据点配置（activityData） |
| `userData` | 用户数据配置（userData） |
| `coinSort` | 交易币对展示顺序（coinSort） |
| `tradeSymbolInfo` | 合约交易对信息（tradeSymbolInfo） |
| `tradeSpotInfo` | 现货交易对信息（tradeSpotInfo） |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `imageUrlI18n` | 活动日历图片多语言（imageUrlI18n） |
| `iconUrlI18n` | 活动日历图标多语言（iconUrlI18n） |
| `activityConfigI18n` | 多语言内容（activityConfigI18n） |

