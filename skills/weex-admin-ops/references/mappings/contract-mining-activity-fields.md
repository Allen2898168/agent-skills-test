# 合约挖矿活动（CONTRACT_MINING）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 临时兜底，跑通后再补齐映射。

## 基本信息（base）

| 字段 key | 前端中文名 |
| --- | --- |
| `configType` | 配置类型 |
| `activityOwner` | 配置人 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `startTime` | 活动起止时间-开始时间 |
| `endTime` | 活动起止时间-结束时间 |
| `showUrl` | 活动别名（showUrl） |
| `webPictureI18` | 活动Web配图（支持webp，多语言） |
| `webGifI18` | 活动Web动图（支持mp4/mov/webm，多语言） |
| `appPictureI18` | 活动H5配图（支持webp，多语言） |
| `appGifI18` | 活动H5动图（支持mp4/mov/webm，多语言） |
| `shareContentI18` | 活动分享文案（多语言） |
| `agentShareContentI18` | 代理分享文案（多语言） |
| `shareUrlI18` | 分享web/h5活动配图（多语言） |
| `rewardUrlI18` | 分享web/h5奖励配图（多语言） |
| `tagsI18` | 活动标语（多语言） |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `activityConfigI18n` | 标题/副标题/规则/分享文案多语言（activityConfigI18n） |

## 未登录说明内容（notLoggedDescription）

| 字段 key | 前端中文名 |
| --- | --- |
| `descriptionContent.webPictureI18` | Web配图（支持webp，多语言） |
| `descriptionContent.webGifI18` | Web动图（支持MP4，多语言） |
| `descriptionContent.appPictureI18` | H5配图（支持webp，多语言） |
| `descriptionContent.appGifI18` | H5动图（支持MP4，多语言） |

## 用户报名模版（applyTemplate）

| 字段 key | 前端中文名 |
| --- | --- |
| `applyConfigId` | 用户报名模版 |

## 渠道配置管理（channelConfigs）

| 字段 key | 前端中文名 |
| --- | --- |
| `miningList[].channelType` | 渠道类型（官网/渠道/默认） |
| `miningList[].taskConfig` | 任务配置（taskConfig） |
| `miningList[].showPoolFlag` | 是否显示矿池 |
| `miningList[].showWeLaunchFlag` | 是否显示WE Launch入口 |
| `miningList[].showBuybackNoticeFlag` | 是否显示回购栏 |
| `miningList[].buybackValue` | 回购价值 |
| `miningList[].buybackTime` | 回购时间 |
| `miningList[].buybackNoticeUrlI18` | 回购公告链接（多语言） |
| `miningList[].showAgentTaskFlag` | 是否显示任务（人人代理第一个任务入口） |
| `miningList[].descriptionContent` | 未登录说明内容（descriptionContent） |
| `miningList[].tagsI18` | 活动标语（多语言） |
| `miningList[].webPictureI18` | 活动Web配图（多语言） |
| `miningList[].webGifI18` | 活动Web动图（多语言） |
| `miningList[].appPictureI18` | 活动H5配图（多语言） |
| `miningList[].appGifI18` | 活动H5动图（多语言） |
| `miningList[].shareUrlI18` | 分享web/h5活动配图（多语言） |
| `miningList[].rewardUrlI18` | 分享web/h5奖励配图（多语言） |

## 活动规则（rules）

| 字段 key | 前端中文名 |
| --- | --- |
| `intro` | 活动规则（中文） |
| `introI18` | 活动规则（多语言） |

## 活动日历（calendar）

| 字段 key | 前端中文名 |
| --- | --- |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `imageUrlI18n` | 活动日历图片多语言（imageUrlI18n） |
| `iconUrlI18n` | 活动日历图标多语言（iconUrlI18n） |

