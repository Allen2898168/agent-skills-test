# 竞猜大赛（GUESS）字段：key -> 前端中文名映射（精选）

用途：
- 用户按“前端中文字段名”描述要改哪个字段时，先映射到 payload key，再由模块级脚本执行更新。
- 该表先覆盖常用/高频字段；未覆盖的字段可先用模块级脚本的 `rawTopLevel` 或整段覆盖 `guessList` 兜底，跑通后再补齐映射。

## 基础信息 + 用户报名（base）

| 字段 key | 前端中文名 |
| --- | --- |
| `configType` | 配置类型 |
| `activityOwner` | 配置人 |
| `channelCategory` | 类别配置 |
| `guideTemplateId` | 流程引导模板 |
| `showUrl` | 别名配置（showUrl） |
| `startTime` | 开始时间 |
| `endTime` | 结束时间 |
| `isPreApply` | 是否支持预报名 |
| `preApplyStartTime` | 预报名开始时间 |
| `preApplyEndTime` | 预报名结束时间 |
| `periods` | 是否为平台活动 |
| `guessActivityType` | 竞猜类型（体育竞猜-积分模式） |
| `applyConfigId` | 用户报名模版 |
| `showActivityCalendar` | 是否显示活动日历入口 |
| `syncCalendarFlag` | 是否同步活动日历（syncCalendarFlag） |
| `syncCalendarDto` | 活动日历配置（syncCalendarDto） |

## 活动页面设置（pageSetting）

| 字段 key | 前端中文名 |
| --- | --- |
| `ogImageUrl` | 社媒活动预览图上传（ogImageUrl） |

## 多语言（i18n）

| 字段 key | 前端中文名 |
| --- | --- |
| `activityConfigI18n[]` | 多语言配置列表（含标题/副标题/奖池展示/头图/规则等） |

## 常见问题（faq）

| 字段 key | 前端中文名 |
| --- | --- |
| `questions[]` | 常见问题（按语言） |

## 渠道配置（guessConfigs）

| 字段 key | 前端中文名 |
| --- | --- |
| `guessList[]` | 渠道配置列表（官网/渠道） |
| `guessList[].channelType` | 渠道类型（官网/渠道） |
| `guessList[].taskConfig[]` | 积分任务配置（taskConfig：任务ID+排序系数） |
| `guessList[].guessPeriod[]` | 赛事分期（赛期列表） |
| `guessList[].guessTicket[]` | 赛事票数（票注入/票数列表） |
| `guessList[].prizeConfig` | 奖品配置（积分兑换时间 + 奖品表格） |

## 赛事分期（seasons）

| 字段 key | 前端中文名 |
| --- | --- |
| `guessList[].guessPeriod[].periodId` | 赛期ID |
| `guessList[].guessPeriod[].priority` | 优先级 |
| `guessList[].guessPeriod[].title` | 赛事分期标题 |
| `guessList[].guessPeriod[].titleI18[]` | 赛事分期标题（多语言） |
| `guessList[].guessPeriod[].startTime` | 竞猜开始时间 |
| `guessList[].guessPeriod[].taskConfig[]` | 竞猜任务配置（任务ID+排序系数+置顶） |

## 奖品配置（prizeConfig）

| 字段 key | 前端中文名 |
| --- | --- |
| `guessList[].prizeConfig.showFlag` | 积分兑换时间-前端展示 |
| `guessList[].prizeConfig.exchangeStartTime` | 兑换开始时间（可选：活动开始时间） |
| `guessList[].prizeConfig.exchangeEndTime` | 兑换结束时间（可选：活动结束时间） |
| `guessList[].prizeConfig.prize[]` | 奖品表格（奖品模版/消耗数量/奖品数量/限制/标记等） |
