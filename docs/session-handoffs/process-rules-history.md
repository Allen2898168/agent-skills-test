# 流程规则演进归档

## 2026-05-05 任务需求确认与稳定重试路径沉淀规则

- 当前目标：补充 `weex-admin-ops` 的需求确认、默认值确认和稳定重试路径沉淀规则。
- 已完成事项：
  - 已更新 `AGENTS.md`，要求后续用户提出创建类需求时，agent 必须先基于当前已验证链路整理必填项、可配置项、可建议默认值和已知限制，再等待用户确认。
  - 已更新 `AGENTS.md`，要求任何“第一次链路失败、重试后出现稳定路径”的情况，一旦验证稳定，就必须补充到对应 skill 并同步更新交接文档。
  - 已更新 `skills/weex-admin-ops/SKILL.md`，要求创建、编辑、删除前先汇总当前链路的配置项、默认项和限制，并在参数不合理时先提示用户。
  - 已更新 `skills/weex-admin-ops/references/defaults.md`，明确“默认配置”只是候选值，不等于用户确认；用户说“用默认配置”时，也必须先展示可配置项和默认值再执行。
  - 已更新 `skills/weex-admin-ops/references/operations/activity-task-management.md`；后续拆分后，`转盘抽奖` 创建流程的需求确认清单与合理性检查主要位于 `skills/weex-admin-ops/references/operations/activity-task-roulette-reward-modes.md` 和 `skills/weex-admin-ops/references/operations/activity-task-roulette-conditions.md`。
  - 已补充 `转盘抽奖 / 单一奖励` 当前建议默认值：用户未指定时，默认建议 `输入最小数值=10`，`输入最大数值` 默认留空，但执行前仍需用户确认。
- 影响范围：
  - 后续处理后台创建类需求时，不能直接把默认值写入页面后执行。
  - 如果用户给出的配置与页面限制、后端规则或已验证链路冲突，必须先解释冲突点，不得硬做。
  - 重试后验证稳定的新路径，不再只停留在会话经验，必须正式写入 skill 和本交接文档。
- 已更新 skill 文件：
  - `AGENTS.md`
  - `skills/weex-admin-ops/SKILL.md`
  - `skills/weex-admin-ops/references/defaults.md`
  - `skills/weex-admin-ops/references/operations/activity-task-management.md`
- 当前阻塞点：无。
- 下一步建议：后续如再出现“首轮失败、二次成功”的页面链路，应按本规则立即补充到具体业务域文档，不要只在口头说明中保留。

## 2026-05-05 skill 合规检查与 operation 文档拆分

