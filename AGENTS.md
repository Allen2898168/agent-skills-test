# AGENTS.md

## Language
- 默认使用中文回复。
- 回复要直接说明当前动作、缺少的信息、执行结果和下一步。
- 输出只保留必要内容；任务执行过程中的动作类更新必须极简，不写无必要解释、背景或寒暄。
- 不回显密码、验证码、token、cookie、API key 等敏感信息。

## Project Context
- 本项目用于 WEEX 活动后台管理页面、WEEX FIN Admin 财务后台和 WEEX 前端页面的操作自动化、测试验证和流程沉淀。
- 活动后台默认目标环境是 staging：`https://stg-activity.weex.tech`。
- FIN Admin 财务后台 staging web host 是：`https://stg-admin-web-fin.weex.tech`。
- 后台业务复杂，所有操作必须以“可复现流程、明确前置条件、明确结果验证”为核心。
- 前端页面目标 URL 不默认猜测；优先查 `skills/weex-frontend-ops/references/routes.md`，没有命中时向用户询问目标 URL、环境、viewport 和预期结果。

## Required Startup Reads
- 新会话开始处理本项目任务时，必须先读取：
  - `AGENTS.md`
  - `docs/session-handoff.md`
  - 当前任务对应的项目内 skill：
    - 活动管理后台任务：`skills/weex-admin-ops/FAILURES.md`、`skills/weex-admin-ops/SKILL.md`、与当前任务相关的 `skills/weex-admin-ops/references/`
    - FIN Admin 财务后台任务：`skills/weex-fin-admin-ops/FAILURES.md`、`skills/weex-fin-admin-ops/SKILL.md`、`skills/weex-fin-admin-ops/references/operations/index.md`、与当前 FIN 任务相关的 `skills/weex-fin-admin-ops/references/`
    - 前端页面操作或检查任务：`skills/weex-frontend-ops/FAILURES.md`、`skills/weex-frontend-ops/SKILL.md`、`skills/weex-frontend-ops/references/operations/index.md`、与当前页面或检查相关的 `skills/weex-frontend-ops/references/`
- 如果当前活动管理后台任务涉及已知失败高发场景，必须先读取 `skills/weex-admin-ops/FAILURES.md` 和对应 `skills/weex-admin-ops/failure-reviews/` 业务线复盘。
- 如果当前 FIN Admin 任务涉及已知失败高发场景，必须先读取 `skills/weex-fin-admin-ops/FAILURES.md` 和对应 `skills/weex-fin-admin-ops/failure-reviews/` 业务线复盘。
- 如果当前前端任务涉及已知失败高发场景，必须先读取 `skills/weex-frontend-ops/FAILURES.md` 和对应 `skills/weex-frontend-ops/failure-reviews/` 页面或业务线复盘。
- 如果 `temp/` 存在暂存流程，新会话只需读取暂存索引摘要；只有当前任务与暂存流程相关，或用户明确要求继续、迁移暂存流程时，才汇总暂存内容并询问用户。
- 用户未确认前，不要自动把 `temp/` 内容迁入 skill。
- 每个 skill 的运行时配置和本机密钥只允许放在该 skill 目录内的 `.env.local`，当前进程环境变量也只能使用该 skill 自己的变量前缀；例如：
  - 活动管理后台：`skills/weex-admin-ops/.env.local`
  - FIN Admin：`skills/weex-fin-admin-ops/.env.local`
  - 前端：`skills/weex-frontend-ops/.env.local`
