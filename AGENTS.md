# AGENTS.md

## Language
- 默认使用中文回复。
- 回复要直接说明当前动作、缺少的信息、执行结果和下一步。
- 不回显密码、验证码、token、cookie、API key 等敏感信息。

## Project Context
- 本项目用于 WEEX 活动后台管理页面的操作自动化、测试验证和流程沉淀。
- 默认目标环境是 staging 后台：`https://stg-activity.weex.tech`。
- 后台业务复杂，所有操作必须以“可复现流程、明确前置条件、明确结果验证”为核心。

## Required Startup Reads
- 新会话开始处理本项目任务时，必须先读取：
  - `AGENTS.md`
  - `docs/session-handoff.md`
  - `skills/weex-admin-ops/FAILURES.md`
  - `skills/weex-admin-ops/SKILL.md`
  - 与当前任务相关的 `skills/weex-admin-ops/references/`
- 如果当前任务涉及已知失败高发场景，必须先读取 `skills/weex-admin-ops/FAILURES.md` 和对应 `skills/weex-admin-ops/failure-reviews/` 业务线复盘。
- 如果 `temp/` 存在暂存流程，新会话只需读取暂存索引摘要；只有当前任务与暂存流程相关，或用户明确要求继续、迁移暂存流程时，才汇总暂存内容并询问用户。
- 用户未确认前，不要自动把 `temp/` 内容迁入 skill。
- 首次对话中如果当前任务可能需要登录或后台页面操作，必须先检查环境变量是否设置：
  - `WEEX_ADMIN_USERNAME`
  - `WEEX_ADMIN_PASSWORD`
  - `WEEX_ADMIN_GOOGLE_CODE`
- `WEEX_ADMIN_USERNAME` 未设置时可使用 staging 默认用户名 `auto`，但必须说明正在使用默认用户名。
- `WEEX_ADMIN_PASSWORD` 和 `WEEX_ADMIN_GOOGLE_CODE` 必须设置；缺失时，在登录或后台操作前提示用户设置，不能继续猜测或把真实值写入文档。

## Skill Authority
- 后台相关操作优先使用项目内 `skills/weex-admin-ops/`，它是团队协作的权威版本。
- 本机 `$CODEX_HOME/skills/weex-admin-ops` 只是可选安装副本；如果缺失，先读取项目内 skill。
- 自然语言后台操作必须先查 `skills/weex-admin-ops/references/operations/index.md` 和 `skills/weex-admin-ops/scripts/action-cache.json`。
- 如果命中动作缓存，先用 `skills/weex-admin-ops/scripts/run-cached-action.mjs --dry-run` 检查，再决定是否执行。
- 缓存脚本失败、缺少参数或风险不明确时，回退到项目内 Playwright 浏览器自动化流程；只有需要复用用户 Chrome 登录态或 CDP 探索时，才使用可选的 `web-access`。
- 后管业务动作脚本、动作缓存脚本和 skill 维护脚本必须放在 `skills/weex-admin-ops/scripts/`；根目录 `scripts/` 不作为 skill 复用的必需目录。

## Safety
- 登录、创建、编辑、启用、停用、删除、导入、导出、批量更新、发奖、风控配置等会改变后台状态的操作，执行前必须说明即将执行的动作。
- 对不可轻易回滚或影响范围不明确的操作，必须先等待用户明确确认。
- 默认不在生产环境执行写操作，除非用户明确指定并确认。
- 不自动猜测高风险业务参数，例如活动时间、奖励金额、发放范围、用户范围、风控规则。
- 默认账号、密码、验证码、资产选择、低/高风险字段确认规则以 `skills/weex-admin-ops/references/defaults.md` 为准。

## Secrets
- 不把真实密码、验证码、token、cookie、API key 或完整账号凭证写入 `AGENTS.md`、skill、docs、temp 或任何会被提交的文件。
- staging 默认用户名可以记录为 `auto`；也可以从本机环境变量 `WEEX_ADMIN_USERNAME` 读取。
- 默认密码必须从本机环境变量 `WEEX_ADMIN_PASSWORD` 读取。
- 默认 Google 验证码必须从本机环境变量 `WEEX_ADMIN_GOOGLE_CODE` 读取。
- 可以用未提交的 `.env.local` 保存本机默认值；仓库只保留 `.env.example` 模板。
- 如果默认密码或验证码不可用，必须在执行登录前向用户询问。

