# 活动用户报名管理基础链路 B

## 2026-05-05 创建活动用户报名模板并沉淀 skill/cache

- 用户已确认：
  - 按默认参数创建 8 条 `活动用户报名管理` 模板。
  - 创建跑通后沉淀到项目内 `skills/weex-admin-ops/` 并评估动作缓存。
- 执行环境：staging，页面 `https://stg-activity.weex.tech/activity/register`。
- 创建参数：
  - `平台用户参与范围`: `全平台用户`。
  - `限制用户参与范围`: `无`。
  - `可参与注册时间范围`: 关闭。
  - `限制用户权限`: 不勾选。
  - `报名人数限制`: 留空。
  - `团体报名方式`: `最小团队人数=2`。
- 可见浏览器模式创建成功：
  - `2710`: `自动化报名模板_可见_auto_20260505151322`，`注册即报名`。
  - `2711`: `自动化报名模板_可见_manual_20260505151322`，`用户手动点击报名`。
  - `2712`: `自动化报名模板_可见_team_20260505151322`，`团体报名方式`，`最小团队人数=2`。
  - `2713`: `自动化报名模板_可见_auto_manual_20260505151322`，`注册+手动点击报名方式`。
- 默认不可见模式创建成功：
  - `2714`: `自动化报名模板_不可见_auto_20260505151322`，`注册即报名`。
  - `2715`: `自动化报名模板_不可见_manual_20260505151322`，`用户手动点击报名`。
  - `2716`: `自动化报名模板_不可见_team_20260505151322`，`团体报名方式`，`最小团队人数=2`。
  - `2717`: `自动化报名模板_不可见_auto_manual_20260505151322`，`注册+手动点击报名方式`。
- 验证依据：
  - 每条创建均观察到 `POST /prod-api/activity/apply` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 每条创建后均按 `用户管理模板名称` 搜索，列表出现对应 `用户报名模板id`、模板名称、`平台用户参与范围=全平台用户`、最近编辑人 `auto`。
- 首次可见模式创建前，旧登录 helper 的 3 秒等待过短导致一次登录阶段失败；未发出新增请求。已把 `loginToPath` 改为等待 URL 离开 `/login` 最长 18 秒后再判断。
- 已同步更新：
  - `skills/weex-admin-ops/references/operations/activity-register-management.md`
  - `skills/weex-admin-ops/references/operations/index.md`
  - `skills/weex-admin-ops/references/routes.md`
  - `skills/weex-admin-ops/references/selectors/activity-register-management.md`
  - `skills/weex-admin-ops/references/assertions/activity-register-management.md`
  - `skills/weex-admin-ops/references/components.md`
  - `skills/weex-admin-ops/references/components/activity-register-management.md`
  - `skills/weex-admin-ops/references/relationships.md`
  - `skills/weex-admin-ops/references/action-cache.md`
  - `skills/weex-admin-ops/scripts/action-cache.json`
  - `skills/weex-admin-ops/scripts/create-register-templates.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-register-management/plan.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-register-management/create.mjs`
  - `skills/weex-admin-ops/scripts/cache/command.mjs`
  - `skills/weex-admin-ops/scripts/cache/matcher.mjs`
  - `skills/weex-admin-ops/scripts/lib/browser.mjs`
- 新缓存动作：`create_register_templates`。
  - dry-run 示例：`node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_register_templates --signup-modes auto,manual,team,auto_manual --dry-run`
  - 可见模式示例：`node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_register_templates --signup-modes team --min-team 2 --visible`
- `temp/` 未修改，未迁移。

## 2026-05-05 创建限制用户权限为看到和进入页面的报名模板

- 用户要求：再创建 1 条 `活动用户报名管理` 模板，`限制用户权限` 选择 `看到和进入页面`，使用浏览器模式。
- 缓存检查：
  - `run-cached-action.mjs --query "浏览器模式创建活动用户报名模板 限制用户权限 看到和进入页面" --dry-run` 命中 `create_register_templates`。
  - 但当前缓存脚本未暴露 `限制用户权限` 参数，dry-run 只能表达默认模板，因此未按缓存执行，回退可见浏览器手动链路。
- 创建参数：
  - `平台用户参与范围`: `全平台用户`。
  - `限制用户参与范围`: `无`。
  - `限制用户权限`: `看到和进入页面`。
  - `用户报名方式`: `注册即报名`。
  - 其他字段保持默认空/关闭。
- 创建成功：
  - `用户报名模板id`: `2718`
  - `用户管理模板名称`: `自动化报名模板_可见_权限进入_20260505152312`
  - 模式：可见浏览器模式。
- 验证依据：
  - `POST /prod-api/activity/apply` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 按模板名称搜索，列表返回模板 `2718`，`平台用户参与范围=全平台用户`，最近编辑人 `auto`。
- 后续可优化：将 `限制用户权限` 参数补到 `create_register_templates` 缓存脚本，支持 `报名` / `看到和进入页面` / 两者组合。
- `temp/` 未修改，未迁移。