- 根目录 `.env.local` 和其他 skill 目录的 `.env.local` 不作为当前 skill 的配置来源；发现根目录或其他 skill 目录中保存了当前 skill 所需变量时，必须迁移到当前 skill 目录并删除错误位置的本机密钥文件。
- skill 之间不得交叉读取、fallback 或复用其他 skill 的环境变量；例如 FIN Admin 只能读取 `WEEX_FIN_*`，不能 fallback 到 `WEEX_ADMIN_*`，前端只能读取 `WEEX_FRONTEND_*`，不能 fallback 到历史 `P2P_*` 或通用 `WEEX_*`。
- 首次对话处理项目任务时，读取对应 skill 后必须先检查该 skill 的运行依赖是否准备完成，包括对应目录 `.env.local` 或当前进程内同前缀必需变量、必要的登录态、CDP profile、cookie/API auth 或其他已沉淀认证来源。
- 如果当前任务涉及多个 skill，必须分别检查各自依赖；不得用其他 skill、根目录或通用变量作为 fallback。
- 只要必需环境变量、配置文件、登录态或认证来源未准备完成，就不要回答或处理用户的业务提示词，不执行 dry-run、缓存动作、页面操作或写操作；必须先明确告诉用户缺少哪些配置、应放到哪个 skill 目录、需要完成哪种登录态准备。
- 只有所有必需配置和登录态检查通过后，才继续回答和处理用户原始任务。
- 首次对话中如果当前任务可能需要活动管理后台登录或页面操作，必须先检查 `skills/weex-admin-ops/.env.local` 或当前进程内是否设置：
  - `WEEX_ADMIN_USERNAME`
  - `WEEX_ADMIN_PASSWORD`
  - `WEEX_ADMIN_GOOGLE_CODE`
- `WEEX_ADMIN_USERNAME` 未设置时可使用 staging 默认用户名 `auto`，但必须说明正在使用默认用户名。
- `WEEX_ADMIN_PASSWORD` 和 `WEEX_ADMIN_GOOGLE_CODE` 必须设置；缺失时，在登录或后台操作前提示用户设置，不能继续猜测或把真实值写入文档。
- FIN Admin 当前优先复用用户已登录的 CDP Chrome 页面；用户登录并关闭 FIN tab 后，后续默认禁止自动打开任何 FIN tab/target，必须优先从持久 Chrome profile 的 Local Storage 文件读取认证并验证基础只读接口。如需审核，必须从 `skills/weex-fin-admin-ops/.env.local` 或当前进程内的 `WEEX_FIN_GOOGLE_CODE` 读取验证码。

## Skill Authority
- 活动管理后台相关操作优先使用项目内 `skills/weex-admin-ops/`，它是活动后台团队协作的权威版本。
- FIN Admin / 财务管理后台相关操作优先使用项目内 `skills/weex-fin-admin-ops/`，它是财务后台团队协作的权威版本。
- 前端页面打开、点击、表单操作、页面检查、响应式检查、截图证据、console/network 验证和前端流程沉淀，优先使用项目内 `skills/weex-frontend-ops/`，它是前端页面操作与检查的权威版本。
- 本机 `$CODEX_HOME/skills/weex-admin-ops` 只是可选安装副本；如果缺失，先读取项目内 skill。
- 本机 `$CODEX_HOME/skills/weex-fin-admin-ops` 只是可选安装副本；如果缺失，先读取项目内 skill。
- 本机 `$CODEX_HOME/skills/weex-frontend-ops` 只是可选安装副本；如果缺失，先读取项目内 skill。
- 自然语言活动管理后台操作必须先查 `skills/weex-admin-ops/references/operations/index.md` 和 `skills/weex-admin-ops/scripts/action-cache.json`。
- 自然语言 FIN Admin 操作必须先查 `skills/weex-fin-admin-ops/references/operations/index.md` 和 `skills/weex-fin-admin-ops/scripts/action-cache.json`。
- 自然语言前端操作或检查必须先查 `skills/weex-frontend-ops/references/operations/index.md` 和 `skills/weex-frontend-ops/scripts/action-cache.json`。
- 如果活动管理后台任务命中动作缓存，先用 `skills/weex-admin-ops/scripts/run-cached-action.mjs --dry-run` 检查，再决定是否执行。
- 使用 FIN Admin 平台能力前，必须先用 `skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs` 验证基础只读接口和当前持久 CDP 登录态是否可用；通过则不额外说明，继续执行后续无头/API 辅助流程。
- 如果 FIN 基础验证不通，必须打开持久 CDP Chrome 的 FIN 页面要求用户登录，并持续等待直到用户关闭 FIN 页面；不要因等待超时自行停止。用户关闭 FIN 页面视为本次人工登录/处理完成。页面关闭后重新验证；如果仍失败，先询问用户是否重新尝试，用户拒绝后再询问是否执行当前任务中与 FIN Admin 无关的其他操作。
- FIN 基础验证通过后，后续普通 FIN 读写不得为了读取 localStorage 再次打开 FIN tab 或 headless target；无现有 FIN tab 时应直接读取持久 Chrome profile 的 Local Storage 文件。只有基础验证失败并进入显式登录恢复流程时，才允许临时打开可见 FIN 页面；用户关闭该页面后必须回到无 tab/profile-auth 模式继续。
- 如果 FIN Admin 任务命中动作缓存，基础验证通过后再用 `skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --dry-run` 检查，再决定是否执行。
- 如果前端任务命中动作缓存，先用 `skills/weex-frontend-ops/scripts/run-cached-action.mjs --dry-run` 检查，再决定是否执行。
- 缓存脚本失败、缺少参数或风险不明确时，回退到项目内 Playwright 浏览器自动化流程；只有需要复用用户 Chrome 登录态或 CDP 探索时，才使用可选的 `web-access`。
- 活动管理后台业务动作脚本、动作缓存脚本和 skill 维护脚本必须放在 `skills/weex-admin-ops/scripts/`；根目录 `scripts/` 不作为 skill 复用的必需目录。
- FIN Admin 业务动作脚本、动作缓存脚本和 skill 维护脚本必须放在 `skills/weex-fin-admin-ops/scripts/`；根目录 `scripts/` 不作为 skill 复用的必需目录。
- 前端页面动作脚本、动作缓存脚本和 skill 维护脚本必须放在 `skills/weex-frontend-ops/scripts/`；根目录 `scripts/` 不作为 skill 复用的必需目录。
- 活动管理后台、FIN Admin 和前端页面的 skill、脚本、动作缓存、失败复盘和 references 必须分开维护；不要把 FIN Admin 财务链路写入 `weex-admin-ops`。
- 如果一次任务跨活动管理后台和 FIN Admin，必须先说明分别使用哪个 skill，并分别遵守对应的登录、确认、验证和沉淀规则。

