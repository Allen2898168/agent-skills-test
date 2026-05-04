# AGENTS.md

## Language
- 默认使用中文回复。
- 回复要直接说明当前动作、缺少的信息、执行结果和下一步。
- 不回显密码、验证码、token、cookie、API key 等敏感信息。

## Project Context
- 本项目用于 WEEX 活动后台管理页面的操作自动化、测试验证和流程沉淀。
- 默认目标环境是 staging 后台：`https://stg-activity.weex.tech`
- 后台业务逻辑复杂，所有操作必须以“可复现流程、明确前置条件、明确结果验证”为核心。

## Skill Usage
- 后台相关操作优先使用项目内 `skills/weex-admin-ops/` skill。
- 如果本机未安装该 skill，先读取项目内 `skills/weex-admin-ops/SKILL.md` 和相关 references；需要自动发现时，再复制或安装到 `$CODEX_HOME/skills/weex-admin-ops`。
- 后台操作如果命中项目内动作缓存，必须优先使用缓存脚本：
  - 缓存目录：`skills/weex-admin-ops/scripts/action-cache.json`
  - 缓存入口：`skills/weex-admin-ops/scripts/run-cached-action.mjs`
  - 先用 `--dry-run` 检查自然语言请求是否命中正确脚本。
  - 缓存脚本失败或缺少参数时，再回退到常规 `web-access` / 浏览器自动化流程。
- 当用户用自然语言提出后台操作，例如“创建一个新手活动，用默认配置”，agent 必须：
  - 识别操作意图。
  - 先检查是否有可用缓存脚本。
  - 查找 skill 中已有路径、流程、默认配置和已知限制。
  - 判断还缺哪些必填信息。
  - 先向测试人员确认或补全必要参数。
  - 再执行实际页面操作。

## Operation Safety
- 登录、创建、编辑、启用、停用、删除、导入、导出、批量更新、发奖、风控配置等会改变后台状态的操作，执行前必须说明即将执行的动作。
- 对不可轻易回滚或影响范围不明确的操作，必须先等待用户明确确认。
- 默认不在生产环境执行写操作，除非用户明确指定并确认。
- 不自动猜测高风险业务参数，例如活动时间、奖励金额、发放范围、用户范围、风控规则。

## Default Login Profile
- 如果用户没有重新指定后台账号，staging 环境默认使用账号名 `auto`。
- 不把真实密码、验证码、token、cookie 或 API key 写入 `AGENTS.md`、skill 或任何会被提交的文件。
- 默认密码从本机环境变量 `WEEX_ADMIN_PASSWORD` 读取。
- 默认 Google 验证码从本机环境变量 `WEEX_ADMIN_GOOGLE_CODE` 读取。
- 可以用未提交的 `.env.local` 保存本机默认值；仓库只保留 `.env.example` 模板。
- 如果默认密码或验证码不可用，必须在执行登录前向用户询问。

## Missing Information
- 如果操作缺少必要参数，必须先列出缺失项。
- 如果 skill 中存在默认配置，可以优先建议默认值，但不能假装用户已经确认。
- 对低风险字段可以使用 skill 默认值。
- 对高风险字段必须让用户确认。

## Browser Operation Rules
- 页面操作优先使用真实浏览器自动化。
- 自动化操作默认以不可见模式运行，减少对用户桌面和当前浏览器的干扰。
- 如果用户明确要求“可见操作”“打开浏览器操作”“让我看着操作”“真实浏览器可见执行”或类似表达，必须打开有界面的真实浏览器执行，让用户可以看到页面操作过程。
- 用户没有明确要求可见时，不要主动打开可见浏览器；但仍必须使用真实浏览器能力完成登录态页面操作和结果验证。
- 每次执行前确认当前环境、目标页面和目标操作。
- 操作成功不能只看点击是否完成，必须验证至少一种结果：
  - 当前 URL。
  - 页面关键文案。
  - 表格或表单状态。
  - toast/message。
  - 关键接口响应。
  - 用户明确要求时保存的截图证据。

## Evidence
- 默认不保存截图；只有用户明确要求“截图”“保存截图”“留证据图”或类似指令时才保存截图。
- 用户要求截图时，统一保存到 `artifacts/screenshots/` 下，并按中文业务域继续分目录。
- 截图目录示例：
  - `artifacts/screenshots/活动通用模块管理/奖品管理/`
  - `artifacts/screenshots/假钱账户/`
  - `artifacts/screenshots/活动管理/新手活动/`