## 2026-05-05 创建报名人数限制为 100 的报名模板

- 用户要求：再创建 1 条 `活动用户报名管理` 模板，`报名人数限制=100`。
- 执行模式：默认不可见浏览器模式。
- 缓存检查：
  - `run-cached-action.mjs --action create_register_templates --signup-modes auto --people-limit 100 --dry-run` 参数正确。
  - 实际执行复用 `create_register_templates` 缓存脚本。
- 创建参数：
  - `平台用户参与范围`: `全平台用户`。
  - `限制用户参与范围`: `无`。
  - `用户报名方式`: `注册即报名`。
  - `报名人数限制`: `100`。
- 创建成功：
  - `用户报名模板id`: `2719`
  - `用户管理模板名称`: `自动化报名模板_auto_20260505152502`
- 验证依据：
  - `POST /prod-api/activity/apply` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 按模板名称搜索，列表返回模板 `2719`，`平台用户参与范围=全平台用户`，最近编辑人 `auto`。
  - 打开 `用户报名管理（编辑）` 弹窗只读复查，`报名人数限制` 字段值为 `100`；未提交修改。
- 本次是既有缓存链路的参数化使用，不新增 skill/cache 结构。
- `temp/` 未修改，未迁移。

## 2026-05-05 补充报名模板限制用户权限缓存参数

- 用户追问：`限制用户权限=看到和进入页面` 为什么没有入缓存。
- 原因：`create_register_templates` 已有缓存动作，但当时脚本未暴露 `限制用户权限` 参数；可见浏览器创建成功后只记录了后续优化，没有立即补缓存参数。
- 已按用户确认补齐缓存参数：
  - `--permissions signup` 映射 `限制用户权限=报名`。
  - `--permissions view` 映射 `限制用户权限=看到和进入页面`。
  - 支持组合：`--permissions signup,view`。
- 已更新：
  - `skills/weex-admin-ops/scripts/business/activity-register-management/plan.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-register-management/create.mjs`
  - `skills/weex-admin-ops/scripts/create-register-templates.mjs`
  - `skills/weex-admin-ops/scripts/cache/command.mjs`
  - `skills/weex-admin-ops/scripts/cache/matcher.mjs`
  - `skills/weex-admin-ops/scripts/run-cached-action.mjs`
  - `skills/weex-admin-ops/scripts/action-cache.json`
  - `skills/weex-admin-ops/references/action-cache.md`
  - `skills/weex-admin-ops/references/operations/activity-register-management.md`
- 验证：
  - 直接 dry-run：`create-register-templates.mjs --signup-modes auto --permissions view --dry-run`，计划包含 `permissions=["看到和进入页面"]`。
  - 组合 dry-run：`create-register-templates.mjs --signup-modes auto --permissions signup,view --people-limit 100 --dry-run`，计划包含 `permissions=["报名","看到和进入页面"]` 和 `peopleLimit=100`。
  - 自然语言 dry-run：`run-cached-action.mjs --query "浏览器模式创建活动用户报名模板 限制用户权限 看到和进入页面" --dry-run`，命令包含 `--permissions view --visible --dry-run`。
  - 自然语言误判已修复：`报名模板` 中的 `报名` 不再误判为权限 `signup`。
- 本次只更新缓存参数和文档，未创建新后台数据。
- `temp/` 未修改，未迁移。

## 2026-05-05 浏览器模式探测报名模板指定参赛代理或用户参数

- 用户要求：在 `活动用户报名管理` 新增弹窗中，选择 `平台用户参与范围=指定参赛代理或用户`，先看需要什么参数，使用浏览器模式。
- 缓存检查：
  - `run-cached-action.mjs --query "浏览器模式 活动用户报名管理 指定参赛代理或用户 参数探测" --dry-run` 命中默认 `create_register_templates`。
  - dry-run 只能表达默认创建，不能表达 `指定参赛代理或用户` 参数探测，因此未按缓存执行。
- 执行模式：可见浏览器模式，只读探测，未点击 `确认`，未创建数据。
- 页面：`https://stg-activity.weex.tech/activity/register`。
- 选择 `指定参赛代理或用户` 后新增/变化字段：
  - `合伙人分组`：下拉选择；示例选项包括 `bjzhou`、`bjAmy`、`商务Lan`、`商务Melissa`、`bdaaron123`、`0820bdrick`、`t2`、`t2674392986`、`lucas`、`cobb` 等。
  - `指定代理`：radio `输入` / `导入`。
    - `输入`：textarea，占位 `请输入代理uid，多个请用英文逗号隔开`。
    - `导入`：只读 textarea，占位 `请上传代理uid`；按钮 `代理uid模版下载`、`代理uid上传`；存在 1 个 file input。
  - `代理角色细分`：switch。
  - `指定用户UID`：radio `输入` / `导入`。
    - `输入`：textarea，占位 `请输入用户uid，多个请用英文逗号隔开`。
    - `导入`：只读 textarea，占位 `请上传用户uid`；按钮 `用户uid模版下载`、`用户uid上传`；存在 1 个 file input。
  - `用户报名方式` 额外出现选项：`活动开始后，满足条件的用户系统自动报名`。
