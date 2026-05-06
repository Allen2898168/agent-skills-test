# 活动任务参与范围链路 B

## 2026-05-05 补充创建参与范围阻塞项

- 当前目标：按用户补充，重试前一轮未创建的 `指定代理`、`指定用户`、`指定国家或地区` 三种参与范围任务。
- 执行环境：staging，`https://stg-activity.weex.tech/activity/task`。
- 用户补充参数：
  - UID 改用 `9881271952`。
  - `指定国家或地区` 是多选下拉，选项点击后需要点击父级 dialog 空白区域收起。
- 通用配置：沿用前一轮 `转盘抽奖 / 单一奖励` 默认配置，正常奖励 `495 - auto_test_prize_08_1777974000001`，最小值 `10`，每日上限 `5`，总上限 `50`。
- 成功创建：
  - `指定代理`：任务编号 `4789`，任务别名 `转盘抽奖_scope_agent_retry_20260505121529`，UID `9881271952`。
  - `指定用户`：任务编号 `4790`，任务别名 `转盘抽奖_scope_user_retry_20260505121529`，UID `9881271952`。
  - `指定国家或地区`：任务编号 `4791`，任务别名 `转盘抽奖_scope_country_retry_20260505121529`，国家/地区选择 `中国`。
- 验证依据：
  - 三条创建均观察到 `POST /prod-api/activity/task` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 三条创建后均按任务别名搜索，`GET /prod-api/activity/task/list?name=<任务别名>` 返回 HTTP 200，列表中出现对应任务编号和别名。
- 执行中发现：
  - UID `123456` 会被 `指定代理` 和 `指定用户` 校验为无效；UID `9881271952` 可用。
  - `指定国家或地区` 多选稳定路径：定位 `指定国家或地区` 表单项内 `.el-select` 父容器，打开下拉后选择可用项，随后点击 `.el-dialog` 空白区域收起；需校验表单项内出现 `.el-tag` 文案，本次为 `中国`。
- 当前状态：
  - 不同参与范围 8 条单独任务均已创建完成。
  - `skills/weex-admin-ops/` 未更新；如需沉淀稳定路径，需要用户确认后再写入 skill references 和可复用脚本。

## 2026-05-05 沉淀转盘抽奖参与范围链路到 skill

- 当前目标：按用户确认，把已走通的 `转盘抽奖` 任务参与范围字段发现、创建链路、阻塞与重试规则沉淀到项目内 `skills/weex-admin-ops/`；不迁移 `temp/`。
- 已更新文件：
  - `skills/weex-admin-ops/references/operations/activity-task-roulette-participant-scopes.md`
  - `skills/weex-admin-ops/references/operations/index.md`
  - `skills/weex-admin-ops/references/selectors/activity-task-management.md`
  - `skills/weex-admin-ops/references/components.md`
  - `skills/weex-admin-ops/references/relationships.md`
  - `docs/session-handoff.md`
- 沉淀内容：
  - 参与范围 8 个选项和单独选择后的新增字段。
  - 单一奖励默认创建路径和 8 条已创建记录。
  - UID 校验规则：`123456` 无效，`9881271952` 可用。
  - `指定国家或地区` 多选稳定操作：点击表单项内 `.el-select`，选择选项后点击父级 `.el-dialog` 空白区域收起，并断言 `.el-tag` 出现。
- 当前状态：
  - `temp/` 未修改。
  - 尚未新增缓存脚本；后续如该链路需要重复创建，可抽成 `scripts/business/activity-task-management/` 脚本并登记 action cache。

## 2026-05-05 不可见模式创建 8 条转盘抽奖参与范围任务

- 当前目标：按用户要求，使用默认不可见浏览器模式，通过动作缓存创建 8 条不同 `任务参与范围` 的 `转盘抽奖 / 单一奖励` 任务。
- 执行命令：`node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_roulette_participant_scope_tasks --scopes all,vip,newuser,nocharge,olduser,agent,user,country --uid 9881271952 --country 中国`
- 执行环境：staging，最终页面 `https://stg-activity.weex.tech/activity/task`。
- 本轮创建成功：
  - `4792`：`报名的所有用户`，任务别名 `转盘抽奖_scope_all_20260505124634`。
  - `4793`：`VIP 等级`，任务别名 `转盘抽奖_scope_vip_20260505124634`，起止等级 `VIP 0` 到 `VIP 0`，白名单 `同等级允许`。
  - `4794`：`注册新用户`，任务别名 `转盘抽奖_scope_newuser_20260505124634`，选项 `活动期间注册用户`。
  - `4795`：`未充值新用户`，任务别名 `转盘抽奖_scope_nocharge_20260505124634`。
  - `4796`：`老用户`，任务别名 `转盘抽奖_scope_olduser_20260505124634`，选项 `活动开始前注册用户`。
  - `4797`：`指定代理`，任务别名 `转盘抽奖_scope_agent_20260505124634`，UID `9881271952`。
  - `4798`：`指定用户`，任务别名 `转盘抽奖_scope_user_20260505124634`，UID `9881271952`。
  - `4799`：`指定国家或地区`，任务别名 `转盘抽奖_scope_country_20260505124634`，国家/地区 `中国`。
