# 大富翁世界杯（MONOPOLY_WORLD_CUP）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 或整段覆盖 `monopolyList` 兜底，跑通后再补齐映射。

## 活动基本信息（base）

| 字段 key | 前端中文名 |
| --- | --- |
| `configType` | 配置类型 |
| `activityOwner` | 负责人 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `showUrl` | 活动别名 |
| `expanded` | 规则默认展开收起 |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `contractTradingVolumeTaskId` | 合约交易量任务（决定下单方式一致性） |
| `activityConfigI18n[]` | 多语言配置列表（标题/副标题/规则/图片/分享等） |

多语言内字段（`activityConfigI18n[*]`）常用项：
| 字段 key | 前端中文名 |
| --- | --- |
| `activityConfigI18n[].title` | 活动标题（多语言） |
| `activityConfigI18n[].subTitle` | 活动副标题（多语言） |
| `activityConfigI18n[].intro` | 活动内容规则（多语言） |
| `activityConfigI18n[].webBannerUrl` | 活动Web配图（多语言） |
| `activityConfigI18n[].webMp4Files` | 活动Web动图（多语言） |
| `activityConfigI18n[].appBannerUrl` | 活动H5配图（多语言） |
| `activityConfigI18n[].appMp4Files` | 活动H5动图（多语言） |
| `activityConfigI18n[].shareContent` | 活动分享文案（多语言） |
| `activityConfigI18n[].agentShareContent` | 代理分享文案（多语言） |
| `activityConfigI18n[].webShareUrl` | 分享web/h5活动配图（多语言） |
| `activityConfigI18n[].myShareContent` | 我的分享文案（多语言） |
| `activityConfigI18n[].myShareUrl` | Web/H5我的分享配图（多语言） |

## 用户报名（userApply）

| 字段 key | 前端中文名 |
| --- | --- |
| `applyConfigId` | 用户报名模版 |

## 未登录说明内容（notLoggedDescription）

说明：该模块保存于 `monopolyList[*].extraInfo.descriptionContent`（页面会用第一份 descriptionContent 进行回填）。

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[].extraInfo.descriptionContent.webPicture` | Web配图（支持webp，多语言） |
| `monopolyList[].extraInfo.descriptionContent.webGif` | Web动图（支持MP4，多语言） |
| `monopolyList[].extraInfo.descriptionContent.appPicture` | H5配图（支持webp，多语言） |
| `monopolyList[].extraInfo.descriptionContent.appGif` | H5动图（支持MP4，多语言） |

## 配置管理（monopolyConfigs）

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[]` | 渠道配置列表（默认/官网/渠道） |
| `monopolyList[].channelType` | 渠道类型（官网/渠道） |

## 棋盘配置（board）

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[].boardSize` | 格子总数 |
| `monopolyList[].gridConfig.autoRewardEnabled` | 自动发奖开关 |
| `monopolyList[].gridConfig.grids[]` | 格子配置（16格 + 高额格） |
| `monopolyList[].gridConfig.grids[].gridNo` | 格子编号 |
| `monopolyList[].gridConfig.grids[].prizeId` | 奖励（奖品模版） |
| `monopolyList[].gridConfig.grids[].displayMin` | 格子显示数量-最小值 |
| `monopolyList[].gridConfig.grids[].displayMax` | 格子显示数量-最大值 |
| `monopolyList[].gridConfig.grids[].rewardDisplayCount` | 奖励显示数量 |
| `monopolyList[].gridConfig.grids[].rewardRealCount` | 奖励真实数量（库存） |
| `monopolyList[].gridConfig.fallbackGrid` | 兜底格子 |

## 奖励列表（rewardPool）

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[].pointPoolPrizeList[]` | 奖励列表（积分池） |
| `monopolyList[].pointPoolPrizeList[].prizeId` | 奖品ID |
| `monopolyList[].pointPoolPrizeList[].total` | 总数 |
| `monopolyList[].pointPoolPrizeList[].sort` | 排序系数 |

## 任务配置（tasks）

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[].taskConfig` | 任务配置总对象 |
| `monopolyList[].taskConfig.*.moduleIntro` | 模块介绍 |
| `monopolyList[].taskConfig.*.tasks[]` | 任务列表（任务ID + 排序/周序号/置顶） |

## 风控阈值（risk）

| 字段 key | 前端中文名 |
| --- | --- |
| `monopolyList[].riskConfig.thresholds[]` | 风控阈值设置 |
| `monopolyList[].riskConfig.thresholds[].minValue` | 触发区间-最小值 |
| `monopolyList[].riskConfig.thresholds[].maxValue` | 触发区间-最大值 |
| `monopolyList[].riskConfig.thresholds[].ratio` | 发放比例 |

## 常见问题（faq）

| 字段 key | 前端中文名 |
| --- | --- |
| `questions[]` | 常见问题（按语言） |

## 活动日历（calendar）

| 字段 key | 前端中文名 |
| --- | --- |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |

