# Prize Management Assertions

Business domain:
活动通用模块管理 / 奖品管理。

## Page Loaded

Success:
- Final URL path is `/activity/prize`.
- Breadcrumb/page text includes `活动通用模块管理` and `奖品管理`.
- Search form contains `奖品ID`, `奖品分类`, `奖品子类别`, `奖品名称`, and `奖品别名`.
- Table headers include `奖品ID`, `奖品分类`, `奖品子分类`, `奖品名称`, `奖品别名`, and `操作`.

## Search Assertions

- Prize ID exact search: every returned row has `奖品ID` equal to the searched ID.
- Empty prize ID search: list returns to normal first page view with multiple rows.
- Prize category search: every returned row has `奖品分类` equal to the selected category. If no rows are returned for a category, treat it as a data availability issue and record `暂无数据`.
- Prize subcategory search: select `奖品分类` first, then select a visible `奖品子类别`; every returned row has `奖品分类` equal to the selected category and `奖品子分类` equal to the selected subcategory. If no rows are returned for a category/subcategory pair, treat it as a data availability issue and record `暂无数据`.
- Prize name fuzzy search: every returned row's `奖品名称` contains the search text.
- Prize alias fuzzy search: every returned row's `奖品别名` contains the search text.

## Create Assertions

- Create bonus prize: submit request to `/prod-api/activity/prize` returns HTTP 200 and page displays `新增成功`.
- Create coin prize: submit request to `/prod-api/activity/prize` returns HTTP 200 and page displays `新增成功`.
- Create physical prize: submit request to `/prod-api/activity/prize` returns HTTP 200 and page displays `新增成功`.
- Create virtual qualification prize: submit request to `/prod-api/activity/prize` returns HTTP 200 and page displays `新增成功`.
- After create, searching by the unique alias returns the created row.
- Created `赠金 / 赠金` row should show the expected prize name, alias, unit, and display precision.
- Created `币种 / <ticker>` row should show the expected prize name, alias, unit, display precision, and selected ticker as `奖品子分类`.
- Created `实物 / 实物` row should show the expected prize name, alias, unit, and display precision.
- Created `虚拟积分或资格 / <subtype>` row should show the expected prize name, alias, and selected subtype as `奖品子分类`.
- Image upload should complete before submit; observed upload endpoint is `/prod-api/common/uploadImgReplace`.

## Known Create Failure Assertions

- `仓位空投`: if the page returns `请选择交易对`, treat the create attempt as failed even if other fields appear filled. Re-open the add dialog, select actual option(s) in the `交易对` multi-select dropdown, click a blank area to collapse the dropdown, then continue filling and retry.
- `仓位空投`: if the page returns `请上传奖品图片`, treat the create attempt as failed. Retry by setting files on the `input[type=file]` inside the `奖品图片` form item and wait for `/prod-api/common/uploadImgReplace` to return HTTP 200 before submitting.

## Row Action Assertions

- View action: clicking `查看` opens `.el-dialog:visible`; collected form input values include the target prize name and alias.
- Edit action: clicking `修改` opens `.el-dialog:visible`; collected form input values include the current alias; submitting changed fields returns HTTP 200 from `PUT /prod-api/activity/prize`; searching by the same alias shows the updated value.
- Copy action: clicking `复制` opens `.el-message-box:visible`; confirming returns HTTP 200 from `POST /prod-api/activity/prize/copy`; the copied row name starts with `复制从 ` and contains the source prize name.
- Delete action: clicking `删除` opens `.el-message-box:visible`; confirming returns HTTP 200 from `DELETE /prod-api/activity/prize/<id>`; searching by the deleted copied row ID no longer returns that copied row.

Optional screenshots:
- Page screenshot directory: `artifacts/screenshots/活动通用模块管理/奖品管理/`.
- Search screenshot directory: `artifacts/screenshots/活动通用模块管理/奖品管理/搜索功能/`.
- Subcategory search screenshot directory: `artifacts/screenshots/活动通用模块管理/奖品管理/搜索功能/奖品子类别/`.
- Row action screenshot directory: `artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/`.