- 当前目标：按 `AGENTS.md` 重新检查 `skills/weex-admin-ops/` 是否符合项目规范，并修复已发现的文件长度问题。
- 已完成事项：
  - 已读取 `AGENTS.md`、本交接文档和项目内 `skills/weex-admin-ops/` 相关 references。
  - 已检查暂存区，当前存在 `temp/weex-admin-ops/activity-management/lottery/2026-05-04-lottery-create-flow.md`，内容为“转盘抽奖活动新增草稿流程”，状态 `candidate`，尚未纳入 skill。本次只做汇总和保留，没有自动迁移到 skill。
  - 已将超长 operation 文档按业务链路拆分，避免继续违反单个 markdown 文件接近 250 行时必须拆分的规则。
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/operations/activity-common-module.md`
  - `skills/weex-admin-ops/references/operations/prize-management-search.md`
  - `skills/weex-admin-ops/references/operations/prize-management-basic-create.md`
  - `skills/weex-admin-ops/references/operations/activity-task-management.md`
  - `skills/weex-admin-ops/references/operations/activity-task-search.md`
  - `skills/weex-admin-ops/references/operations/activity-task-roulette-reward-modes.md`
  - `skills/weex-admin-ops/references/operations/activity-task-roulette-conditions.md`
  - `skills/weex-admin-ops/references/operations/index.md`
- 拆分结果：
  - `activity-common-module.md` 只保留“活动通用模块管理 / 奖品管理”入口导航。
  - `prize-management-search.md` 保存奖品管理搜索流程。
  - `prize-management-basic-create.md` 保存赠金、币种、实物基础新增流程。
  - `activity-task-management.md` 只保留“活动任务管理”入口导航。
  - `activity-task-search.md` 保存活动任务搜索流程。
  - `activity-task-roulette-reward-modes.md` 保存转盘抽奖奖励模式新增链路。
  - `activity-task-roulette-conditions.md` 保存转盘抽奖任务条件发现和单一奖励按条件创建链路。
- 验证依据：
  - 拆分后 operation markdown 最大文件为 `prize-management-basic-create.md`，231 行，低于 250 行拆分阈值。
  - `git diff --check` 通过。
  - `quick_validate.py` 通过：由于当前 Python 环境缺少 `PyYAML` 模块，本次用已安装的 `ruamel.yaml` 兼容注入后执行原校验脚本，输出 `Skill is valid!`。
- 当前阻塞点：
  - 无。
- 下一步建议：
  - 如果要继续处理 `temp/` 中的转盘抽奖活动新增草稿流程，应先由用户确认是继续暂存，还是正式迁移到 `skills/weex-admin-ops/`。

## 2026-05-05 关联关系与组件复用沉淀规则

- 当前目标：补充后管自动化 skill 构建过程中的“业务关联关系标记”和“组件操作复用抽离”规范。
- 已完成事项：
  - 已在 `AGENTS.md` 新增 `Relationship And Reuse Management`，要求每次沉淀流程时识别列表、配置项、下拉数据源、接口、缓存脚本之间的关联关系。
  - 已要求有关联性的业务对象记录到 `skills/weex-admin-ops/references/relationships.md`，可复用组件操作记录到 `skills/weex-admin-ops/references/components.md`。
  - 已在 `skills/weex-admin-ops/SKILL.md` 增加 reference 导航和更新 skill 时的检查项。
  - 已新增 `relationships.md`，记录奖品记录与任务奖励下拉、奖品分类与子类型、活动类型与任务配置、活动配置类型与报名模板兼容性的已知关联。
  - 已新增 `components.md`，记录 Element UI 单选下拉、多选下拉、多语言字段、图片上传、表格横向滚动和确认弹窗等可复用组件操作。
- 已更新文件：
  - `AGENTS.md`
  - `skills/weex-admin-ops/SKILL.md`
  - `skills/weex-admin-ops/references/relationships.md`
  - `skills/weex-admin-ops/references/components.md`
- 当前阻塞点：无。
- 下一步建议：
  - 后续每次跑通新流程时，除更新 operation 外，同步检查是否需要补充 `relationships.md` 或 `components.md`；如果组件操作已可脚本化，应优先抽到 `scripts/lib/`。

## 2026-05-05 AGENTS.md 精简为项目级规范

- 当前目标：修正 `AGENTS.md` 过长、混入 skill 细节、与 `weex-admin-ops` references 重复的问题。
- 已完成事项：
  - 已将 `AGENTS.md` 从 235 行精简到 87 行。
  - `AGENTS.md` 现在只保留项目级硬规则：语言、项目背景、启动读取、安全、敏感信息、浏览器与证据、缺失信息、skill 更新纪律、关联与复用、暂存区、交接记录和变更纪律。
  - 具体执行细节下沉到 `skills/weex-admin-ops/SKILL.md` 和 references：
    - 默认值、账号、资产选择、风险字段：`skills/weex-admin-ops/references/defaults.md`
    - 缓存脚本策略：`skills/weex-admin-ops/references/action-cache.md`
    - 组件复用：`skills/weex-admin-ops/references/components.md`
    - 业务关联关系：`skills/weex-admin-ops/references/relationships.md`
    - 暂存区细则：`temp/README.md`
- 已更新文件：
  - `AGENTS.md`
  - `docs/session-handoff.md`
- 当前阻塞点：无。
- 下一步建议：
  - 后续新增项目级规则时，先判断是否属于 `AGENTS.md`；如果是执行细节或业务细节，优先写入 skill references。

## 2026-05-05 调整 skill 沉淀确认规则

- 当前目标：按用户确认，调整 `AGENTS.md` 中“修改 skill 文件前确认”的规则。
- 已更新文件：
  - `AGENTS.md`
  - `docs/session-handoff.md`
- 新规则摘要：
  - 修改 `AGENTS.md` 前仍需先说明将写入什么，并等待用户 `ok`、`确认` 或明确同意。
  - 新跑通且当前 skill 未覆盖、并且不是仅通过调整参数就能复用既有链路的新链路，必须在跑通后立即询问用户是否沉淀到 `skills/weex-admin-ops/`。
  - 用户确认沉淀后再更新 skill；未确认前不得写入 skill。
  - `temp/` 迁移仍需用户单独确认。

## 2026-05-05 补充链路沉淀与动作缓存规则

- 当前目标：按用户要求，确保已跑通链路不只写 skill，也要评估和登记动作缓存；浏览器模式和默认不可见模式可能是两套路径，需分别记录验证状态。
- 已更新文件：
  - `AGENTS.md`
  - `skills/weex-admin-ops/SKILL.md`
  - `skills/weex-admin-ops/references/action-cache.md`
  - `skills/weex-admin-ops/references/operations/activity-task-roulette-participant-scopes.md`
  - `skills/weex-admin-ops/scripts/action-cache.json`
  - `skills/weex-admin-ops/scripts/cache/command.mjs`
  - `skills/weex-admin-ops/scripts/cache/matcher.mjs`
  - `skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-task-management/roulette-participant-plan.mjs`
  - `skills/weex-admin-ops/scripts/business/activity-task-management/roulette-participant-create.mjs`
  - `skills/weex-admin-ops/scripts/lib/browser.mjs`
  - `docs/session-handoff.md`
- 新规则摘要：
  - 新跑通链路沉淀时必须同时评估 skill 文档和动作缓存。
  - 可复用且参数化成本合理的链路需要脚本化并登记 `scripts/action-cache.json`；暂不缓存时必须说明原因。
  - 可见浏览器模式和默认不可见模式要分别记录验证状态，未验证的模式不得写成已跑通。
- 新增动作缓存：
  - Action ID：`create_roulette_participant_scope_tasks`
  - 脚本：`scripts/create-roulette-participant-scope-tasks.mjs`
  - 用途：按参与范围创建 `转盘抽奖 / 单一奖励` 活动任务。
  - 默认模式：不可见浏览器；传 `--visible` 使用可见浏览器。
  - 当前验证状态：可见模式由 2026-05-05 手工浏览器链路实际跑通；新增缓存脚本本轮只做 dry-run 校验，不额外创建后台记录。
- `temp/` 未修改，暂存流程仍未迁移。

## 2026-05-05 稳定登录等待逻辑

- 用户确认：staging 登录页没有普通图形验证码，短暂出现 `placeholder="验证码"` 是页面未完全加载/状态未稳定导致。
- 只读验证：
  - `/prod-api/captchaImage` 返回 `captchaEnabled=false`、`code=200`，且无图片。
  - 页面稳定后只有 `账号`、`密码`、`谷歌验证码` 必填登录输入。
- 已修复 `skills/weex-admin-ops/scripts/lib/browser.mjs`：
  - 以 `/prod-api/captchaImage` 的 `captchaEnabled` 为准。
  - `captchaEnabled=false` 时，等待普通验证码输入隐藏，但短暂残留不再中止登录。
  - 只有 `captchaEnabled=true` 且独立普通验证码输入可见时，才报需要普通验证码处理。
  - 登录按钮点击改为 DOM 内部点击，并观察 `/prod-api/login`；如果未观察到登录请求，会重试一次点击。
  - 登录响应和最终 URL 只用于流程判断，不记录 token。
- 验证结果：
  - 可见浏览器模式登录 `/activity/register` 成功，最终 URL `https://stg-activity.weex.tech/activity/register`，`/prod-api/login` 返回 `code=200`。
  - 可见浏览器模式登录 `/activity/task` 成功，最终 URL `https://stg-activity.weex.tech/activity/task`。
- `temp/` 未修改，未迁移。
