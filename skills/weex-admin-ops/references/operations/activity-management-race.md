# 交易竞速赛活动无头链路

## 适用范围

- 页面：`活动列表 / 交易竞速赛`
- 活动类型：`RACE_COMPETITION`
- 执行模式：`headless_api`

## 核心接口

- 列表：`GET /prod-api/activity/config/list?type=RACE_COMPETITION`
- 详情：`GET /prod-api/activity/config/{activityId}`
- 新增：`POST /prod-api/activity/config`
- 修改：`PUT /prod-api/activity/config`
- 上线：`POST /prod-api/activity/competition/online`
- 下线：`POST /prod-api/activity/competition/offline`
- 删除：`POST /prod-api/activity/competition/delete`

## 源码确认模块

- `交易竞速赛基本信息`
- `用户报名`
- `竞速配置`
- `奖池配置`
- `排行榜配置`
- `活动页面设置`
- `多语言`
- `常见问题`

来源：
- `activity-ui/src/views/activity/speedRace/edit.vue`
- `activity-ui/src/views/activity/speedRace/components/*.vue`
- `activity-ui/src/views/activity/competition/components/{userApply,pageSetting,langContentSetting}.vue`
- `activity-ui/src/views/activity/lottery/components/FAQForm.vue`

## 已沉淀脚本

- `skills/weex-admin-ops/scripts/race-activity-fast-api.mjs`
- `skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs`
- `skills/weex-admin-ops/scripts/race-config-wizard-api.mjs`

## 已验证模板

- 推荐模板：`8352 / jyjss`
  - 真实回查：`requirementsCount=1`、`stageCount=6`、`i18nCount=5`、`questionsCount=5`
  - 适合作为“最小/最全配置”回归模板

- 不建议用作模板：`9209 / hahha`
  - 真实回查：`requirementsCount=0`、`stageCount=0`
  - 只适合只读快照，不适合创建回归活动

## 命令

只读快照：

```bash
node skills/weex-admin-ops/scripts/race-activity-fast-api.mjs --action snapshot --activity-id 8352
```

模板结构：

```bash
node skills/weex-admin-ops/scripts/race-activity-fast-api.mjs --action inspect-template --activity-id 8352
```

创建草稿：

```bash
node skills/weex-admin-ops/scripts/race-activity-fast-api.mjs --action create-draft --template-id 8352 --title-prefix 竞速回归 --alias-prefix sr
```

模块更新：

```bash
node skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs --action update --activity-id <activityId> --spec-file /tmp/race-spec.json --confirm
```

总入口最小配置：

```bash
node skills/weex-admin-ops/scripts/race-config-wizard-api.mjs --spec-json '{"confirm":true,"preset":"minimal_create_verify_delete","confirmations":{"templateClone":true,"moduleWrites":true,"onlineOfflineDeleteWrites":true},"templateId":"8352","titlePrefix":"竞速总验","aliasPrefix":"sw","cleanup":true}' --confirm
```

总入口最全配置：

```bash
node skills/weex-admin-ops/scripts/race-config-wizard-api.mjs --spec-json '{"confirm":true,"preset":"full_create_verify_delete","confirmations":{"templateClone":true,"moduleWrites":true,"onlineOfflineDeleteWrites":true},"templateId":"8352","titlePrefix":"竞速全验","aliasPrefix":"sx","cleanup":true}' --confirm
```

## 最小配置口径

- `speedConfig.rankType=TRADING`
- `speedConfig.currencySupportType=ALL_SUPPORTED`
- `leaderboard.isShow=0`
- `i18n` 仅 `zh_CN`
- `faq` 仅 `cn`

## 最全配置口径

- `speedConfig.rankType=TRADING`
- `speedConfig.currencySupportType=PARTIALLY_SUPPORT`
- `speedConfig.productCodeList=["BTC-USDT","ETH-USDT"]`
- `prizePool.isParticipantsNum=1`
- `prizePool.isTotalPricePoolAmount=1`
- `prizePool.totalPricePoolAmount=88.88`
- `leaderboard.isShow=1`
- `leaderboard.minRank=1`
- `leaderboard.maxRank=10`
- `i18n` 为 `zh_CN + en_US`
- `faq` 为 `cn + en`

## 本轮真实验证

- 2026-05-29
- 原子链路：
  - `9698 / sr51628774`：创建 -> 最小更新 -> 回查 -> 删除
  - `9699 / sr51692669`：创建 -> 最全更新 -> 回查 -> 删除
- 总入口：
  - `9701 / sw51783658`：`minimal_create_verify_delete` 成功并自动删除
  - `9702 / sx51798404`：`full_create_verify_delete` 成功并自动删除
