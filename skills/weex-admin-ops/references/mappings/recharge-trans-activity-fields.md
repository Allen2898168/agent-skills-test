# 充值交易活动（RECHARGE_TRANS_TASK）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 临时兜底，跑通后再补齐映射。

| 字段 key | 前端中文名 |
| --- | --- |
| `title` | 活动标题 |
| `subTitle` | 活动副标题 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `startTime` | 活动开始时间 |
| `endTime` | 活动结束时间 |
| `showUrl` | 活动别名（showUrl） |
| `applyConfigId` | 用户报名模版 |
| `isPreApply` | 是否预报名 |
| `preApplyConfigId` | 预报名模板（preApplyConfigId） |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |
| `webBannerUrl` | WEB头图上传 |
| `appBannerUrl` | H5头图上传 |
| `webShareUrl` | web分享图上传 |
| `appShareUrl` | H5分享图片上传 |
| `webMp4Files` | web视频上传 |
| `appMp4Files` | app视频上传 |
| `ogImageUrl` | 社媒活动预览图上传 |
| `shareContent` | 活动分享文案 |
| `agentShareContent` | 代理分享文案 |
| `expanded` | 默认展开收起 |
| `taskConfig` | 活动任务信息（taskConfig） |
| `activityConfigI18n` | 多语言内容（activityConfigI18n） |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `imageUrlI18n` | 活动日历图片多语言（imageUrlI18n） |
| `iconUrlI18n` | 活动日历图标多语言（iconUrlI18n） |