- 验证依据：
  - 每条创建均观察到 `POST /prod-api/activity/task` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 每条创建后均按任务别名搜索，`GET /prod-api/activity/task/list?name=<任务别名>` 返回 HTTP 200，列表出现对应任务编号。
- 不可见模式修复点：
  - 本地普通 Node 未解析到 Playwright 时，需要设置 `NODE_PATH=/Users/gabriel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules` 或使用内置 Node runtime。
  - 多语言英语控件存在隐藏 textarea；脚本只填写可见英语控件。
  - `任务组合` 在不可见 DOM 中是下拉框，placeholder `请选择任务数`，需选择第一个可用项。
  - `KYC限制` 是 radio，需点击 `无kyc限制`，不能按下拉处理。
  - `任务备注` 为必填字段。
  - Element UI 下拉点击应优先点击 `.el-select` 容器，避免内层 span 拦截。
- 已同步更新：
  - `skills/weex-admin-ops/references/operations/activity-task-roulette-participant-scopes.md`
  - `skills/weex-admin-ops/references/action-cache.md`
  - `skills/weex-admin-ops/references/components.md`
  - `skills/weex-admin-ops/scripts/action-cache.json`
  - `skills/weex-admin-ops/scripts/business/activity-task-management/roulette-participant-create.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-task-management/roulette-participant-ui.mjs`
  - `skills/weex-admin-ops/scripts/lib/element-ui.mjs`
- `temp/` 未修改，未迁移。

## 2026-05-05 创建带英语多语言字段的转盘抽奖任务

- 当前目标：按用户要求，创建 1 条任意 `转盘抽奖` 任务，且任务名称、任务内容、任务标签均配置英语多语言。
- 执行模式：默认不可见浏览器模式，复用动作缓存脚本 `scripts/create-roulette-participant-scope-tasks.mjs`。
- 执行环境：staging，最终页面 `https://stg-activity.weex.tech/activity/task`。
- 创建成功：
  - 任务编号 `4800`
  - 任务别名 `转盘抽奖_英语多语言_all_20260505125346`
  - 参与范围 `报名的所有用户`
  - 中文任务内容 `自动化转盘抽奖参与范围任务`
  - 任务标签 `roulette_scope_all`
  - 英语字段由脚本在提交前填入：任务名称 `Roulette scope all 20260505125346`，任务内容 `Automated roulette participant scope task`，任务标签 `roulette_scope_all`。
- 验证依据：
  - `POST /prod-api/activity/task` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 按任务别名搜索，`GET /prod-api/activity/task/list?name=转盘抽奖_英语多语言_all_20260505125346` 返回 HTTP 200，列表出现任务编号 `4800`。
- 本次是复用既有缓存链路和既有 skill 规则，不是新链路；未新增 skill/cache 结构。
- `temp/` 未修改，未迁移。

## 2026-05-05 修正任务 4800 的任务内容和任务标签英语多语言

- 用户反馈：任务 `4800` 的 `任务内容` 和 `任务标签` 没有配置英语。
- 原因确认：
  - 编辑弹窗内 `任务名称`、`任务内容`、`任务标签` 各自有独立的多语言开关。
  - 原脚本只填到了第一个可见英语输入框，实际只绑定了 `任务名称` 英语，`任务内容` 和 `任务标签` 的英语控件仍隐藏且为空。
- 已修正任务 `4800`：
  - `nameI18`: `en = Roulette scope all 20260505125346`
  - `contentI18`: `en = Automated roulette task content`
  - `labelI18`: `en = roulette_scope_all_en`
- 验证依据：
  - 修改提交返回 HTTP 200。
  - 按任务别名搜索接口返回任务 `4800`，`nameI18`、`contentI18`、`labelI18` 均包含 `lang: en`。
- 已修复缓存脚本：
  - `scripts/business/activity-task-management/roulette-participant-ui.mjs` 现在按表单项分别打开并填写 `任务名称`、`任务内容`、`任务标签` 的英语多语言。
  - 已补充 `references/components.md` 和 `operations/activity-task-roulette-participant-scopes.md`，说明活动任务多语言字段必须按表单项分别处理。
- `temp/` 未修改，未迁移。

## 2026-05-05 创建 VIP 才能参与的转盘抽奖任务

- 当前目标：按用户要求创建 1 条 `VIP 等级` 才能参与的 `转盘抽奖 / 单一奖励` 任务。
- 执行模式：默认不可见浏览器模式，复用动作缓存脚本 `scripts/create-roulette-participant-scope-tasks.mjs`。
- 执行环境：staging，最终页面 `https://stg-activity.weex.tech/activity/task`。
- 创建成功：
  - 任务编号 `4801`
  - 任务别名 `转盘抽奖_VIP参与_vip_20260505130715`
  - 参与范围 `VIP 等级`
  - VIP 起止等级 `VIP 0` 到 `VIP 0`
  - `VIP白名单允许` 为 `同等级允许`
- 验证依据：
  - `POST /prod-api/activity/task` 返回 HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 按任务别名搜索，`GET /prod-api/activity/task/list?name=转盘抽奖_VIP参与_vip_20260505130715` 返回 HTTP 200，列表出现任务编号 `4801`。
- 本次是复用既有缓存链路，不是新链路；未新增 skill/cache 结构。
- `temp/` 未修改，未迁移。
