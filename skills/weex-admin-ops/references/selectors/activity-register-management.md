# Activity User Registration Management Selectors

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page path:
`/activity/register`

## Search Form

- `用户管理模板名称`: visible input placeholder `用户管理模板名称`.
- `用户报名模板id`: remote multi-select input placeholder `输入id或模板名称`; choose the real dropdown option, for example `【2709】 <模板名称>`.
- `邀请码`: visible input placeholder `请输入邀请码`.
- `最近编辑人`: visible input placeholder `请输入最近编辑人`.
- `更新开始时间`: date input placeholder `更新开始时间`; use date picker cells.
- `更新结束时间`: date input placeholder `更新结束时间`; use date picker cells.
- Search button: visible button text `搜索`.
- Add button: visible button text `新增`.

## Add Dialog

- Dialog title: `用户报名管理（新增）`.
- Confirm button: visible dialog button text `确认`.
- Cancel button: visible dialog button text `取消`.
- Prefer locating fields by `.el-form-item__label` text within the active visible `.el-dialog`.

## Base Fields

- `用户管理模板名称`: required text input.
- `平台用户参与范围`: radio group; default option is `全平台用户`.
- `限制用户参与范围`: required checkbox group.
- `可参与注册时间范围`: switch.
- `限制用户权限`: checkbox group with `报名` and `看到和进入页面`.
- `用户报名方式`: required checkbox group.
- `报名人数限制`: optional input.

## Creation Defaults Verified

- `平台用户参与范围`: `全平台用户`.
- `限制用户参与范围`: `无`.
- `可参与注册时间范围`: off.
- `限制用户权限`: leave unchecked.
- `报名人数限制`: blank.
- `团体报名方式`: requires `最小团队人数`; use `2` unless the tester specifies another value.
