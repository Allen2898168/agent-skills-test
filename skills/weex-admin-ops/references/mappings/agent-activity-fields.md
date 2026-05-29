# 人人代理活动（AGENT）字段：key -> 前端中文名映射（精选）

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
| `webBannerUrl` | WEB头图上传 |
| `appBannerUrl` | H5头图上传 |
| `activityLabelList` | 活动标签 |
| `taskConfig` | 活动任务配置（taskConfig） |
| `activityConfigI18n` | 多语言内容（activityConfigI18n） |
| `showEndCountdown` | 是否展示结束倒计时（showEndCountdown） |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |
| `imageUrlI18n` | 活动日历图片多语言（imageUrlI18n） |
| `iconUrlI18n` | 活动日历图标多语言（iconUrlI18n） |