- 截图文件名应包含链路或页面名称，例如：
  - `weex-login-success.png`
  - `newbie-activity-created.png`
- 最终回复必须说明：
  - 最终 URL。
  - 操作结果。
  - 验证依据。
  - 如果用户要求截图，说明截图路径。
  - 是否已沉淀到 skill。

## Asset Selection
- 默认奖品图片目录为 `assets/default-prize-images/`。
- 使用奖品图片前必须先查看该目录中的图片文件。
- 如果目录中只有一张图片，可以默认使用该图片。
- 如果目录中有多张图片，必须询问用户选择哪张，或询问是否允许随机取用。
- 如果目录中没有图片，必须询问用户提供图片，或明确确认后才创建占位默认图片。
- 不要在每次创建奖品时自动生成新的默认图片。

## Skill Update Loop
- 当某条后台操作链路被实际跑通后，必须询问是否沉淀到项目内 `skills/weex-admin-ops/` skill；如果用户已提前授权自动沉淀，则直接更新。
- 当某条链路稳定、重复出现或已经多次跑通，应优先沉淀成可复用脚本，并登记到 `skills/weex-admin-ops/scripts/action-cache.json`。
- 项目内 `skills/weex-admin-ops/` 是团队协作的权威版本；本机 `$CODEX_HOME/skills/weex-admin-ops` 只是可选安装副本。
- 不把真实密码、验证码、token、cookie 写入 skill。
- skill 中只记录占位符，例如：
  - `<USERNAME>`
  - `<PASSWORD>`
  - `<GOOGLE_CODE>`
  - `<ACTIVITY_NAME>`
  - `<START_TIME>`
  - `<END_TIME>`
- 每次沉淀内容应包含：
  - 操作名称。
  - 适用环境。
  - 入口 URL。
  - 前置条件。
  - 必填参数。
  - 可使用的默认配置。
  - 操作步骤。
  - 稳定选择器或定位方式。
  - 成功断言。
  - 如果该链路需要按需截图，记录截图命名建议。
  - 常见失败原因。
  - 最近验证日期。
  - 状态：`candidate` 或 `verified`。
- 如果沉淀成缓存脚本，还应包含：
  - 脚本路径。
  - 支持的自然语言意图关键词。
  - 必填参数和默认参数。
  - `--dry-run` 行为。
  - 失败后的回退方式。
  - 脚本分层位置和可复用模块。
- 首次跑通的链路标记为 `candidate`。
- 重复验证通过或用户明确确认后，标记为 `verified`。

## Temp Workflow Staging
- `temp/` 是本项目的本地流程暂存区，用于保存“已经跑通，但用户明确要求暂时不写入 skill、也不写交接文档”的后台操作流程。
- 只有用户明确提出某条流程本次不写入 skill 和交接文档时，才把跑通结果写入 `temp/`；不要把普通交接内容自动写入 `temp/`。
- `temp/` 必须按业务域分级，例如：
  - `temp/weex-admin-ops/activity-management/lottery/`
  - `temp/weex-admin-ops/prize-management/`
  - `temp/weex-admin-ops/activity-task-management/`
- 暂存内容必须包含：
  - 操作名称。
  - 适用环境。
  - 入口 URL。
  - 前置条件。
  - 已验证配置项。
  - 操作步骤。
  - 成功断言。
  - 失败重试记录和业务限制。
  - 最近验证日期。
  - 是否已经纳入 skill。
- 暂存内容不得写入真实密码、验证码、token、cookie、API key、个人隐私数据或完整账号凭证。
- 如果用户提出相似后台操作，而 `skills/weex-admin-ops/` 中没有对应流程，必须先检查 `temp/` 是否已有暂存流程；如果有，应参考暂存流程执行，并说明它尚未正式沉淀到 skill。
- 新会话开始时，agent 必须在读取 `AGENTS.md`、`docs/session-handoff.md` 和相关 skill references 后，检查 `temp/` 是否存在暂存流程：
  - 如果存在，先向用户汇总暂存区内容。
  - 询问用户是从暂存区流程继续，还是将暂存区内容落到 skill。
  - 用户未确认前，不要自动把暂存区内容迁入 skill。
