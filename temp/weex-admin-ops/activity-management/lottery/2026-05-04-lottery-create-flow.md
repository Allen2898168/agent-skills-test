# 转盘抽奖活动新增草稿流程

状态：candidate  
最近验证：2026-05-04  
目标环境：staging，`https://stg-activity.weex.tech`  
入口页面：`/activities/lottery/add`  
来源参考活动：`/activities/lottery/view?activityId=8358`  
本次成功创建活动：`/activities/lottery/view?activityId=8962`  
是否纳入 skill：否  
是否写入交接文档：否  

## 操作目的

在真实浏览器模式下跑通转盘抽奖活动的新增草稿流程，记录新增页配置项、依赖接口、已验证的业务限制和成功断言。该记录作为暂存区内容，供后续继续操作或正式沉淀到 skill 时参考。

## 前置条件

- staging 后台可登录。
- 登录只需要账号、密码、`谷歌验证码`；普通 `验证码` 在当前 staging 流程中不需要填写。
- 默认账号为 `auto`，密码和 Google code 从本机环境变量或未提交的 `.env.local` 读取。
- 默认奖品图片目录：`skills/weex-admin-ops/assets/default-prize-images/`。
- 本次使用默认图片：`skills/weex-admin-ops/assets/default-prize-images/default-bonus-prize.webp`。
- 需要已有可用的转盘抽奖活动作为参考配置，本次使用活动 `8358`。
- 需要已有可用的报名模板、奖品和转盘抽奖任务。

## 新增页模块

新增页 `/activities/lottery/add` 已确认包含以下模块：

- 活动基本信息。
- 抽奖样式配置。
- 抽奖奖品配置。
- 抽奖权重配置。
- 颜色签配置。
- 配置分享信息。
- 奖品每日限制配置。
- 累计次数再权重配置。
- 活动任务信息。
- 多语言。
- 常见问题。
- 活动日历。
- 操作。

## 已验证依赖接口

新增页挂载时以下接口返回 200：

- `GET /prod-api/activity/getAreaInfoList`
- `GET /prod-api/activity/apply/vipLevel/list`
- `GET /prod-api/activity/guideTemplate/list?activityType=LOTTERY&pageNum=1&pageSize=100`
- `GET /prod-api/activity/apply/selectAgencyGroupList`
- `GET /prod-api/activity/getRiskLabelList`
- `GET /prod-api/activity/prize/all`
- `GET /prod-api/activity/apply/all`
- `GET /prod-api/activity/task/all?activityType=5`

新增保存依赖：

- `POST /prod-api/common/uploadImgReplace`
- `GET /prod-api/activity/config/<ACTIVITY_ID>`
- `POST /prod-api/activity/config`
- `GET /prod-api/activity/config/list`

## 成功配置摘要

成功创建的草稿活动：

- 活动ID：`8962`
- 标题：`自动化转盘抽奖活动20260504190520`
- 别名：`auto-lottery-20260504190520`
- 类型：正式活动，`configType=1`
- 状态：`DRAFT`
- 开始时间：`2026-05-07 00:00:00`
- 结束时间：`2026-06-30 23:59:59`
- 活动日历：不同步，`syncCalendarFlag=0`

关键配置：

- 图片：默认资源图上传成功后，复用于 WEB 头图、H5 头图、WEB 分享图、H5 分享图、社媒预览图和 8 个奖品位图片。
- 抽奖样式：复用来源活动样式。
- 奖品配置：8 个奖品位。
- 基础奖品权重：8 个奖品位合计 100。
- 颜色签：红签和白签均配置 8 个奖品位，单签权重合计 100。
- 奖品每日限制：提交 1 条默认限制。
- 累计次数再权重：提交空数组。
- 活动任务：绑定 1 条转盘抽奖任务，排序系数为 1。
- 多语言：提交中文简体和英语。
- FAQ：提交 1 条英语 FAQ。

## 前端提交结构

新增页由多个组件的 `submit()` 输出组装最终 payload。已观察到关键结构：

- `baseForm`
- `styleForm`
- `prizeConfigForm`
- `prizeWeightForm`
- `colorTagConfigForm`
- `shareInfoForm`
- `dailyLimitForm`
- `prizeProbabilityForm`
- `activityTaskForm`
- `i18nConfigForm`
- `faqForm`
- `activityCalendarConfig`

最终 `POST /prod-api/activity/config` 的关键字段包括：

- `configType`
- `activityOwner`
- `periods`
- `title`
- `channelCategory`
- `guideTemplateId`
- `subTitle`
- `applicationMode`
- `startTime`
- `endTime`
- `intro`
- `shareContent`
- `agentShareContent`
- `webBannerUrl`
- `webShareUrl`
- `appBannerUrl`
- `appShareUrl`
- `showUrl`
- `applyConfigId`
- `ogImageUrl`
- `showActivityCalendar`
- `isPreApply`
- `preApplyConfig`
- `prize`
- `prizeLimited`
- `prizeWeight`
- `activityConfigI18n`
- `taskConfig`
- `showBeginnerTaskConfig`
- `questions`
- `prizeWeightConfig`
- `prizeColorTagWeightConfig`
- `raffleStyle`
- `periodValidity`
- `type`
- `syncCalendarFlag`

## 已验证失败路径

### 测试活动报名模板限制

第一次按测试活动提交时失败：

- `configType=0`
- 后端返回：`测试活动只允许配置参与范围为假钱账号的报名模板`
- 结论：测试活动不能直接复用普通全平台报名模板，必须选择参与范围为假钱账号的报名模板。

### 开始时间限制

第二次改为正式活动但开始时间过近时失败：

- `configType=1`
- 开始时间：`2026-05-05 00:00:00`
- 后端返回：`开始时间不可小于现在时间`
- 结论：活动开始时间需要按服务端时区预留足够未来时间，建议至少预留 48 小时以上。

## 成功断言

本次成功使用以下断言确认：

- `POST /prod-api/activity/config` 返回 `code=200`，`msg=操作成功`。
- 按别名 `auto-lottery-20260504190520` 查询列表，`GET /prod-api/activity/config/list` 返回 `total=1`。
- 列表返回活动ID `8962`，状态 `DRAFT`。
- 打开 `/activities/lottery/view?activityId=8962` 成功进入查看页。

## 操作建议

- 如果复用全平台报名模板，优先创建正式活动。
- 如果必须创建测试活动，先准备或选择“假钱账号参与范围”的报名模板。
- 活动开始时间至少预留 48 小时以上。
- 活动日历最短路径先选不同步。
- 多语言最短路径先只覆盖中文简体和英语。
- 上传图片可先上传默认资源图，再复用返回 URL；全量通过 UI 逐个上传耗时较长。
- 上线/下线、删除、上传类操作仍属于高风险状态变更，执行前需要用户确认。

## 后续迁移建议

如果用户要求将该流程落到 skill：

- 操作流程拆到 `skills/weex-admin-ops/references/operations/activity-management.md` 或更细的 lottery 专用文件。
- 页面字段和选择器拆到 `skills/weex-admin-ops/references/selectors/activity-management.md` 或 lottery 专用文件。
- 成功断言拆到 `skills/weex-admin-ops/references/assertions/activity-management.md` 或 lottery 专用文件。
- 默认配置和限制拆到 `skills/weex-admin-ops/references/defaults.md` 或业务专用 defaults。
- 若形成缓存脚本，登记到 `skills/weex-admin-ops/scripts/action-cache.json`。
- 迁移完成并验证后，删除本暂存文件或标记为已迁移。