## Safety
- 登录、创建、编辑、启用、停用、删除、导入、导出、批量更新、发奖、风控配置等会改变后台状态的操作，执行前必须说明即将执行的动作。
- 对不可轻易回滚或影响范围不明确的操作，必须先等待用户明确确认。
- 默认不在生产环境执行写操作，除非用户明确指定并确认。
- 如果用户已经明确要求“充值”“发放”“下发”等 FIN 充值/发放写操作，并且请求中包含或可从当前流程确定目标环境、账号/UID、金额、币种和审核方式，则视为已确认该充值/发放动作，不再要求用户二次确认；脚本级 `--confirm-create`、`--confirm-approve` 等安全开关仍必须由执行者根据该明确请求传入。
- 不自动猜测高风险业务参数，例如活动时间、奖励金额、发放范围、用户范围、风控规则。
- 活动管理后台默认账号、密码、验证码、资产选择、低/高风险字段确认规则以 `skills/weex-admin-ops/references/defaults.md` 为准。
- FIN Admin 环境、CDP 登录态和验证码来源以 `skills/weex-fin-admin-ops/references/environments.md` 为准。

## Secrets
- 不把真实密码、验证码、token、cookie、API key 或完整账号凭证写入 `AGENTS.md`、skill、docs、temp 或任何会被提交的文件。
- staging/test 等非生产环境下，测试账号邮箱和 UID 不按敏感信息脱敏；执行结果、脚本输出、交接摘要和复盘可以输出完整邮箱和完整 UID，便于复现和接力。生产环境或未明确为非生产时，邮箱和 UID 仍需脱敏或避免输出。
- 活动管理后台 staging 默认用户名可以记录为 `auto`；也可以从本机环境变量 `WEEX_ADMIN_USERNAME` 读取。
- 活动管理后台默认密码必须从 `skills/weex-admin-ops/.env.local` 或当前进程内的 `WEEX_ADMIN_PASSWORD` 读取。
- 活动管理后台默认 Google 验证码必须从 `skills/weex-admin-ops/.env.local` 或当前进程内的 `WEEX_ADMIN_GOOGLE_CODE` 读取。
- FIN Admin 审核 Google 验证码必须从 `skills/weex-fin-admin-ops/.env.local` 或当前进程内的 `WEEX_FIN_GOOGLE_CODE` 读取。
- 可以用各 skill 目录内未提交的 `.env.local` 保存本机默认值；仓库只保留各 skill 目录内的 `.env.example` 模板。
- 如果默认密码或验证码不可用，必须在执行登录前向用户询问。

