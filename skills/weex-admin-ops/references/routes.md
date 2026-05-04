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

### Activity Task Management

Status: candidate
Last verified: 2026-05-04

Business domain:
活动通用模块管理 / 活动任务管理。

Path:
`/activity/task`

Login redirect:
`/login?redirect=%2Factivity%2Ftask`

Observed page signals:
- Breadcrumb/page text includes `活动通用模块管理 / 活动任务管理`.
- Search form includes placeholders `任务编号`, `任务别名`, `任务标签`, `备注`, `开始时间`, `结束时间`, `总分>=转手动发奖`, `标签-转手动发奖`, and `报名国家-转手动发奖`.
- Table headers include `任务编号`, `任务别名`, `任务内容`, `平台用户参与范围`, `发奖审核类别`, `总分-转手动发奖`, `标签-转手动发奖`, `报名国家-转手动发奖`, `邀请码-转手动发奖`, `合伙人分组-转手动发奖`, `任务标签`, `备注`, `更新时间`, `最近编辑人`.

Operations likely available:
- 搜索
- 新增
- 导出
- 批量新增/配置动态发奖风控
- 查看
- 修改
- 复制
- 删除
- 历史