- 仍需配置的基础必填字段：
  - `用户管理模板名称`：必填。
  - `限制用户参与范围`：必填，至少选一个；此分支下可选项不包含 `限制渠道码/邀请码`，可见选项包括 `无`、代理/用户/国家/KYC/设备/VIP/风控/余额等。
  - `用户报名方式`：必填。
- 可选字段：
  - `可参与注册时间范围` switch。
  - `限制用户权限`：`报名`、`看到和进入页面`。
  - `报名人数限制`。
- 关键接口：
  - `GET /prod-api/activity/apply/list?pageNum=1&pageSize=10` HTTP 200。
  - `GET /prod-api/activity/apply/all` HTTP 200。
  - `GET /prod-api/activity/apply/vipLevel/list` HTTP 200。
  - `GET /prod-api/activity/apply/selectAgencyGroupList` HTTP 200。
- 本轮发现比当前 `activity-register-management.md` 更细的分支字段；如用户确认，应沉淀到 skill，并评估是否把 `create_register_templates` 扩展为支持 `平台用户参与范围=指定参赛代理或用户`、UID 输入、合伙人分组、系统自动报名选项。
- `temp/` 未修改，未迁移。

## 2026-05-05 浏览器模式批量创建转盘抽奖任务和报名模板

- 用户要求：浏览器模式创建 7 个任意 `转盘抽奖` 任务，然后创建 6 个 `活动用户报名模板`。
- 执行前按规则 dry-run 并让用户确认缓存参数：
  - 转盘任务：`create_roulette_participant_scope_tasks --scopes all,vip,newuser,nocharge,olduser,agent,user --uid 9881271952 --visible`。
  - 报名模板第一批：`create_register_templates --signup-modes auto,manual,team,auto_manual --visible`。
  - 报名模板第二批：`create_register_templates --signup-modes auto,manual --name-prefix 自动化报名模板_补充 --visible`。
- 初次执行转盘任务时，登录 helper 两次误判普通验证码可见，未创建任何数据；只读检查确认 `/prod-api/captchaImage` 返回 `captchaEnabled=false`，页面只有 `账号`、`密码`、`谷歌验证码`。已修复 `scripts/lib/browser.mjs`：普通验证码判断改为 DOM 精确匹配 `placeholder === "验证码"`，避免误判 `谷歌验证码` 或隐藏输入。
- 转盘抽奖任务创建成功 7 条，均为可见浏览器模式：
  - `4802`: `转盘抽奖_scope_all_20260505155743`，参与范围 `报名的所有用户`。
  - `4803`: `转盘抽奖_scope_vip_20260505155743`，参与范围 `VIP 等级`，`VIP 0` 到 `VIP 0`，`VIP白名单允许=同等级允许`。
  - `4804`: `转盘抽奖_scope_newuser_20260505155743`，参与范围 `注册新用户`，选择 `活动期间注册用户`。
  - `4805`: `转盘抽奖_scope_nocharge_20260505155743`，参与范围 `未充值新用户`。
  - `4806`: `转盘抽奖_scope_olduser_20260505155743`，参与范围 `老用户`，选择 `活动开始前注册用户`。
  - `4807`: `转盘抽奖_scope_agent_20260505155743`，参与范围 `指定代理`，UID `9881271952`。
  - `4808`: `转盘抽奖_scope_user_20260505155743`，参与范围 `指定用户`，UID `9881271952`。
- 转盘任务验证依据：
  - 每条均观察到 `POST /prod-api/activity/task` HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 每条创建后均按任务别名搜索，列表返回对应任务编号和参与范围。
- 活动用户报名模板创建成功 6 条，均为可见浏览器模式：
  - `2720`: `自动化报名模板_auto_20260505160032`，`注册即报名`。
  - `2721`: `自动化报名模板_manual_20260505160032`，`用户手动点击报名`。
  - `2722`: `自动化报名模板_team_20260505160032`，`团体报名方式`，`最小团队人数=2`。
  - `2723`: `自动化报名模板_auto_manual_20260505160032`，`注册+手动点击报名方式`。
  - `2724`: `自动化报名模板_补充_auto_20260505160137`，`注册即报名`。
  - `2725`: `自动化报名模板_补充_manual_20260505160137`，`用户手动点击报名`。
- 报名模板验证依据：
  - 每条均观察到 `POST /prod-api/activity/apply` HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 每条创建后均按模板名称搜索，列表返回对应模板 ID，`平台用户参与范围=全平台用户`，最近编辑人 `auto`。
- 本次是复用既有缓存链路和已记录参数；除登录 helper 误判修复外，未新增业务参数。
- `temp/` 未修改，未迁移。
