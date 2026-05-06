# 活动任务管理核心链路 B

## 2026-05-04 20:55 CEST 活动任务管理未完成项重跑

- 当前目标：按用户要求用浏览器模式重跑未完成的 `转盘抽奖 / 单一奖励` 任务条件。
- 环境：staging。
- 页面：`/activity/task`。
- 执行模式：可见 Chrome；CDP 未连接，使用项目 Playwright 兜底。
- 操作类型：新增活动任务，改变后台状态。
- 已成功创建：
  - `4748`：`合约交易量`，任务名 `转盘抽奖_合约交易量_retry_20260504204324`。
  - `4749`：`现货交易量`，任务名 `转盘抽奖_现货交易量_retry_20260504204324`。
  - `4750`：`现货持仓`，任务名 `转盘抽奖_现货持仓_retry_20260504204324`。
  - `4751`：`分享链接`，任务名 `转盘抽奖_分享链接_retry_20260504204324`。
  - `4752`：`邀请任务`，任务名 `转盘抽奖_邀请任务_retry3_20260504204857`。
- 未完成：
  - `首次登录APP`：`POST /prod-api/activity/task` 返回 HTTP 200，但响应体 `code=500`，信息为 `任务奖品只能选择合约抵扣金`；本轮默认选了 `抽奖次数`，所以未创建。
  - `新老现货划转任务`：页面校验 `任务条件1：请填写完整任务条件`，未提交成功。
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/operations/activity-task-management.md`
  - `skills/weex-admin-ops/references/assertions/activity-task-management.md`
- 截图：用户本轮未要求截图，未新增截图。
- 是否可回滚：成功创建的任务可通过活动任务管理行操作删除；本次未清理。

## 2026-05-05 11:05 CEST 新老现货划转任务重试

- 当前目标：按用户要求用浏览器模式重新尝试创建 `转盘抽奖 / 新老现货划转任务 / 单一奖励`。
- 环境：staging。
- 页面：`/activity/task`。
- 执行模式：可见 Chrome；CDP 未连接，使用项目 Playwright 兜底。
- 操作类型：尝试新增活动任务，后端未创建成功。
- 已完成事项：
  - 重新检查 `新老现货划转任务` 的 `任务条件1` 控件。
  - 已确认比较类型下拉选项为 `>=`、`>`。
  - 已确认填入比较类型 `>=` 和数值 `1` 后，`任务条件1` 的页面校验消失。
  - 已确认该任务类型下 `判定开始时间` 只显示 `活动开始时间`，不显示 `报名活动后`；后续创建该类型时必须选 `活动开始时间`。
  - 使用 `活动开始时间` 后成功提交到后端校验。
- 结果：
  - `POST /prod-api/activity/task` 返回 HTTP 200，但响应体为 `code=500`。
  - 后端信息：`新老划转任务重复，已配置新老划转任务的编号是:964`。
  - 本次未创建新任务。
- 当前阻塞点：
  - 该类型存在业务唯一性限制；除非复用、修改或删除已有编号 `964` 的新老划转任务，否则无法继续创建新的同类任务。
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/operations/activity-task-management.md`
  - `skills/weex-admin-ops/references/assertions/activity-task-management.md`
- 截图：用户本轮未要求截图，未新增截图。

## 2026-05-04 21:12 CEST 登录页验证码行为修正

- 当前目标：确认 staging 登录页是否需要普通 `验证码`，并修正 skill 中登录等待与验证码填写规则。
- 环境：staging。
- 页面：`/login?redirect=%2Factivities%2Flottery%2Fadd`，回归脚本使用 `/login?redirect=%2Factivity%2Fprize`。
- 操作类型：登录验证与 skill 文档/脚本更新；不改变后台业务数据。
- 已完成事项：
  - 使用 3 个独立浏览器会话验证登录：等待登录页稳定后，只填写账号、密码、`谷歌验证码`，不填写普通 `验证码`。
  - 3 次 `GET /prod-api/captchaImage` 均返回 `captchaEnabled=false`。
  - 3 次 `POST /prod-api/login` 均返回 `code=200`，最终均进入 `/activities/lottery/add`。
  - 修正复用登录函数，避免将谷歌验证码写入普通 `验证码` 字段；如果普通验证码仍可见，则提示等待页面加载完成而不是继续误填。
  - 使用修正后的 `loginToPrizePage` 回归 1 次，登录成功并进入 `/activity/prize`。
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/login.md`
  - `skills/weex-admin-ops/references/selectors.md`
  - `skills/weex-admin-ops/scripts/lib/browser.mjs`
  - `skills/weex-admin-ops/scripts/create-prizes.mjs`
  - `skills/weex-admin-ops/scripts/copy-prize.mjs`
- 验证依据：
  - 登录接口返回 `code=200`。
  - 最终 URL 离开 `/login` 并进入目标页面。
  - 未填写普通 `验证码` 字段。
- 当前阻塞点：无。
- 下一步建议：后续新增登录脚本时，先等待 `/prod-api/captchaImage` 与登录表单稳定，只填写 `谷歌验证码`；不要把 `<GOOGLE_CODE>` 复用到普通 `验证码`。