## Browser And Evidence
- 页面操作优先使用真实浏览器自动化。
- 自动化操作默认不可见/后台运行；只有用户明确要求“可见操作”“打开浏览器操作”“让我看着操作”等表达时，才打开有界面的真实浏览器。
- 用户明确要求“浏览器模式”“可见操作”“打开浏览器操作”“让我看着操作”等表达时，所有会改变后台状态的写操作必须模拟用户真实页面行为：点击按钮、填写表单、选择下拉/单选/多选、上传文件、点击确认/提交；不得用纯接口调用代替页面写操作。接口调用只允许作为只读验证或页面行为触发后的证据采集。
- 前端登录和注册认证链路是浏览器模式真实点击规则的例外；除非用户明确要求测试登录/注册表单 UI，否则可以使用已沉淀的 cookie/API 路径完成认证或注册，并在浏览器中展示或验证最终登录后的页面。
- 默认不可见/后台模式不强制模拟用户点击；在已沉淀且风险明确的链路中，可以使用脚本化接口或页面上下文加速执行，但仍必须验证业务响应和结果回查。
- 同一业务链路在可见浏览器模式和默认不可见模式下可能存在不同执行路径；沉淀时必须记录已验证的模式，未验证的模式不得写成已跑通。
- 操作成功不能只看点击完成，必须验证至少一种结果：URL、页面关键文案、表格或表单状态、toast/message、关键接口响应或用户要求的截图证据。
- 默认不保存截图；只有用户明确要求“截图”“保存截图”“留证据图”等指令时才保存截图。
- 活动管理后台截图统一保存到 `skills/weex-admin-ops/artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- FIN Admin 截图统一保存到 `skills/weex-fin-admin-ops/artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- 前端截图统一保存到 `skills/weex-frontend-ops/artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- 最终回复必须说明最终 URL、操作结果、验证依据；前端任务还必须说明 viewport/device；如果用户要求截图，说明截图路径；如果更新了 skill 或动作缓存，也要说明。

## Missing Information
- 如果操作缺少必要参数，必须先列出缺失项。
- 如果 skill 中存在默认配置，可以建议默认值，但不能假装用户已经确认。
- 对低风险字段可以使用已确认的 skill 默认值。
- 对高风险字段必须让用户确认。
- FIN Admin 的 UID、金额、币种、订单状态、审核类型、Google 验证码和目标环境都属于高风险字段。

## Skill Update Discipline
- 当活动管理后台操作链路被实际跑通后，必须询问是否沉淀到项目内 `skills/weex-admin-ops/`；如果用户已提前授权自动沉淀，则直接更新。
- 当 FIN Admin 操作链路被实际跑通后，必须询问是否沉淀到项目内 `skills/weex-fin-admin-ops/`；如果用户已提前授权自动沉淀，则直接更新。
- 当前端页面操作或检查链路被实际跑通后，必须询问是否沉淀到项目内 `skills/weex-frontend-ops/`；如果用户已提前授权自动沉淀，则直接更新。
- 当 agent 未正确理解自然语言目标、缺少复合链路、遗漏前置步骤或只调用了单点 skill，用户指出正确解决方案并且后续验证成功时，视为用户已提前授权自动沉淀该复合链路；不得只在最终回复中口头总结，必须主动更新相关 playbook、动作缓存或匹配规则、失败复盘和 `docs/session-handoff.md`。
- 复合链路沉淀必须写清目标态、触发话术、参与 skill、标准执行顺序、前置条件、确认开关、验证依据和失败回退；如果横跨多个 skill，优先在主导高风险写操作的 skill 中登记组合 action，并在其他相关 skill 中补充“不要单独执行”的限制说明。
- 用户给出的解决方案如果只是一次性参数修正，不产生可复用链路，可以只更新交接和失败复盘；如果解决方案能泛化为“以后遇到类似 prompt 应组合多个 skill”，必须沉淀为复合 playbook 或缓存匹配规则。
- 活动管理后台新跑通链路沉淀时必须同时评估 skill 文档和动作缓存；当前 `weex-admin-ops` 未覆盖的新链路写入对应 reference，可复用且参数化成本合理的链路还必须沉淀成脚本并登记到 `skills/weex-admin-ops/scripts/action-cache.json`。
- FIN Admin 新跑通链路沉淀时必须同时评估 skill 文档和动作缓存；当前 `weex-fin-admin-ops` 未覆盖的新链路写入对应 reference，可复用且参数化成本合理的链路还必须沉淀成脚本并登记到 `skills/weex-fin-admin-ops/scripts/action-cache.json`。
- 前端新跑通链路沉淀时必须同时评估 skill 文档和动作缓存；当前 `weex-frontend-ops` 未覆盖的新链路写入对应 reference，可复用且参数化成本合理的链路还必须沉淀成脚本并登记到 `skills/weex-frontend-ops/scripts/action-cache.json`。
- 活动管理后台稳定、重复出现或多次跑通的链路，应优先沉淀成可复用脚本，并登记到 `skills/weex-admin-ops/scripts/action-cache.json`；如果暂不缓存，必须在交接记录和最终回复中说明原因。
- FIN Admin 稳定、重复出现或多次跑通的链路，应优先沉淀成可复用脚本，并登记到 `skills/weex-fin-admin-ops/scripts/action-cache.json`；如果暂不缓存，必须在交接记录和最终回复中说明原因。
- 前端稳定、重复出现或多次跑通的链路，应优先沉淀成可复用脚本，并登记到 `skills/weex-frontend-ops/scripts/action-cache.json`；如果暂不缓存，必须在交接记录和最终回复中说明原因。
- 第一次失败但重试后出现稳定路径时，必须把稳定路径补充到对应 skill，并同步更新 `docs/session-handoff.md`。
- skill 更新必须按业务域拆分，不把所有流程追加到单个大文件。
- `SKILL.md` 只保留核心工作流和 reference 导航；页面细节、默认配置、选择器、断言、关联关系、组件操作分别写入对应 references。
- 单个 markdown 文件接近 250 行时，必须先拆分再继续追加。
- 脚本分层、缓存、组件复用、浏览器模式和文件长度规则以 `skills/weex-admin-ops/SKILL.md`、`references/action-cache.md`、`references/components.md` 为准。
- FIN Admin 脚本分层、缓存、浏览器模式、CDP/API 链路和文件长度规则以 `skills/weex-fin-admin-ops/SKILL.md`、`references/action-cache.md` 为准。
- 前端脚本分层、缓存、组件复用、浏览器模式和文件长度规则以 `skills/weex-frontend-ops/SKILL.md`、`references/action-cache.md`、`references/components.md` 为准。

## Relationships And Reuse
- 每次沉淀流程时，必须检查是否产生新的业务关联关系或可复用组件操作。
- 新后台链路写脚本或浏览器自动化前，必须先检查 `skills/weex-admin-ops/references/components.md`、页面级 `references/components/` 和 `skills/weex-admin-ops/scripts/lib/` 是否已有可复用组件 helper。
- 下拉、单选、多选、开关、日期、上传、表格、弹窗、搜索表单、按钮点击、表单 label 定位等组件级行为，必须优先复用或扩展公共 helper；业务脚本只保留业务编排。
- 如果确实不能复用现有 helper，必须在交接记录或最终回复说明原因，并在跑通后评估是否抽到公共 helper。
- 业务关联关系写入 `skills/weex-admin-ops/references/relationships.md`，例如列表、配置项、下拉数据源、接口、奖品、任务、报名模板、活动类型和后端校验之间的依赖。
- 前端关联关系写入 `skills/weex-frontend-ops/references/relationships.md`，例如前端路由、接口数据、活动配置、feature flag、语言、地区、登录态和页面展示之间的依赖。
- 可复用组件操作写入 `skills/weex-admin-ops/references/components.md`，并优先抽离到 `skills/weex-admin-ops/scripts/lib/`。
- 前端可复用组件操作写入 `skills/weex-frontend-ops/references/components.md`，并优先抽离到 `skills/weex-frontend-ops/scripts/lib/`。
- 业务脚本只描述业务编排；组件级点击、输入、上传、选择、等待和断言逻辑应放到通用 helper。

## Failure Review Discipline
- 每次后台操作、脚本执行、页面探测、缓存命中或验证过程中出现失败、阻塞、误判、重试成功、环境问题或后端校验问题，都必须主动更新失败复盘。
- 每次 FIN Admin 页面探测、脚本执行、缓存命中、创建、审核或验证过程中出现失败、阻塞、误判、重试成功、环境问题或后端校验问题，都必须主动更新 FIN Admin 失败复盘。
- 每次前端页面操作、脚本执行、页面探测、缓存命中、截图检查、console/network 验证或断言过程中出现失败、阻塞、误判、重试成功、环境问题或渲染问题，都必须主动更新失败复盘。
- 失败复盘入口为 skill 内 `skills/weex-admin-ops/FAILURES.md`；具体复盘按业务线写入 `skills/weex-admin-ops/failure-reviews/`，通用问题写入 `skills/weex-admin-ops/failure-reviews/common.md`。
- FIN Admin 失败复盘入口为 skill 内 `skills/weex-fin-admin-ops/FAILURES.md`；具体复盘按业务线写入 `skills/weex-fin-admin-ops/failure-reviews/`，通用问题写入 `skills/weex-fin-admin-ops/failure-reviews/common.md`。
- 前端失败复盘入口为 skill 内 `skills/weex-frontend-ops/FAILURES.md`；具体复盘按页面或业务线写入 `skills/weex-frontend-ops/failure-reviews/`，通用问题写入 `skills/weex-frontend-ops/failure-reviews/common.md`。
- 执行新流程或重试失败流程前，必须先查看 `skills/weex-admin-ops/FAILURES.md` 和相关业务线复盘，确认是否已有解决方式。
- 执行新的 FIN Admin 流程或重试失败 FIN Admin 流程前，必须先查看 `skills/weex-fin-admin-ops/FAILURES.md` 和相关业务线复盘，确认是否已有解决方式。
- 执行新的前端流程或重试失败前端流程前，必须先查看 `skills/weex-frontend-ops/FAILURES.md` 和相关页面或业务线复盘，确认是否已有解决方式。
- 复盘必须写明场景、失败表现、失败原因、解决方式、验证结果、关联流程或脚本、后续处理状态，不得写入真实密码、验证码、token、cookie、API key 或完整账号凭证；staging/test 测试账号邮箱和 UID 可以完整记录。
- 多次遇到同类失败时，不能只追加复盘；必须评估并修改原流程、skill reference、组件 helper 或缓存脚本，把解决方式前置到正常流程中，并验证是否已经走通。
- 如果同一问题第二次出现，且本次成功应用复盘文档中的解决方式解决问题，必须把该解决方式替换为对应流程、脚本、helper 或动作缓存的固定执行路径；固定路径验证通过后，删除失败复盘中该问题对应条目，避免保留已被流程吸收的旧问题。
- 如果问题不是环境失败，而是 prompt 理解、目标态拆解或跨 skill 编排遗漏，复盘必须明确写出错误理解、用户纠正后的目标态、正确组合链路以及已经更新的 playbook/cache 文件；成功沉淀后，应把复盘条目标记为已吸收到固定流程，后续不再按失败路径处理。
- 如果暂时不能替换固定执行路径或不能删除对应复盘条目，必须在交接记录和该复盘条目的后续处理状态中说明原因、风险和下一步。
- 失败复盘也遵守增长管理：任意 `skills/weex-admin-ops/failure-reviews/**/*.md`、`skills/weex-fin-admin-ops/failure-reviews/**/*.md` 或 `skills/weex-frontend-ops/failure-reviews/**/*.md` 接近 250 行时，必须按业务线、页面、场景或时间拆分，并更新对应 `FAILURES.md` 索引。

## Temp Workflow Staging
- `temp/` 只用于保存“已经跑通，但用户明确要求暂时不写入 skill、也不写交接文档”的后台操作流程。
- 普通交接内容不要自动写入 `temp/`。
- 新会话只需检查 `temp/README.md` 或暂存索引摘要；只有当前任务与暂存流程相关，或用户明确要求继续、迁移暂存流程时，才汇总暂存内容并询问用户。
- 暂存区结构和迁移规则以 `temp/README.md` 为准。

## Session Handoff
- 会话记录保存到 `docs/session-handoff.md`，用于让其他人克隆仓库后快速接力，不保存完整原始聊天记录。
- 每次完成关键操作、发现新页面链路、更新 skill、遇到阻塞或做出重要决策后，必须更新交接记录。
- 交接记录必须使用中文摘要，不得写入真实密码、验证码、token、cookie、API key、个人隐私数据或完整账号凭证；staging/test 测试账号邮箱和 UID 可以完整记录。
- 如果某条链路已经沉淀到 `weex-admin-ops` skill，交接记录只保留摘要和 skill 文件路径，不重复粘贴完整流程。
- 如果某条链路已经沉淀到 `weex-fin-admin-ops` skill，交接记录只保留摘要和 skill 文件路径，不重复粘贴完整流程。
- 如果某条链路已经沉淀到 `weex-frontend-ops` skill，交接记录只保留摘要和 skill 文件路径，不重复粘贴完整流程。

## Docs Growth Management
- `docs/session-handoff.md` 只保留当前接力摘要、最近完成、阻塞、下一步和历史索引，不保存全量流水记录。
- 历史交接内容必须按业务域或时间归档到 `docs/session-handoffs/`，并在 `docs/session-handoffs/README.md` 维护索引。
- 任意 `docs/**/*.md` 接近 250 行时，必须先拆分或归档，再继续追加内容；`docs/session-handoff.md` 超过 250 行视为违规。
- 已沉淀到 skill 的完整流程不在 docs 中重复粘贴，只保留中文摘要和对应 skill/cache 文件路径。
- 更新 docs 或后管失败复盘后应运行 `node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs` 检查文档长度和索引。
- 更新 FIN Admin skill、FIN Admin 失败复盘或 FIN Admin 流程文档后应运行 `node skills/weex-fin-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs` 检查文档长度和索引。
- 更新前端 skill、前端失败复盘或前端流程文档后应运行 `node skills/weex-frontend-ops/scripts/maintenance/validate-knowledge-structure.mjs` 检查文档长度和索引。

## Change Discipline
- 如果认为 `AGENTS.md` 需要更新，必须先提示用户，并说明建议更新的具体内容和原因；等待用户说 `ok`、`确认` 或明确同意后再写入规范正文。
- 每次更新 `AGENTS.md` 后，必须整体检查 `AGENTS.md` 的规范是否存在过期、冲突、重复或歧义；如果发现需要修正，必须在同轮完成修正并重新检查。
- 活动管理后台新跑通链路如果当前 `weex-admin-ops` 尚未覆盖，且不是仅调整参数就能复用既有链路实现，必须在跑通后立即询问用户是否沉淀到项目内 `skills/weex-admin-ops/`，并同步说明是否适合登记动作缓存。
- FIN Admin 新跑通链路如果当前 `weex-fin-admin-ops` 尚未覆盖，且不是仅调整参数就能复用既有链路实现，必须在跑通后立即询问用户是否沉淀到项目内 `skills/weex-fin-admin-ops/`，并同步说明是否适合登记动作缓存。
- 前端新跑通链路如果当前 `weex-frontend-ops` 尚未覆盖，且不是仅调整参数就能复用既有链路实现，必须在跑通后立即询问用户是否沉淀到项目内 `skills/weex-frontend-ops/`，并同步说明是否适合登记动作缓存。
- 用户确认沉淀后，再更新 skill 和适用的动作缓存；未确认前不得写入 skill 或缓存。
- `temp/` 迁移仍需用户单独确认。
- 不改无关文件。