## Browser And Evidence
- 页面操作优先使用真实浏览器自动化。
- 自动化操作默认不可见/后台运行；只有用户明确要求“可见操作”“打开浏览器操作”“让我看着操作”等表达时，才打开有界面的真实浏览器。
- 用户明确要求“浏览器模式”“可见操作”“打开浏览器操作”“让我看着操作”等表达时，所有会改变后台状态的写操作必须模拟用户真实页面行为：点击按钮、填写表单、选择下拉/单选/多选、上传文件、点击确认/提交；不得用纯接口调用代替页面写操作。接口调用只允许作为只读验证或页面行为触发后的证据采集。
- 默认不可见/后台模式不强制模拟用户点击；在已沉淀且风险明确的链路中，可以使用脚本化接口或页面上下文加速执行，但仍必须验证业务响应和结果回查。
- 同一业务链路在可见浏览器模式和默认不可见模式下可能存在不同执行路径；沉淀时必须记录已验证的模式，未验证的模式不得写成已跑通。
- 操作成功不能只看点击完成，必须验证至少一种结果：URL、页面关键文案、表格或表单状态、toast/message、关键接口响应或用户要求的截图证据。
- 默认不保存截图；只有用户明确要求“截图”“保存截图”“留证据图”等指令时才保存截图。
- 截图统一保存到 `skills/weex-admin-ops/artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- 最终回复必须说明最终 URL、操作结果、验证依据；如果用户要求截图，说明截图路径；如果更新了 skill 或动作缓存，也要说明。

## Missing Information
- 如果操作缺少必要参数，必须先列出缺失项。
- 如果 skill 中存在默认配置，可以建议默认值，但不能假装用户已经确认。
- 对低风险字段可以使用已确认的 skill 默认值。
- 对高风险字段必须让用户确认。

## Skill Update Discipline
- 当后台操作链路被实际跑通后，必须询问是否沉淀到项目内 `skills/weex-admin-ops/`；如果用户已提前授权自动沉淀，则直接更新。
- 新跑通链路沉淀时必须同时评估 skill 文档和动作缓存；当前 skill 未覆盖的新链路写入对应 reference，可复用且参数化成本合理的链路还必须沉淀成脚本并登记到 `skills/weex-admin-ops/scripts/action-cache.json`。
- 稳定、重复出现或多次跑通的链路，应优先沉淀成可复用脚本，并登记到 `skills/weex-admin-ops/scripts/action-cache.json`；如果暂不缓存，必须在交接记录和最终回复中说明原因。
- 第一次失败但重试后出现稳定路径时，必须把稳定路径补充到对应 skill，并同步更新 `docs/session-handoff.md`。
- skill 更新必须按业务域拆分，不把所有流程追加到单个大文件。
- `SKILL.md` 只保留核心工作流和 reference 导航；页面细节、默认配置、选择器、断言、关联关系、组件操作分别写入对应 references。
- 单个 markdown 文件接近 250 行时，必须先拆分再继续追加。
- 脚本分层、缓存、组件复用、浏览器模式和文件长度规则以 `skills/weex-admin-ops/SKILL.md`、`references/action-cache.md`、`references/components.md` 为准。

## Relationships And Reuse
- 每次沉淀流程时，必须检查是否产生新的业务关联关系或可复用组件操作。
- 新后台链路写脚本或浏览器自动化前，必须先检查 `skills/weex-admin-ops/references/components.md`、页面级 `references/components/` 和 `skills/weex-admin-ops/scripts/lib/` 是否已有可复用组件 helper。
- 下拉、单选、多选、开关、日期、上传、表格、弹窗、搜索表单、按钮点击、表单 label 定位等组件级行为，必须优先复用或扩展公共 helper；业务脚本只保留业务编排。
- 如果确实不能复用现有 helper，必须在交接记录或最终回复说明原因，并在跑通后评估是否抽到公共 helper。
- 业务关联关系写入 `skills/weex-admin-ops/references/relationships.md`，例如列表、配置项、下拉数据源、接口、奖品、任务、报名模板、活动类型和后端校验之间的依赖。
- 可复用组件操作写入 `skills/weex-admin-ops/references/components.md`，并优先抽离到 `skills/weex-admin-ops/scripts/lib/`。
- 业务脚本只描述业务编排；组件级点击、输入、上传、选择、等待和断言逻辑应放到通用 helper。

## Failure Review Discipline
- 每次后台操作、脚本执行、页面探测、缓存命中或验证过程中出现失败、阻塞、误判、重试成功、环境问题或后端校验问题，都必须主动更新失败复盘。
- 失败复盘入口为 skill 内 `skills/weex-admin-ops/FAILURES.md`；具体复盘按业务线写入 `skills/weex-admin-ops/failure-reviews/`，通用问题写入 `skills/weex-admin-ops/failure-reviews/common.md`。
- 执行新流程或重试失败流程前，必须先查看 `skills/weex-admin-ops/FAILURES.md` 和相关业务线复盘，确认是否已有解决方式。
- 复盘必须写明场景、失败表现、失败原因、解决方式、验证结果、关联流程或脚本、后续处理状态，不得写入真实密码、验证码、token、cookie、API key 或完整账号凭证。
- 多次遇到同类失败时，不能只追加复盘；必须评估并修改原流程、skill reference、组件 helper 或缓存脚本，把解决方式前置到正常流程中，并验证是否已经走通。
- 失败复盘也遵守增长管理：任意 `skills/weex-admin-ops/failure-reviews/**/*.md` 接近 250 行时，必须按业务线、场景或时间拆分，并更新 `skills/weex-admin-ops/FAILURES.md` 索引。

## Temp Workflow Staging
- `temp/` 只用于保存“已经跑通，但用户明确要求暂时不写入 skill、也不写交接文档”的后台操作流程。
- 普通交接内容不要自动写入 `temp/`。
- 新会话只需检查 `temp/README.md` 或暂存索引摘要；只有当前任务与暂存流程相关，或用户明确要求继续、迁移暂存流程时，才汇总暂存内容并询问用户。
- 暂存区结构和迁移规则以 `temp/README.md` 为准。

## Session Handoff
- 会话记录保存到 `docs/session-handoff.md`，用于让其他人克隆仓库后快速接力，不保存完整原始聊天记录。
- 每次完成关键操作、发现新页面链路、更新 skill、遇到阻塞或做出重要决策后，必须更新交接记录。
- 交接记录必须使用中文摘要，不得写入真实密码、验证码、token、cookie、API key、个人隐私数据或完整账号凭证。
- 如果某条链路已经沉淀到 `weex-admin-ops` skill，交接记录只保留摘要和 skill 文件路径，不重复粘贴完整流程。

## Docs Growth Management
- `docs/session-handoff.md` 只保留当前接力摘要、最近完成、阻塞、下一步和历史索引，不保存全量流水记录。
- 历史交接内容必须按业务域或时间归档到 `docs/session-handoffs/`，并在 `docs/session-handoffs/README.md` 维护索引。
- 任意 `docs/**/*.md` 接近 250 行时，必须先拆分或归档，再继续追加内容；`docs/session-handoff.md` 超过 250 行视为违规。
- 已沉淀到 skill 的完整流程不在 docs 中重复粘贴，只保留中文摘要和对应 skill/cache 文件路径。
- 更新 docs 或失败复盘后应运行 `node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs` 检查文档长度和索引。

## Change Discipline
- 修改 `AGENTS.md` 前，先说明将写入什么；用户说 `ok`、`确认` 或明确同意后再写入讨论中的规范正文。
- 只要有新跑通的、当前 skill 尚未覆盖的、且不是仅调整参数就能复用既有链路实现的新链路，必须在跑通后立即询问用户是否沉淀到项目内 `skills/weex-admin-ops/`，并同步说明是否适合登记动作缓存。
- 用户确认沉淀后，再更新 skill 和适用的动作缓存；未确认前不得写入 skill 或缓存。
- `temp/` 迁移仍需用户单独确认。
- 不改无关文件。
