# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 活动后台、FIN Admin 财务后台与前端页面操作自动化 skill、动作缓存、失败复盘、运行时依赖和首次配置检查。
- 活动后台权威 skill：`skills/weex-admin-ops/`，默认 staging：`https://stg-activity.weex.tech`。
- FIN Admin 权威 skill：`skills/weex-fin-admin-ops/`，默认 staging：`https://stg-admin-web-fin.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-29。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 必读入口

- 项目规范：`AGENTS.md`。
- 当前首次检查：`node tools/first-run-check.mjs --skill <admin|fin|frontend|all>`。
- 后管无头 API preflight：`node tools/admin-preflight.mjs`（无头链路审计/API surface 校验）。
- 对话配置写入：`node tools/configure-skill-env.mjs --skill <admin|fin|frontend> --from-stdin`。
- 后管 skill：`skills/weex-admin-ops/SKILL.md`。
- FIN Admin skill：`skills/weex-fin-admin-ops/SKILL.md`。
- 前端 skill：`skills/weex-frontend-ops/SKILL.md`。
- 三个失败复盘入口：`skills/weex-admin-ops/FAILURES.md`、`skills/weex-fin-admin-ops/FAILURES.md`、`skills/weex-frontend-ops/FAILURES.md`。

## 最近完成

- 2026-05-30 非转盘/非新手活动 API 全配置写验证补链路：修复 `GUESS / MONOPOLY_WORLD_CUP / AGENT_TRACE_PRO` 在 staging 的 min/full verify + cleanup 不稳定问题。关键修复包括：child 脚本登录导致 token 失效（创建活动前刷新 session + 支持用 `WEEX_ADMIN_AUTHORIZATION` 透传父会话 Authorization）、`create-prizes-fast-api.mjs` 增加 `--confirm-create` 确认开关并同步更新依赖脚本、MONOPOLY_WORLD_CUP 报名模板需使用 `用户手动点击报名`、GUESS/小活动 cleanup 增加解绑报名模板到默认 `2442` 后再删除，避免“模板被活动占用”报错。验证编排：`node skills/weex-admin-ops/scripts/verify-nonlottery-api-full-config-staging.mjs --confirm-run --verify-level <min|full> [--confirm-full-verify]`。

- 2026-05-30 模块级配置脚本 `--wizard` 收口：`CONTRACT_MINING / FLIP / GUESS / MONOPOLY_WORLD_CUP / AGENT_TRACE_PRO` 的模块配置脚本支持不传 `--action`/不传活动 ID 直接输出中文映射 + one-shot spec 模板；并统一 wizard 输出 `moduleNameMapSource/fieldNameMapSource` 为 `references/mappings/*.md`。

- 2026-05-30 活动列表“无 activity-web 运行时依赖”推进：新增 `references/catalogs/*.json`（活动任务类型、转盘抽奖样式、转盘抽奖支持任务）并改造 `newbie/lottery` 的 wizard 与 `verify-activity-tasks-*-all-types` 脚本改为读取 catalog；补齐新手/转盘的模块/字段中文映射（`references/mappings/newbie-activity-fields.md`、`references/mappings/lottery-activity-*.md`）；新增覆盖审计：`scripts/maintenance/audit-activity-api-full-config-coverage-all.mjs`。

- 2026-05-30 新增“全活动类型验证编排 + 能力自检”：新增 `verify-activity-api-full-config-staging.mjs`（按 新手→转盘→非新手非转盘11类 顺序执行 min/full verify + cleanup 的编排入口）；新增 `maintenance/audit-no-activity-web-runtime.mjs`（运行时不依赖 activity-web 审计）与 `maintenance/self-check-activity-api-full-config.mjs`（覆盖审计 + runtime 审计 + 全类型 wizard/module-config 映射输出自检）。同时补齐多个 config-wizard 的 `fieldNameMap/fieldNameMapSource` 输出，确保对话字段提示以中文映射为准。

- 2026-05-30 全活动类型 staging 证据闭环：已跑通 `verify-activity-api-full-config-staging.mjs --verify-level min` 与 `--verify-level full --confirm-full-verify`（默认 `--start-offset-seconds 120`，并执行 cleanup 删除创建的测试活动/依赖），覆盖 新手活动/转盘抽奖/非新手非转盘 11 个类型 的全配置创建、最小验证、最全验证（上线/下线）、清理删除闭环。

- 2026-05-30 自检一致性修复：补齐 `lottery-config-wizard-api.mjs --wizard` 的 `domain/moduleNameMap/fieldNameMap` 顶层输出（与其他活动向导一致），并在 `scripts/action-cache.json` 增加 `configure_beginner_task_activity*` 两个别名 actionId 以兼容按活动类型枚举调用与自然语言匹配。

- 2026-05-30 自然语言与运行时去耦加强：新增 `maintenance/audit-activity-nl-action-cache-match.mjs` 保障“活动列表 13 类活动”自然语言 query 可稳定命中对应 `configure_*_activity`；并把 option decorate 逻辑抽到 `scripts/lib/option-decorators.mjs`，运行时脚本不再 import `activity-web-mappings.mjs`（后者仅保留给维护脚本/测试读取 activity-web 用）。

- 2026-05-30 人人代理(AGENT) 任务 clone 绑定冲突修复：`INVITE_FRIEND` 模板含 `linkTaskId` 时，脚本改为先 clone 创建新的 `INVITED` 被邀请任务，再创建邀请任务并重绑 `linkTaskId`；`create-agent-full-config-explicit-deps-fast-api.mjs` cleanup 同步删除两条任务；staging 已跑通 `verify-nonlottery-api-full-config-staging.mjs --only agent` 的 min/full/cleanup 闭环验证。

- 2026-05-30 非转盘/非新手活动 staging 证据闭环：已跑通 `verify-nonlottery-api-full-config-staging.mjs` 的 `--verify-level min --only all` 与 `--verify-level full --only all`，覆盖 `TRADING_COMPETITION/RACE_COMPETITION/TRACE_PRO/CUSTOMIZED/RECHARGE_TRANS_TASK/AGENT/CONTRACT_MINING/FLIP/GUESS/MONOPOLY_WORLD_CUP/AGENT_TRACE_PRO` 的显式依赖创建、最小验证、最全验证（上线/下线）、清理删除闭环。

- 2026-05-30 合约挖矿（CONTRACT_MINING）修复：创建活动报 `任务配置重复`，原因是模板 `miningList` 多渠道时复用同一任务 ID；修复为按 `miningList` 条目创建多条任务并逐项绑定，同时异常退出也执行 cleanup，避免污染 staging。复盘：`skills/weex-admin-ops/failure-reviews/contract-mining-activity.md`。

- 2026-05-30 风险提示（staging 环境状态变更）：人人代理活动 `9247/allming-6233465` 在 full verify 过程中被下线后，接口提示 `不是未发布状态不可上线`，无法恢复到上线状态（后端限制）。当前已恢复其开始/结束时间字段，但状态保持 `OFFLINE`；后续跑 AGENT full verify 时脚本已改为检测到已有上线活动则直接报前置条件失败，不再自动下线存量活动。

- 2026-05-29 用户确认转盘抽奖活动默认 `用户报名模版` 应使用 `【2442】 全平台-无任何限制`，已替换旧默认 `2729`。新建并上线活动 `9694` / `wt43083858` 后，前端账号 `8186595891@weex.com` / UID `8186595891` 报名成功；通过 MQ 充值回调生成 10 次抽奖次数，不走 FIN 登录。二次权重专项可见浏览器复验通过：连续单抽 6 次均捕获 `恭喜你` 弹窗并用右上角 `X` 关闭，次数 `10 -> 4`，第 6 次弹窗文案为 `100 USDT 合约赠金`。已登记 `frontend_draw_weight_special_verify` action-cache，并更新前端 draw playbook 与失败复盘。

- 2026-05-29 已编辑 staging 转盘抽奖活动 `9107`：累计次数再权重配置为累计 5 次、同用户、奖品 ID `5` 权重 `100`，其余 7 个奖品权重 `0`；详情回查 `ONLINE / IN_PROGRESS` 且权重合计 `100`，用于前端第 6 次抽奖确定性断言。

- 2026-05-29 补齐转盘抽奖后管 AC-14「累计次数再权重配置」自动化覆盖：`lottery-activity-fast-api.mjs --action create-draft` 创建草稿时注入一组 `prizeWeight`（累计 5 次=同用户，8 行、奖品 ID 5 权重 100，其余 0），`lottery-admin-main-regression` 已把 AC-14 纳入 `create_lottery_activity_draft` 阶段，manifest `admin_activity_config.automationCaseIds` 已补 AC-14。
- 验证：单测 `lottery-admin-main-regression-lib.test.mjs` 通过；dry-run `--case-ids AC-14` 命中创建草稿阶段。注意：早期真实 staging 创建活动 `9691` 使用过均匀权重并已删除；随后按业务口径修正为同一活动只配置一侧，且使用确定性奖品权重，便于第 6 次抽奖断言中奖奖品。

- 2026-05-29 新增 activity-web 源码影响分析工具：
  - 脚本：`tools/activity-web-impact-check.mjs`，支持 `--activity-web-dir`、`--changed-files`，也可默认从 `activity-web` 执行 `git diff --name-only origin/main...HEAD`。
  - 核心库：`tools/lib/activity-web-impact.mjs`，将后管源码变更映射为影响业务链路、推荐 `caseId`、推荐 action-cache dry-run 命令，并输出接口/字段/枚举/未接自动化 case 的潜在覆盖缺口。
  - 测试：`tools/__tests__/activity-web-impact-check.test.mjs` 覆盖转盘奖池组件变更推荐回归，以及新增字段/接口覆盖缺口识别。
  - 当前真实 `activity-web` 路径 `/Users/jonathan/Documents/Codex/2026-05-05/activity-web` 本地与 `origin/main` 无差异，工具输出影响为空。
- 2026-05-29 按用户纠正更新转盘抽奖 AC-15/ST-03 口径：复制失败根因是源活动别名过长；回归固定使用小于 10 字符的新建活动别名执行复制，删除用例直接删除草稿状态活动。已移除 manifest 中 AC-15/ST-03 阻塞标记，并同步 row-action playbook 与失败复盘。

- 2026-05-29 交易大赛（TRADING_COMPETITION）API 全配置沉淀增强：
  - 显式依赖全配脚本：`skills/weex-admin-ops/scripts/create-competition-full-config-explicit-deps-fast-api.mjs`（applyConfigId + prizePoolIds + 交易量任务；支持 min/full verify + cleanup）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/competition-activity-modules.md`、`skills/weex-admin-ops/references/mappings/competition-activity-fields.md`
  - NL/action-cache：`configure_trading_competition_activity`、`configure_trading_competition_activity_modules`

- 2026-05-29 交易竞速赛（RACE_COMPETITION）API 全配置沉淀增强：
  - 显式依赖全配脚本：`skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 交易量任务 + 赠金奖品；支持 min/full verify + cleanup）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/race-activity-modules.md`、`skills/weex-admin-ops/references/mappings/race-activity-fields.md`
  - NL/action-cache：`configure_race_competition_activity`、`configure_race_competition_activity_modules`

- 2026-05-29 小活动型活动（TRACE_PRO）API 全配置沉淀补齐（已可 dry-run 命中）：
  - 全配显式依赖脚本：`skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 赠金奖品 + 交易量任务(带奖品绑定) + 资源卡；支持 min/full verify（online/offline）和 cleanup）
  - 活动动作脚本：`skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs`（snapshot/inspect-template/create-draft/draft-checks/online/offline/delete）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/tracepro-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/tracepro-activity-modules.md`、`skills/weex-admin-ops/references/mappings/tracepro-activity-fields.md`
  - NL/action-cache：`configure_trace_pro_activity`、`configure_trace_pro_activity_modules`
  - 资源卡依赖创建能力补齐：`skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action create-min --activity-type TRACE_PRO`

- 2026-05-29 定制化活动（CUSTOMIZED）API 全配置沉淀补齐（已可 dry-run 命中）：
  - 全配显式依赖脚本：`skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 交易量任务；支持 min/full verify（online/offline）和 cleanup）
  - 活动动作脚本：`skills/weex-admin-ops/scripts/customized-activity-fast-api.mjs`（snapshot/inspect-template/create-draft/draft-checks/online/offline/delete）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/customized-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/customized-activity-modules.md`、`skills/weex-admin-ops/references/mappings/customized-activity-fields.md`
  - NL/action-cache：`configure_customized_activity`、`configure_customized_activity_modules`

- 2026-05-29 充值交易活动（RECHARGE_TRANS_TASK）API 全配置沉淀补齐（已可 dry-run 命中）：
  - 全配显式依赖脚本：`skills/weex-admin-ops/scripts/create-recharge-trans-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 交易量任务；支持 min/full verify（online/offline）和 cleanup）
  - 活动动作脚本：`skills/weex-admin-ops/scripts/recharge-trans-activity-fast-api.mjs`（snapshot/inspect-template/create-draft/draft-checks/online/offline/delete）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/recharge-trans-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/recharge-trans-activity-modules.md`、`skills/weex-admin-ops/references/mappings/recharge-trans-activity-fields.md`
  - NL/action-cache：`configure_recharge_trans_task_activity`、`configure_recharge_trans_task_activity_modules`

- 2026-05-29 人人代理活动（AGENT）API 全配置沉淀补齐（已可 dry-run 命中）：
  - 全配显式依赖脚本：`skills/weex-admin-ops/scripts/create-agent-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 邀请任务；支持 min/full verify（online/offline）和 cleanup）
  - 活动动作脚本：`skills/weex-admin-ops/scripts/agent-activity-fast-api.mjs`（snapshot/inspect-template/create-draft/draft-checks/online/offline/delete）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/agent-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/agent-activity-modules.md`、`skills/weex-admin-ops/references/mappings/agent-activity-fields.md`
  - NL/action-cache：`configure_agent_activity`、`configure_agent_activity_modules`

- 2026-05-29 合约挖矿活动（CONTRACT_MINING）API 全配置沉淀补齐（已可 dry-run 命中）：
  - 全配显式依赖脚本：`skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs`（applyConfigId + 合约挖矿任务；支持 min/full verify（online/offline）和 cleanup）
  - 活动动作脚本：`skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs`（snapshot/inspect-template/create-draft/draft-checks/online/offline/delete）
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs`（snapshot -> spec -> update）
  - 中文映射：`skills/weex-admin-ops/references/mappings/contract-mining-activity-modules.md`、`skills/weex-admin-ops/references/mappings/contract-mining-activity-fields.md`
  - NL/action-cache：`configure_contract_mining_activity`、`configure_contract_mining_activity_modules`

- 2026-05-29 小丑牌活动（FLIP）API 全配置沉淀补齐（已可 dry-run 命中）：
  - operations：`skills/weex-admin-ops/references/operations/activity-management-flip.md`
  - 中文映射：`skills/weex-admin-ops/references/mappings/flip-activity-modules.md`、`skills/weex-admin-ops/references/mappings/flip-activity-fields.md`
  - NL/action-cache：`configure_flip_activity`、`configure_flip_activity_modules`

- 2026-05-29 竞猜大赛（GUESS）API 全配置沉淀补齐（已可 dry-run 命中；待写操作验证）：
  - 中文映射：`skills/weex-admin-ops/references/mappings/guess-activity-modules.md`、`skills/weex-admin-ops/references/mappings/guess-activity-fields.md`
  - NL/action-cache（dry-run 命中）：`configure_guess_activity`、`configure_guess_activity_modules`
  - 显式依赖全配脚本（min/full verify + cleanup）：`skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs`
  - 依赖项脚本：`skills/weex-admin-ops/scripts/create-guess-integral-task-fast-api.mjs`、`skills/weex-admin-ops/scripts/create-guessing-task-fast-api.mjs`
  - modules 全量配置脚本：`skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs`（含 i18n/pageSetting/FAQ/guessList/calendar）
  - operations：`skills/weex-admin-ops/references/operations/activity-management-guess.md`

- 2026-05-29 大富翁世界杯（MONOPOLY_WORLD_CUP）API 全配置沉淀补齐（已可 dry-run 命中；待写操作验证）：
  - 中文映射：`skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-modules.md`、`skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-fields.md`
  - NL/action-cache（dry-run 命中）：`configure_monopoly_world_cup_activity`、`configure_monopoly_world_cup_activity_modules`
  - 显式依赖全配脚本（min/full verify + cleanup）：`skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs`
  - modules 全量配置脚本：`skills/weex-admin-ops/scripts/monopoly-worldcup-activity-module-config-fast-api.mjs`
  - operations：`skills/weex-admin-ops/references/operations/activity-management-monopoly-worldcup.md`

- 2026-05-29 代理小活动（AGENT_TRACE_PRO）API 全配置沉淀补齐（已可 dry-run 命中；待写操作验证）：
  - 中文映射：`skills/weex-admin-ops/references/mappings/agent-tracepro-activity-modules.md`、`skills/weex-admin-ops/references/mappings/agent-tracepro-activity-fields.md`
  - NL/action-cache：`configure_agent_trace_pro_activity`、`configure_agent_trace_pro_activity_modules`
  - 显式依赖全配脚本（min/full verify + cleanup）：`skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs`
  - 依赖项脚本：`skills/weex-admin-ops/scripts/create-agent-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs`
  - 模块级自由配置脚本：`skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs`
  - operations：`skills/weex-admin-ops/references/operations/activity-management-agent-tracepro.md`

- 2026-05-28 及更早交接记录已归档：`docs/session-handoffs/2026-05-26-to-2026-05-28-and-earlier.md`
- 2026-05-11 至 2026-05-22 抽奖、FIN、前端运行时与历史链路摘要已归档：`docs/session-handoffs/2026-05-11-to-22-lottery-and-runtime.md`

## 当前 Git 状态

- 当前分支：`dev`。
- 最近本地提交：`b882407 fix: vendor frontend login runtime and auto-install deps`。
- 本轮架构整改相关文件尚未提交；`.env.local` / `.DS_Store` 仍按用户要求暂不处理。

## 后续接力建议

- 新会话处理业务任务前，先运行 `tools/first-run-check.mjs` 检查对应 skill。
- 若缺配置，优先让用户选择：
  - 文件方式：复制对应 `.env.example` 到 skill `.env.local` 后填写。
  - 对话方式：用户直接提供缺失值，Codex 写入对应 skill `.env.local`，不回显真实值。
  - 脚本方式：通过 `tools/configure-skill-env.mjs --from-stdin` 写入。
- FIN 登录态不能随仓库提交；同事首次使用 FIN 能力时需要在自动打开的持久 CDP FIN 页面登录并关闭该页面。
- 合约充值批量链路如果高并发中途失败，不要重复创建整批账号；先按生成邮箱回查 UID，只补未发放 UID，再重试前端划转。当前组合脚本已内置前端划转 `70008`/`20105` 延迟重试。
- `.env.local`、`.DS_Store` 仍保持本机未跟踪；真实密码、验证码、token、cookie、API key 不提交。

## 安全说明

- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证到可提交文件。
- STG/test 测试账号邮箱和 UID 可完整记录；生产或未明确非生产时仍需脱敏。
- 截图仅在用户明确要求时保存。
