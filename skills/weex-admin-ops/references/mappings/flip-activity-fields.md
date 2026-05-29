# 小丑牌活动（FLIP）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 或整段覆盖 `flips` 兜底，跑通后再补齐映射。

## 基础信息（base）

| 字段 key | 前端中文名 |
| --- | --- |
| `configType` | 配置类型 |
| `activityOwner` | 负责人 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `title` | 活动标题（多语言） |
| `subTitle` | 活动副标题（多语言） |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `showUrl` | 活动别名（showUrl） |
| `webBannerUrl` | 活动Web配图（支持webp，多语言） |
| `webMp4Files` | 活动Web动图（支持mp4，多语言） |
| `appBannerUrl` | 活动H5配图（支持webp，多语言） |
| `appMp4Files` | 活动H5动图（支持mp4，多语言） |
| `shareContent` | 活动分享文案（多语言） |
| `agentShareContent` | 代理分享文案（多语言） |
| `webShareUrl` | 分享web/h5活动配图（多语言） |
| `myShareContent` | 我的分享文案（多语言） |
| `myShareUrl` | Web/H5我的分享配图（多语言） |
| `applyConfigId` | 用户报名模版 |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |

## 未登录说明内容（notLoggedDescription）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].descriptionContent.webPicture` | Web配图（支持webp，多语言） |
| `flips[].descriptionContent.webGif` | Web动图（支持MP4，多语言） |
| `flips[].descriptionContent.appPicture` | H5配图（支持webp，多语言） |
| `flips[].descriptionContent.appGif` | H5动图（支持MP4，多语言） |

## 配置管理（flipConfigs）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].channelType` | 渠道类型（官网/渠道/默认） |

## 游戏玩法/牌局/牌型（card）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].playRules.rules` | 游戏玩法内容（多语言） |
| `flips[].inningDay` | 几天一局 |
| `flips[].inningPeriod` | 几天小周期（选填） |
| `flips[].cardType[]` | 牌型信息（说明/筹码/倍率/平衡系数等） |
| `flips[].jokerMultiplier` | Joker牌惩罚乘数 |

## 任务配置（tasks）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].cardTask.introduction` | 抽牌任务-模块介绍（多语言） |
| `flips[].cardTask.taskList[]` | 抽牌任务-任务列表（含排序系数） |
| `flips[].integralTask.introduction` | 积分任务-模块介绍（多语言） |
| `flips[].integralTask.taskList[]` | 积分任务-任务列表（含排序系数） |

## Buff 配置（buff）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].buffConfig[]` | Buff 配置 |
| `flips[].criticalHit` | 暴击配置 |
| `flips[].luckyConfig[]` | 幸运配置 |
| `flips[].luckyPackage[]` | 幸运包 |

## 奖励规则（rewardRule）

| 字段 key | 前端中文名 |
| --- | --- |
| `flips[].prizeInfo` | 奖品信息（Tab + 配置项） |
| `flips[].rankInfo` | 排行榜信息（Tab + 配置项） |