- 当用户要求将暂存区某条流程落到 skill 时：
  - 按 `Skill Growth Management` 拆分到 operations、selectors、assertions、defaults 或 scripts。
  - 更新必要索引和交接记录。
  - 验证迁移后没有遗漏关键步骤和断言。
  - 清除 `temp/` 中已经被纳入 skill 的对应内容，或明确标记为已迁移。
- `temp/README.md` 只记录暂存区使用规则和索引，不保存大量页面细节。

## Skill Growth Management
- 更新 `skills/weex-admin-ops/` 时必须按业务域分类拆分，不把所有流程追加到单个大文件。
- `SKILL.md` 只保留核心工作流、规则和 reference 导航，不写大量页面细节。
- 详细操作流程写入 `skills/weex-admin-ops/references/operations/` 下的业务分类文件。
- `skills/weex-admin-ops/references/operations/index.md` 只维护目录、状态、最近验证日期和入口链接。
- 页面字段、按钮、表格定位写入 `skills/weex-admin-ops/references/selectors/` 下的页面或业务域文件。
- 成功断言写入 `skills/weex-admin-ops/references/assertions/` 下的页面或业务域文件。
- 默认配置写入 `skills/weex-admin-ops/references/defaults.md`；如果某个业务域默认值很多，再拆成业务专用 defaults 文件。
- 单个 markdown 文件接近 250 行时，必须先拆分再继续追加。
- 新增内容必须避免重复已有 routes、selectors、assertions、defaults；优先引用已有文件。

## Script Growth Management
- 缓存脚本和自动化脚本也必须按业务域和职责拆分，不能把所有逻辑堆到单个脚本文件。
- `scripts/` 下推荐目录：
  - `scripts/lib/`：浏览器、CLI、运行时、Element UI 等通用函数。
  - `scripts/cache/`：动作缓存匹配、命令构造、缓存调度。
  - `scripts/business/<业务域>/`：具体业务页面和业务流程，例如 `prize-management/`。
  - `scripts/*.mjs`：只保留薄入口，负责参数解析、调用业务模块、输出结果。
- 单个脚本文件原则上控制在 180 行以内；接近 200 行必须优先拆分。
- 通用函数必须复用，不要在不同业务脚本里复制登录、下拉选择、表单填写、上传图片、表格断言等逻辑。
- 业务逻辑必须和浏览器基础设施解耦：业务模块描述“做什么”，通用模块处理“怎么点、怎么填、怎么等响应”。
- 新增缓存脚本时必须同时登记 `scripts/action-cache.json`，并提供 `--dry-run` 或等效预演能力。

## Session Handoff
- 项目中的会话记录用于让其他人克隆仓库后快速接力，不保存完整原始聊天记录。
- 会话记录保存到 `docs/session-handoff.md`。
- 每次完成关键操作、发现新页面链路、更新 skill、遇到阻塞或做出重要决策后，必须更新交接记录。
- 交接记录必须使用中文摘要形式，包含：
  - 日期时间。
  - 当前目标。
  - 已完成事项。
  - 已验证链路。
  - 用户明确要求生成的截图路径，或其他证据摘要。
  - 已更新的 skill 文件。
  - 当前阻塞点。
  - 下一步建议。
- 不得写入真实密码、验证码、token、cookie、API key、个人隐私数据或完整账号凭证。
- 敏感信息必须使用占位符，例如 `<USERNAME>`、`<PASSWORD>`、`<GOOGLE_CODE>`。
- 如果某次操作改变了后台状态，必须记录：
  - 操作类型。
  - 目标环境。
  - 目标页面。
  - 关键参数。
  - 验证依据。
  - 是否可回滚。
- 如果某条链路已经沉淀到 `weex-admin-ops` skill，交接记录只保留摘要和 skill 文件路径，不重复粘贴完整流程。
- 新会话开始时，agent 必须先读取：
  - `AGENTS.md`。
  - `docs/session-handoff.md`。
  - 相关 skill references。

## Change Discipline
- 修改 `AGENTS.md` 或 skill 文件前，先说明将写入什么。
- 用户说 `ok` 后再写入讨论中的规范正文。
- 不改无关文件。
