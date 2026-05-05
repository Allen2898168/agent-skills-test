# Activity User Registration Management Assertions

Business domain:
活动通用模块管理 / 活动用户报名管理。

## Page Load

Success:
- Final URL path is `/activity/register`.
- Page text includes `活动通用模块管理 / 活动用户报名管理`.
- Search form and table are visible.
- `GET /prod-api/activity/apply/list?pageNum=1&pageSize=10` returns HTTP 200.
- `GET /prod-api/activity/apply/all` returns HTTP 200.

## Search

Success:
- Search URL or list request contains the expected query parameter.
- Table rows match the searched value, or a deliberate no-match query returns an empty list.
- For `用户报名模板id`, select a real remote dropdown option before searching; typed text alone is not enough.
- For update date filters, click a real Element UI date cell; setting the input value directly is not enough.

## Create Registration Template

Success:
- `POST /prod-api/activity/apply` returns HTTP 200 with `code=200` and `msg=操作成功`.
- The add dialog closes or the list refreshes.
- Searching by the created `用户管理模板名称` returns a row with:
  - `用户报名模板id`
  - the created `用户管理模板名称`
  - `平台用户参与范围` equal to `全平台用户` for the default creation chain
  - `最近编辑人` equal to the staging account display name

Failure or blocked:
- Visible `.el-form-item__error` after clicking `确认`.
- No `POST /prod-api/activity/apply` request is observed.
- Search by created template name does not return the row.
