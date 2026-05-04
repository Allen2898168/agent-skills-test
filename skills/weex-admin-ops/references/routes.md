# Routes

## Environment Bases

- staging: `https://stg-activity.weex.tech`

## Known Pages

### Offline User Manage / Fake Money Account

Status: candidate
Last verified: 2026-05-04

Path:
`/activities/offline/userManage`

Login redirect:
`/login?redirect=%2Factivities%2Foffline%2FuserManage`

Observed page signals:
- Breadcrumb/page text includes `首页 / 活动列表 / 假钱账户`.
- Main content includes `假钱账户`.
- Search/filter area includes `UID状态`.
- Table headers include `序号`, `UID`, `AccountId`, `假钱账户`, `API Key`, `API Secret`, `Passphrase`, `状态`, `备注`, `操作`.

Operations likely available:
- 查询
- 重置
- 新增
- 导出
- 批量删除
- 假钱账户模板
- 增量更新

### Prize Management

Status: candidate
Last verified: 2026-05-04

Business domain:
活动通用模块管理 / 奖品管理。

Path:
`/activity/prize`

Login redirect:
`/login?redirect=%2Factivity%2Fprize`

Observed page signals:
- Breadcrumb/page text includes `活动通用模块管理 / 奖品管理`.
- Search form includes `奖品ID`, `奖品分类`, `奖品子类别`, `奖品名称`, `奖品别名`.
- Table headers include `奖品ID`, `奖品分类`, `奖品子分类`, `奖品名称`, `奖品别名`, `奖品单位`, `奖品展示精度`, `奖品图片`, `操作`.

Operations likely available:
- 搜索
- 新增
- 查看
- 修改
- 复制
- 删除
