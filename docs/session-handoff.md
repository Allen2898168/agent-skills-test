# 会话交接记录

## 当前状态

- 当前目标：维护 WEEX 活动后台、FIN Admin 财务后台与前端页面操作自动化 skill、动作缓存、失败复盘、运行时依赖和首次配置检查。
- 活动后台权威 skill：`skills/weex-admin-ops/`，默认 staging：`https://stg-activity.weex.tech`。
- FIN Admin 权威 skill：`skills/weex-fin-admin-ops/`，默认 staging：`https://stg-admin-web-fin.weex.tech`。
- 前端权威 skill：`skills/weex-frontend-ops/`，目标 URL 按用户输入或 `references/routes.md`。
- 最近更新时间：2026-05-26。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 必读入口

- 项目规范：`AGENTS.md`。
- 当前首次检查：`node tools/first-run-check.mjs --skill <admin|fin|frontend|all>`。
- 对话配置写入：`node tools/configure-skill-env.mjs --skill <admin|fin|frontend> --from-stdin`。
- 后管 skill：`skills/weex-admin-ops/SKILL.md`。
- FIN Admin skill：`skills/weex-fin-admin-ops/SKILL.md`。
- 前端 skill：`skills/weex-frontend-ops/SKILL.md`。
- 三个失败复盘入口：`skills/weex-admin-ops/FAILURES.md`、`skills/weex-fin-admin-ops/FAILURES.md`、`skills/weex-frontend-ops/FAILURES.md`。

## 最近完成

- 2026-05-26 执行抽奖回归（headless_full, selection=全部）：
  - 汇总：PASS 82 / FAIL 10 / SKIPPED 0（后管 55/55 PASS；前端 27 PASS / 10 FAIL）。
  - 前端活动别名：normal=`n08883453`（URL `https://stg-www.weex.tech/zh-CN/events/draw/n08883453`）。
  - FAIL：`FE-73/FE-75/FE-76`（联动展示断言失败，见 `skills/weex-frontend-ops/failure-reviews/draw-ui.md`），`FE-36/FE-37/FE-48/FE-49/FE-50/FE-55/FE-56`（`repoRoot is not defined`，已补充到 `skills/weex-frontend-ops/failure-reviews/lottery-regression.md`）。
  - 报告：`orchestrations/lottery-regression/artifacts/reports/20260526_172109/summary.json`，并已生成 `case-results.md` / `case-results.tsv` 供按用例查看。

- 2026-05-26 已沉淀“抽奖回归标准执行策略”：全量只跑一次、失败只记录与汇总、输出完成后等待用户确认（`ok`）再进行失败重试或其他方案；见 `orchestrations/lottery-regression/README.md`。

- 2026-05-26 执行抽奖回归（headless_full, selection=全部）：
  - 汇总：PASS 67 / FAIL 4 / SKIPPED 21（后管 55/55 PASS；前端 12 PASS / 4 FAIL / 21 SKIPPED）。
  - 报告：`orchestrations/lottery-regression/artifacts/reports/20260526_170823/summary.json`（活动别名 normal=`n08119754`）。
  - FAIL：`FE-81/FE-82/FE-83/FE-22`（原因：`logFlowProgress is not defined`，报名/充值阶段脚本报错导致阻塞）。
  - 运行期改动：`orchestrations/lottery-regression/scripts/run-full-headless.mjs` 改为按 selection 只检查必需 skill（避免 FIN 登录态未就绪时阻塞不涉及 FIN 的抽奖回归）。
  - 修复：`skills/weex-frontend-ops/scripts/lib/lottery-frontend-main-flow-helpers.mjs` 补齐 `logFlowProgress(...)`，并记录到 `skills/weex-frontend-ops/failure-reviews/lottery-regression.md`（待用户确认后重跑失败 selection 复验）。

- 2026-05-26 执行抽奖回归（selection=全部）二次全量：
  - 汇总：PASS 89 / FAIL 5 / SKIPPED 9。
  - FAIL：`FE-18/FE-80`（`frontend_prestart_checks`，`page.goto https://stg-www.weex.tech/zh-CN` 60s 超时，疑似前端首页偶发慢/不可达）、`FE-73/FE-75/FE-76`（历史联动断言失败）。
  - 稳定性修复：`skills/weex-frontend-ops/scripts/business/auth-pages.mjs` 将 `openLoginStatePage` 改为“先直达 account，再必要时回 home 重试”，并把 `Timeout ... exceeded` 纳入可重试；导航 timeout 提升到 90s。
  - 复验：重跑 selection=`登录态 / 活动态 / 次数态,报名链路` 后 `FE-18/FE-80` 均恢复 `PASS`。
  - 报告：`orchestrations/lottery-regression/artifacts/reports/20260526_132759/case-results.md` 与 `orchestrations/lottery-regression/artifacts/reports/20260526_132759/case-results.tsv`。
  - 日志：`orchestrations/lottery-regression/artifacts/tmp/last-dispatcher-run.log`、`orchestrations/lottery-regression/artifacts/tmp/rerun-prestart-signup.log`。

- 2026-05-26 执行抽奖回归（selection=全部）：
  - 汇总：PASS 91 / FAIL 3 / SKIPPED 9（SKIPPED 为 manifest 已登记但未接自动化入口）。
  - FAIL：`FE-73`（标题联动可见断言失败）、`FE-75`（切语言断言失败）、`FE-76`（FAQ 断言失败）。
  - 本次新增接入并验证：`FE-16/FE-18/FE-80/FE-27/FE-55/FE-56` 均 `PASS`。
  - SKIPPED（未接自动化）：`AC-14`、`FE-20`、`FE-23`、`FE-38`、`FE-39`、`FE-51`、`FE-52`、`FE-53`、`FE-54`。
  - 报告：`orchestrations/lottery-regression/artifacts/reports/20260526_150338/case-results.md` 与 `orchestrations/lottery-regression/artifacts/reports/20260526_150338/case-results.tsv`。
  - 失败复盘：已补充 `skills/weex-frontend-ops/failure-reviews/draw-ui.md`（FE-73）。

- 2026-05-26 按业务口径从抽奖回归移除“副标题”用例：`FE-04`（基础副标题）已从 `docs/workflows/lottery-regression-manifest.json`、`orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs` 的执行清单移除；副标题不再作为回归断言项。

- 2026-05-26 后管无头链路继续 API 化并验证：
  - `orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs` 的“创建草稿+上线活动”已切到 `skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs --action create-draft/online`（不再走 `create-lottery-activity-draft.mjs` / `online-lottery-activity.mjs` UI 链路）。
  - `skills/weex-admin-ops/scripts/register-template-search-checks-fast-api.mjs` 新增，用 API 完成 `RT-01/RT-02` 搜索校验；`skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs` 已改为 headless 优先使用该脚本，headless 下不再包含 UI 搜索脚本。
  - 抽奖全量无头回归验证：报告目录 `orchestrations/lottery-regression/artifacts/reports/20260526_131218`，耗时 `717.75s`，后管 `55/55 PASS`，前端 `33` 用例中 `30 PASS / 3 FAIL`（当前 FAIL 为 `FE-75/FE-76` 及一次 `FE-73` 缓存导致的误报，已通过 URL cache-bust 重试策略修复）。

- 2026-05-26 定位并修复抽奖回归联动阶段误失败：
  - `FE-73`：`skills/weex-admin-ops/scripts/lottery-frontend-backend-linkage-basic.mjs` 因漏写 `await loadPlaywright()` 导致脚本秒退（exitCode=1）；已修复为 `await loadPlaywright()`。
  - `FE-03`：后管快照应优先取 `activityConfigI18n.zh_CN.title/subTitle`（前端标题展示使用 i18n 字段），已更新 `skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs` 的 `snapshot` 取值逻辑（缺失再回退根字段）。
  - `FE-75/FE-76/FE-78`：前端只读探测增强（语言切换用独立 `en-US` context；FAQ 排除全站 footer 防误判；活动日历 tab 放宽 fixed/offsetParent 影响），但当前仍存在：`/events/draw/<alias>` 会重定向回 `/zh-CN/...`、活动副标题与后管不一致（见 `skills/weex-frontend-ops/failure-reviews/draw-ui.md`）。

- 2026-05-26 验证后管登录态与联动改配置均可走接口（无头模式尽量不走 UI）：
  - 后管接口登录：`GET /prod-api/captchaImage`（确认 `captchaEnabled=false`）→ `POST /prod-api/login`（携带 `totp`）拿到 `Bearer token`。
  - `skills/weex-admin-ops/scripts/lib/admin-api.mjs` 的 `createAdminApiSession` 已改为“优先接口登录，失败再回退 UI 抓 header”。
  - 联动用例后管改标题/副标题：`skills/weex-admin-ops/scripts/lottery-frontend-backend-linkage-basic.mjs` 已改为 `PUT /prod-api/activity/config` 更新（含 `activityConfigI18n.zh_CN`），并默认自动恢复原值。验证：标题可回显；副标题存在于页面数据但未在副标题位渲染（用例继续 FAIL 告警）。

- 2026-05-26 接入联动展示只读用例到自动化：`FE-75/FE-76/FE-77/FE-78` 已挂到 `lottery_frontend_main_regression` 的 `frontend_backend_linkage_readonly` 阶段（不改后管配置；按 URL 语言前缀切换验证多语言、在 `main` 区域探测 FAQ、奖池与活动日历入口信号）。

- 2026-05-26 接入联动展示用例到自动化：`FE-73` 已挂到 `lottery_frontend_main_regression` 的 `frontend_backend_linkage` 阶段（调用 `skills/weex-admin-ops/scripts/lottery-frontend-backend-linkage-basic.mjs` 后管修改标题并验证前端回显）。执行该阶段会改动活动配置（staging）。

- 2026-05-26 接入前端页面基础展示用例到自动化：`FE-02/FE-03/FE-04/FE-05/FE-06/FE-08` 已纳入 `frontend_readonly_checks`（通过后管 `snapshot` 拉取 title/subtitle/rules/prizeCount，与前端只读页采集做一致性比对）。manifest 已更新 `frontend_page_basic.automationCaseIds` 覆盖 `FE-01`-`FE-08`；本次验证活动别名 `lf26084942`，前端 URL `https://stg-www.weex.tech/zh-CN/events/draw/lf26084942`，结果：`FE-02 PASS / FE-03 PASS / FE-04 FAIL / FE-05 PASS / FE-06 PASS / FE-08 PASS`（`FE-04` 副标题与后管 `subtitle="严格 UI 复杂配置副标题"` 不一致，前端展示为 `自动化测试 - 实物_20260525134927`）。

- 2026-05-26 执行抽奖全量无头回归（selection=全部）：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "全部" --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=true`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260526_093300`；活动别名：普通 `n80798172`；用例汇总 `PASS 78 / FAIL 0 / SKIPPED 0`（后管 `55/55`、前端 `23/23`）；总耗时 `494.86s`；前端验证 URL `https://stg-www.weex.tech/zh-CN/events/draw/n80798172`，默认 viewport `desktop 1440x1000`。

- 2026-05-25 执行抽奖全量无头回归（selection=全部）：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "全部" --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=false`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_191737`；活动别名：普通 `n29471800`、二次权重 `w29474212`、小库存 `s29476492`；用例汇总 `PASS 69 / FAIL 4 / SKIPPED 5`（后管 `55/55` 全通过；前端 `PASS 14 / FAIL 4 / SKIPPED 5`）；前端失败集中在单抽阶段：`FE-32`-`FE-35` 抽奖接口返回 `code=50000 / 系统繁忙，请稍后再试！`，导致奖励记录阶段 `FE-36`/`FE-37`/`FE-48`/`FE-49`/`FE-50` 跳过；前端验证 URL `https://stg-www.weex.tech/zh-CN/events/draw/n29471800`，默认 viewport `desktop 1440x1000`。

- 2026-05-25 执行抽奖全量无头回归（selection=全部）：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "全部" --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=true`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_190116`；活动别名：普通 `n28494119`、二次权重 `w28496675`、小库存 `s28498991`；用例汇总 `PASS 78 / FAIL 0 / SKIPPED 0`（后管 `55/55`、前端 `23/23`）；总耗时 `571.98s`；前端验证 URL `https://stg-www.weex.tech/zh-CN/events/draw/n28494119`，默认 viewport `1440x1000`。

- 2026-05-25 修复 `run-full-headless.mjs` 汇总统计只显示前端 `caseResults`、忽略后管用例的问题：后管脚本 `--compact` 输出不含 `phaseResults/caseResults`，导致 `summary.json` 的 `caseSummary.byEntrypoint.admin.total=0`。现改为优先读取 `--report-path` 生成的 `admin.json`（含 `caseResults`）再统计，后续汇总应为后管 `55` + 前端 `23` = `78` 条自动化用例。

- 2026-05-25 执行抽奖全量无头回归：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=true`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_182359`；活动别名：普通 `n26254893`、二次权重 `w26257238`、小库存 `s26259523`；总耗时 `484.11s`。前端回归默认 viewport `1440x1000`，最终验证 URL `https://stg-www.weex.tech/zh-CN/events/draw/n26254893`；前端用例 `PASS 23 / FAIL 0 / SKIPPED 0`，后管阶段均通过（奖品/报名模板/任务/活动上下线链路通过，最终停留 `/activities/lottery`）。

- 2026-05-25 执行抽奖全量无头回归：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=false`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_184100`；活动别名：普通 `n27275652`、二次权重 `w27278288`、小库存 `s27280617`；用例汇总 `PASS 69 / FAIL 4 / SKIPPED 5`（后管 `55/55` 全通过；前端 `PASS 14 / FAIL 4 / SKIPPED 5`）。前端失败集中在单抽阶段：`FE-32`-`FE-35` 抽奖接口返回 `code=50000 / 系统繁忙，请稍后再试！`，导致奖励记录阶段 `FE-36`/`FE-37`/`FE-48`/`FE-49`/`FE-50` 跳过；最终验证 URL `https://stg-www.weex.tech/zh-CN/events/draw/n27275652`。

- 2026-05-25 执行抽奖全量无头回归入口：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs`。报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_180119`；活动别名：普通 `n24894463`、二次权重 `w24896921`、小库存 `s24899327`。后管阶段通过（admin `ok=true`），前端 normal 单抽阶段接口返回 `code=50000 / 系统繁忙，请稍后再试！`，导致 `FE-32`-`FE-35` fail、奖励记录阶段跳过；失败复盘补充到 `skills/weex-frontend-ops/failure-reviews/draw-kafka.md`。同日修复 `run-full-headless.mjs --dry-run` 实际执行写入的问题：dry-run 现在只输出计划且不创建活动/不跑阶段；并将前端结果 JSON 写入 `reportRoot/frontend_<partition>.json` 便于定位。

- 2026-05-25 已修复 100+ manifest 全量中 `PM-01`-`PM-07` 的奖品阶段超时问题。单跑 `create-regression-prizes-fast-api.mjs` 通过且耗时约 `16.2s`，确认脚本本身不是稳定超时；根因是 `lottery-regression-dispatcher --all` 并发启动后管主回归和未传活动别名的前端主回归，两个入口都会使用同一个后管账号，造成同账号后管登录态互相干扰。已在 `orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs` 增加 `ADMIN_SESSION` 资源锁：允许无依赖入口并发，但同一时刻只运行一个后管登录态入口。验证：`node --test skills/weex-admin-ops/scripts/__tests__/lottery-regression-dispatcher.test.mjs` 通过；单跑 `PM-01`-`PM-07` 得到 `PASS 7`；重跑 100+ manifest 时 `create_regression_prizes` 耗时约 `14.7s` 并通过，原 7 个 fail 已消除。该次全量剩余为前端单抽接口 `code=50000 / 系统繁忙，请稍后再试！`，导致 `FE-32`-`FE-35` 失败，奖励记录相关 5 条跳过；当前汇总变为 `PASS 69 / FAIL 4 / SKIPPED 32`。

- 2026-05-25 按用户纠正执行 100+ manifest 全量入口 `node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --all`，本轮退出码 `1`，不是通过态。汇总：选中场景 `12` 个、用例 `105` 条，结果 `PASS 43 / FAIL 7 / SKIPPED 55`；场景状态 `PASS 2 / FAIL 1 / PARTIAL 6 / SKIPPED 3`。失败集中在后管奖品阶段：`create_regression_prizes` 子命令 `create-regression-prizes-fast-api.mjs` 超过 `300000ms` 未返回，导致 `PM-01`-`PM-07` 失败，并使依赖奖品集的活动配置、活动列表和上下线 case 跳过。前端活动别名 `lf25152435`，前端主链路 `readonly/signup/recharge/single_draw/reward_record` 通过；充值轮询期间登录态短暂掉线，固定重注入 cookie 逻辑恢复成功，抽奖次数刷新到 `110`。失败复盘已补充到 `skills/weex-admin-ops/failure-reviews/common.md`；下一步应先单跑并修复奖品快路径超时，再重跑 100+ manifest。

- 2026-05-25 按用户要求再次重跑当前无头全量入口，命令：`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`。结果 `ok=true`，报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_171348`，活动别名：普通 `n22044787`、二次权重 `w22047246`、小库存 `s22049611`；阶段耗时：`first_run_check_all=3.90s`、`prepare_activities_batch=19.26s`、`run_admin=244.03s`、`run_frontend_normal=309.37s`、总耗时 `576.57s`。用例结果：后管 `55 PASS / 0 FAIL / 0 SKIPPED`；前端 normal 主链路 `readonly/signup/recharge/single_draw/reward_record` 均通过，其中充值轮询期间出现登录态短暂掉线，固定重注入 cookie 逻辑恢复成功，最终抽奖次数从 `0` 刷新到 `110`。

- 2026-05-25 已重新执行当前无头全量入口 `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --admin-concurrency 1 --concurrency 10 --start-offset-seconds 3 --wait-for-start-ms 60000`，结果通过。报告目录：`orchestrations/lottery-regression/artifacts/reports/20260525_170000`；活动别名：普通 `n21216941`、二次权重 `w21220544`、小库存 `s21223037`；阶段耗时：`first_run_check_all=3.83s`、`prepare_activities_batch=20.10s`、`run_admin=240.41s`、`run_frontend_normal=321.03s`、总耗时 `585.37s`。当前可执行入口实际覆盖：后管 `55 PASS / 0 FAIL / 0 SKIPPED`，前端 normal 主链路通过；二次权重/小库存前端分区已完成活动准备但尚未纳入逐 case 计数。首轮准备活动时普通活动创建遇到一次 HTTP 504，已在 `skills/weex-admin-ops/scripts/create-online-lottery-activities-batch-fast-api.mjs` 增加创建重试与 alias 回查恢复，重跑成功。

- 2026-05-25 已完成“全量无头模式链路 API 化优化并验证”：后管主回归默认无头模式从 `headless_ui` 切到 `headless_api`，新增 `skills/weex-admin-ops/scripts/lib/admin-api.mjs` 以及奖品、报名模板、任务、活动草稿/上下线/复制删除等 API 快路径脚本；可见浏览器模式仍保留真实 UI 写操作。关键修复：`AC-08` 活动任务绑定统计改为同时取 `taskRequirement/taskConfig/taskConfigIds` 最大值。验证结果：后管主回归报告 `orchestrations/lottery-regression/artifacts/reports/20260525_163530_api_opt/admin.json` 为 `55 PASS / 0 FAIL / 0 SKIPPED`，耗时约 `237s`；完整无头编排报告目录 `orchestrations/lottery-regression/artifacts/reports/20260525_163946`，活动别名 `n20000991 / w20003404 / s20005717`，总耗时 `612.49s`，`first_run_check_all`、`prepare_activities_batch`、`run_admin`、`run_frontend_normal` 均通过。

- 2026-05-25 验证“创建 + 上线活动”API 快路径可行：新增 `skills/weex-admin-ops/scripts/create-online-lottery-activity-fast-api.mjs`，以现有活动别名为模板，直接调用 `/prod-api/activity/config` 创建并调用 `/prod-api/activity/lottery/online` 上线；已确认上线接口请求体关键字段为 `totp`（Google 验证码），并把活动开始时间窗口计算移动到“创建前最后一刻”以支持 `--start-offset-seconds 30`。验证结果：基于模板别名 `lf25085715` 成功创建并上线新活动（示例：alias `api1065545`，id `9486`，状态 `ONLINE`）。

- 2026-05-25 验证“二次权重 / 小库存”也可复用 API 快路径：先用严格 UI 脚本创建对应模板草稿 alias `lw25121831`（权重）与 `ls25122120`（小库存），再分别用 API 快路径创建并上线（开始时间按 5 秒后）：`w11649956`（权重 online）与 `s11848340`（小库存 online）。

- 2026-05-25 新增“YAML 用例 + headless runner”最小闭环：引入 `yaml` 依赖并新增 `orchestrations/lottery-regression/scripts/run-case.mjs`，支持按 caseId 顺序执行依赖链并复用同一活动上下文。已沉淀用例 YAML：`orchestrations/lottery-regression/cases/FE-81.yml`、`/FE-82.yml`、`/FE-84.yml`、`/FE-22.yml`，共享 flow：`orchestrations/lottery-regression/flows/activity-online.yml` 等。验证：`node orchestrations/lottery-regression/scripts/run-case.mjs --case FE-22` 在 headless 模式可跑通 FE-81→FE-82→FE-84→FE-22 链路并复用同一活动别名。

- 2026-05-25 执行前端抽奖主流程真跑（新活动 `lf25085715`）：后管创建草稿活动 ID `9472` 并上线 `status=ONLINE` 成功；前端报名成功（`立即报名 -> 抽奖`）。但 FIN `mq_recharge_callback_send` 回调发送成功后，活动页 `drawCount` 仍为 `0`，单抽阶段未触发 `luckDraw` 请求，抽奖用例被阻塞。已记录到 `skills/weex-frontend-ops/failure-reviews/draw-kafka.md`，后续需确认任务回调与活动充值任务的匹配关系或增加轮询/延迟验证。

- 2026-05-25 执行抽奖回归编排 `orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --all`：总计 `case PASS=21 / FAIL=34 / SKIPPED=50`。主要阻塞点：1）后管主回归创建草稿活动时后端返回 `开始时间不可小于现在时间`，导致后管列表/上下线相关 case 大量跳过；已定位为“上海时区时间窗口被按 UTC 字段格式化”问题，已修复 `skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs` 的时间生成方式。2）前端回归在 `frontend_recharge_prepare` 阶段调用 FIN `mq_recharge_callback_send` 失败，根因是 Kafka UI 需要先点一次 `Produce Message` 打开编辑面板，否则 ACE editor 不存在；已修复 `skills/weex-fin-admin-ops/scripts/business/mq-recharge/flow.mjs` 并补充 FIN 失败复盘。相关失败复盘：`skills/weex-admin-ops/failure-reviews/activity-management.md`、`skills/weex-fin-admin-ops/failure-reviews/common.md`。

- 2026-05-25 已完成目录与调用链整改：新增跨域编排层 `orchestrations/lottery-regression/`，后管原 `lottery-regression-dispatcher.mjs`、`lottery-frontend-main-regression.mjs` 和 `lottery-frontend-main-flow.mjs` 仅保留兼容入口；前端页面主流程迁移到 `skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs`。同步修正前端登录缓存默认目标为 `/zh-CN/account`，拆分超长 lottery/draw reference，归档并分卷超长 workflow/test-case 文档。三类 skill 结构校验与 `npm run check:orchestration` 均通过。未处理已跟踪 `.env.local` / `.DS_Store`，因为用户明确要求排除该项。

- 2026-05-22 已把 `lottery_admin_main_regression` 主调度器修到可正常承接真实后管回归，并完成定向真跑验证。当前结论：`ST-02 已上线活动下线` 已通过总入口真实 `PASS`；`AC-15 活动复制` 与 `ST-03 草稿删除` 已接入自动化编排，但当前统一受“源活动配置的别名太长，导致复制失败”缺陷阻塞，接口表现为 `POST /prod-api/activity/config/copy` 返回 HTTP 200 / 业务 `code=500` / `msg=system busy, please retry later`。该问题已作为“自动化回归测试真实发现的 bug”登记到 [docs/workflows/lottery-automation-regression-bug-log.md](docs/workflows/lottery-automation-regression-bug-log.md)。后续默认活动别名控制在 `10` 个字符以内，只有边界值测试才允许显式使用更长别名。

- 2026-05-19 已完成转盘抽奖 3 个标准回归模板的真实创建验证，并正式沉淀为 `weex-admin-ops` 权威模板定义。可见浏览器模式验证结果：普通回归模板活动 ID `9219`、别名 `autotest-20260519100833-normal`；二次权重专项模板活动 ID `9222`、别名 `autotest-20260519102933-weight`；小库存专项模板活动 ID `9223`、别名 `autotest-20260519103256-stock`。3 条链路均真实触发 `POST /prod-api/activity/config`，业务 `code=200`，列表按别名回查 `total=1`，状态均为 `DRAFT`。已同步更新 [skills/weex-admin-ops/references/operations/activity-management-lottery.md](skills/weex-admin-ops/references/operations/activity-management-lottery.md) 和 [docs/workflows/lottery-activity-template-validation-checklist.md](docs/workflows/lottery-activity-template-validation-checklist.md)。同时已补强 `strict-lottery-visible-attempt.mjs`：奖品行下拉选择后必须回读已绑定值，8 行奖品均非空才允许继续提交，避免出现“页面看似选中但 `prizeConfigForm` 未绑定成功”的假通过。

- 2026-05-19 已补充确认 `活动列表 / 转盘抽奖` 页的 `复制` 行为：操作栏包含 `查看 / 修改 / 下线 / 复制` 等按钮，点击 `复制` 会生成一个新的草稿状态活动。已同步更新到后管回归用例 [docs/test-cases/lottery-admin-regression-cases.md](docs/test-cases/lottery-admin-regression-cases.md) 和自动化落地方案 [docs/workflows/lottery-automation-regression-plan.md](docs/workflows/lottery-automation-regression-plan.md)，后续可将“复制活动生成草稿”作为标准活动准备路径使用。

- 2026-05-19 已新增自动化落地方案文档 [docs/workflows/lottery-automation-regression-plan.md](docs/workflows/lottery-automation-regression-plan.md)。该方案已按用户最新确认沉淀自动化前提：每次回归使用新活动；普通回归、二次权重、小库存三类活动隔离；固定测试账号参与前端回归；前端抽奖前需先完成 `合约交易量任务` 和 `充值任务` 获取次数；抽奖完成后延迟 `5秒` 再检查 `我的奖品 -> 奖励记录`；库存不足通过独立活动专项验证；当前不纳入并发场景。该文档后续可作为 skills 自动化执行入口和分层实现的规划依据。
- 2026-05-19 已真实跑通“按 UID 发送充值 MQ 回调”链路，并沉淀到 `weex-fin-admin-ops`。新增脚本 [skills/weex-fin-admin-ops/scripts/mq-recharge-callback-send.mjs](skills/weex-fin-admin-ops/scripts/mq-recharge-callback-send.mjs)、业务模块 [skills/weex-fin-admin-ops/scripts/business/mq-recharge/flow.mjs](skills/weex-fin-admin-ops/scripts/business/mq-recharge/flow.mjs)、操作文档 [skills/weex-fin-admin-ops/references/operations/mq-recharge.md](skills/weex-fin-admin-ops/references/operations/mq-recharge.md)，并登记缓存动作 `mq_recharge_callback_send`。本次实测使用 `uid=5139967417`、`amount=1000`，生成 `messageId=79196498362`；验证信号为 Kafka produce API `HTTP 200`、页面出现 `Message successfully sent`、刷新消息列表后可回查该 `messageId`。当前沉淀范围只覆盖“消息成功写入 Kafka topic”，下游业务是否消费成功仍需按具体活动任务另行验证。

- 2026-05-19 已新增前端回归测试文档 [docs/test-cases/lottery-frontend-regression-cases.md](docs/test-cases/lottery-frontend-regression-cases.md)。当前版本 v1 共 78 条前端落地页回归用例，模块拆分为：`页面基础UI`、`抽奖样式UI`、`页面状态UI`、`按钮与交互态`、`单抽主流程`、`五连抽主流程`、`我的奖品/奖励记录`、`异常提示与容错UI`、`二次权重与专项校验`、`响应式与兼容性UI`、`前后端联动展示`。本轮已确认口径：页面入口名为 `我的奖品`，点击后弹窗名为 `奖励记录`；单抽支持全部抽奖样式，五连抽仅支持转盘抽奖样式；五连抽场景下奖励记录按多条结果校验；`累计抽奖次数 N=2` 且必中奖品为 5 时，第 3 次抽奖命中该奖品；库存不足先按“出现库存不足提示弹窗”沉淀。

- 2026-05-18 已按用户最新确认重构 [docs/test-cases/lottery-admin-regression-cases.md](docs/test-cases/lottery-admin-regression-cases.md)。当前版本 v3 共 56 条后管回归用例，模块口径调整为：`活动列表 7`、`报名模版 9`、`任务管理 11`、`奖品管理 11`、`活动配置/活动信息 15`、`上下线/状态流转 3`。本次用户已明确确认：`报名模版` 不再压成旧版 6 条；活动奖池数以当前页面为准为 `8`；`活动复制` bug 已修复，回归预期改为复制成功；`剩余库存数量` 作为展示字段，不作为可编辑输入项。

- 2026-05-18 已新增后管回归测试文档 [docs/test-cases/lottery-admin-regression-cases.md](docs/test-cases/lottery-admin-regression-cases.md)。当前版本按后管口径整理 `转盘抽奖活动` 6 个模块的 42 条核心回归用例：`活动列表`、`报名模板`、`任务管理`、`奖品管理`、`活动配置/活动信息`、`上下线/状态流转`。文档同时标注了 `混合奖励`、`活动复制` 两个已知阻塞项，以及“字符长度限制顺手检查”的共性执行规则，后续可在此基础上继续扩展细化。

- 2026-05-18 已把“每次后管配置测试顺带检查字符长度限制”沉淀到 `weex-admin-ops`。更新点：`skills/weex-admin-ops/SKILL.md` 新增固定工作流规则，要求每次后管配置测试都检查页面可见字符计数/maxlength，并把“创建成功但编辑页出现红字超限”视为需要记录的校验不一致；`references/components.md` 新增通用组件模式；`references/operations/activity-task-create-common.md` 和 `references/selectors/activity-task-management.md` 已补充当前确认的 `活动任务管理 / 转盘抽奖` 文本字段限制：`任务内容 <= 200`、`任务标签 <= 10`、`标签说明 <= 60`。同时已收紧 `scripts/business/activity-task-management/roulette-participant-plan.mjs` 的自动生成默认值，避免继续生成超限 `任务标签`。

- 2026-05-18 已补充“转盘抽奖任务禁止配置 KYC 条件”规则。背景：用户确认 `kyc任务` 会对老用户隐藏，因此不能继续作为抽奖任务默认链路。已更新 `skills/weex-admin-ops/references/operations/activity-task-create-common.md`、`activity-task-roulette-participant-scopes.md`、`activity-task-roulette-reward-modes.md`、`activity-task-roulette-conditions.md`、`references/defaults.md`、`references/selectors/activity-task-management.md`，统一要求 `转盘抽奖` 默认 `任务条件1` 改为非 KYC 分支 `KOL绑定`；如果用户明确要求 `kyc任务`，必须先拦截说明风险，不得直接执行。对应缓存脚本 `scripts/business/activity-task-management/roulette-participant-create.mjs` 也已从“默认选第一项 + 无kyc限制”改为显式选择 `KOL绑定`。

- 2026-05-18 已将“任务参与范围”覆盖任务挂载到草稿活动 ID `9173` 并上线。活动别名 `referraltest0514g-15`，本轮按用户确认把活动时间改为北京时间 `2026-05-18 07:16:14` 至 `2027-05-18 07:16:14`。编辑页真实保存 payload 回查显示活动原有任务 `5068` 1 条；已在同一份 `PUT /prod-api/activity/config` 请求结构上追加 `5056`-`5067` 这 12 条任务后保存，接口返回 `code=200`，详情回查 `taskConfigIds=[5068,5056,5057,5058,5059,5060,5061,5062,5063,5064,5065,5066,5067]`、`taskConfigCount=13`。随后用活动别名走已验证上线链路，`POST /prod-api/activity/lottery/online` 返回 `code=200`；最终详情回查 `status=ONLINE`、`stage=NOT_START`、活动时间与 13 条任务均保留。补充发现：默认 `online-lottery-activity.mjs --activity-id` 在当前页未命中 `活动id` 搜索表单，改用 `--activity-alias referraltest0514g-15` 可稳定上线。

- 2026-05-17 已为“抽奖任务管理 / 转盘抽奖 / 任务参与范围”覆盖批量创建 12 条测试任务，并挂载到活动 ID `9016`、别名 `jonathan-test` 的 `活动任务信息`。新增任务编号 `5056`-`5067`，分别覆盖：`报名的所有用户`、`指定代理`、`指定用户`、`指定国家或地区`、`VIP 等级`、`注册新用户`、`未充值新用户`、`老用户`，以及 4 条组合范围 `报名的所有用户+未充值新用户`、`报名的所有用户+指定代理`、`指定代理+指定用户+指定国家或地区`、`VIP 等级+注册新用户+老用户`。本次创建时沿用了当时的旧默认值 `kyc任务/无kyc限制`；该默认值已在 2026-05-18 被新规则替代，后续不得再作为 `转盘抽奖` 默认配置。其余默认值为：`转盘抽奖`、`单一任务条件`、`不审核KYC`、`报名活动后`、`仅1次，直至结束`、`单一奖励`、最小奖励 `10`、最大不填、每日上限 `5`、总上限 `50`；当前页面首个可用奖励为 `531 - 人人代理测试0512`。`9016` 原有任务为 `4873`、`4874` 共 2 条；编辑页 `活动任务信息` 的下拉和 `+` 在当前状态下为 disabled，直接 UI 追加失败。已通过捕获编辑页真实 `PUT /prod-api/activity/config` 保存 payload，在原有 `taskConfig` 基础上追加 12 条 `{ id, order }` 后同权限提交，接口返回 `code=200`；刷新编辑页后 `活动任务信息` 共显示 14 行，`5056`-`5067` 全部回显成功。

- 2026-05-17 已将 `multica-ai/andrej-karpathy-skills` 的通用执行原则按当前仓库风格内化，不直接引入外部仓内容。项目级规范已在 `AGENTS.md` 新增 `Execution Principles`，统一要求“先明确目标/完成标准/非目标范围、优先最小有效改动、先复用已有 references/helpers/cache、没有可执行验证不算完成、首次失败重试后的稳定路径必须前置并同步 skill 与交接文档”。同时已同步补强 `skills/weex-admin-ops/SKILL.md`、`skills/weex-fin-admin-ops/SKILL.md`、`skills/weex-frontend-ops/SKILL.md`，把这些原则落到各自的 `Operating Workflow` / `Script Organization`。3 个 skill 结构校验均已通过：`node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs`、`node skills/weex-fin-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs`、`node skills/weex-frontend-ops/scripts/maintenance/validate-knowledge-structure.mjs`。

- 2026-05-14 已完成“奖品管理模块币种类型奖励/币对下拉来源接口”只读核查：后台 staging 登录后进入 `https://stg-activity.weex.tech/activity/prize`，打开 `新增 -> 虚拟积分或资格 -> 仓位空投`，抓取到页面初始化请求 `GET /prod-api/activity/productList`（HTTP 200，`code=200`，样例含 `合约Pro:ETC/USDT`、`合约Pro:FIL/USDT`，总条数 `1264`）；该响应与 `交易对` 下拉展示内容一致，判定 `交易对/币对` 下拉数据源为该接口。同期还观察到 `GET /prod-api/asset/adjust/listSystemType`，未见交易对数据。
- 2026-05-13 已按“新账号、浏览器模式、报名并完成 9101 任务后执行抽奖分支”完成实操：新账号 `codexapi1778688037137@weex.com` / UID `9500733879` 注册成功并进入活动 `9101`（`zp0513171053`）；充值任务通过 Kafka 回调完成，回查 `taskId=4991` 为 `COMPLETED`，`netRechargeAmount=200`，`totalRechargeAmount=200`。抽奖次数回查 `doTaskGetCount=1000`（`>5`），按规则先点击 `抽奖 × 5`，等待奖励弹窗后点击 `确认` 关闭；再点击 `抽奖 × 1`，等待弹窗并关闭。过程中发现按钮文案并非 `抽5次/抽1次`，而是 `抽奖 × 5/1`，已补充到前端失败复盘 `skills/weex-frontend-ops/failure-reviews/draw-kafka.md`。
- 2026-05-14 已在无头真实 UI 模式创建并上线新的转盘抽奖活动 ID `9107`，标题 `自动化测试抽奖活动`，副标题 `多语任务奖品`，别名 `jonathan-test-20260514051431`，活动时间 `2026-05-14 13:24:31` 至 `2027-05-14 13:14:31`，`是否支持预报名=不支持`。创建阶段通过 `skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs --headless-ui` 完成，`POST /prod-api/activity/config` 返回 `code=200`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 返回 `code=200`；详情回查 `status=ONLINE`、`stage=NOT_START`、`taskConfigIds=[4996,4997,4998]`、`activityConfigI18n` 为中英 2 条。奖品配置验证还补充了一个稳定规则：转盘新增页 `抽奖奖品配置 / 奖品名称` 下拉展示的是 `奖品别名`，脚本匹配时必须按 alias，如 `auto_bonus_100_20260514`，不能按中文奖品名称匹配。相关更新已写入 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`、`skills/weex-admin-ops/references/action-cache.md` 和 `skills/weex-admin-ops/scripts/action-cache.json`。
- 2026-05-13 已按“复制失败则重新创建、开赛时间 5 分钟后、活动名称/标题/副标题不超过 15 个字符”重新创建并上线转盘抽奖活动 ID `9095`。标题 `飞镖合约抽奖`（6 字符）、副标题 `5分后开赛`（5 字符），别名 `lottery-dart-5min-20260513112327`，抽奖样式 `飞镖转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间最终刷新为 `2026-05-13 19:32:10` 至 `2026-05-20 19:27:10`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`；上线前模型级刷新 `baseForm.form.startTime/endTime` 后 `PUT /prod-api/activity/config` 返回 `code=200`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 返回 `code=200`；详情回查 `status=ONLINE`、`stage=NOT_START`、`taskConfigIds=[4873]`。已把标题/副标题长度硬性规则写入 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`。
- 2026-05-13 已修复并上线转盘抽奖活动 ID `9093`：标题 `4分钟开赛飞镖合约转盘20260513110241`，别名 `lottery-4min-dart-contract-20260513110241`，抽奖样式 `飞镖转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间更新为 `2026-05-13 19:45:51` 至 `2026-05-20 19:15:51`。详情回查 `status=ONLINE`、`stage=NOT_START`、`taskConfigIds=[4873]`，任务为 `自动化测试-转盘-合约100-奖次1000-20260507`，`taskType=TRADING_VOLUME`，`requiredVolume=100`。本轮失败点：活动任务下拉选择后未落行、排序系数未填导致 `activityTaskForm=false`；编辑页只改可见日期输入未同步 `baseForm.form.startTime/endTime`，保存接口仍提交旧时间；按模型和可见输入同时更新后，`PUT /prod-api/activity/config` 与 `POST /prod-api/activity/lottery/online` 均返回 `code=200`。修复已写入 `skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs` 和后台复盘。
- 2026-05-13 已按用户纠正将 9046 转盘合约任务默认交易标的改为 BTC-USDT，要求新账号、浏览器模式、页面下单/页面平仓，不再使用 OpenAPI 下单。新前端账号 `codexapi17786669465371@weex.com` / UID `8377200673` FIN 发放审核 1100 USDT 成功但前端划转返回 `70008/20105`，未到账；新系统/API账号 `3447598495@weex.com` / UID `3447598495` FIN 发放审核 1100 USDT 成功，前端划转返回 `70011 划转处理中`，但 BTC 合约页仍显示 `可用 0.0000`、`保证金余额 0.0000 USDT`，因此未执行页面下单。旧账号 `7479616356@weex.com` 回查 9046 已完成 `taskId=4882`、`tradingVolume=1689.1317324`、`doTaskGetCount=1`，但不能作为本次新账号成功证据。复盘见 `skills/weex-frontend-ops/failure-reviews/draw-contract.md` 和 `skills/weex-fin-admin-ops/failure-reviews/common.md`。
- 2026-05-12 已按“重来 / 浏览器模式”重新创建并上线 6 分钟后开赛的转盘抽奖活动：活动 ID `9087`，标题 `6分钟开赛合约转盘20260512174523`，别名 `lottery-6min-contract-20260512174523`，抽奖样式 `圆形转盘`，`是否支持预报名=不支持`，后台 UTC+8 活动时间 `2026-05-13 01:51:23` 至 `2026-05-20 01:51:23`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`，详情回查 `showBeginnerTaskConfig` 包含 `{ taskType: "TRADING_VOLUME", sorted: 2 }`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 返回 `code=200`，最终列表回查 `status=ONLINE`、`stage=NOT_START`。首次强制选择长任务名 `自动化测试-转盘-合约100-奖次1000-20260507` 时 `activityTaskForm=false` 未创建，重跑改用页面可用转盘任务并显式开启 `新手活动合约任务` 成功；失败复盘已写入 `skills/weex-admin-ops/failure-reviews/activity-management.md`。
- 2026-05-12 已按“浏览器模式 + 报名后交易才生效”在新活动 ID `9084`（alias `signup-trade-draw-20260512163959`）复现成功链路。账号 `7670579106@weex.com` / UID `7670579106` 在活动页点击 `立即报名` 后，网关请求 `apply` 返回 `code=00000`，`applyStatus=true`。随后用同账号 API 凭证下 ETHUSDT 市价多单（orderId `749122929354080954`），进入真实前端合约页 `https://stg-www.weex.tech/zh-CN/futures/ETH-USDT` 点击 `一键平仓` 并确认，仓位从 `仓位(1)` 变为 `仓位(0)`。回活动页刷新后，`/v1/activity/general/taskCompletions` 返回 `taskId=4882`、`status=COMPLETED`、`tradingCount=1`、`tradingVolume=3393.84`；`/v1/activity/general/raffle/frequency` 返回 `doTaskGetCount=1`。本次再次确认：该类任务必须先报名，且以活动任务接口回查为准，UI 文案可有延迟。
- 2026-05-12 已将上述链路沉淀到前端 skill：新增组合脚本 `skills/weex-frontend-ops/scripts/frontend-draw-signup-trade-close-verify.mjs`，动作缓存 `skills/weex-frontend-ops/scripts/action-cache.json` action `frontend_draw_signup_trade_close_verify`，并更新 `skills/weex-frontend-ops/references/operations/draw.md`、`skills/weex-frontend-ops/references/operations/index.md`、`skills/weex-frontend-ops/references/action-cache.md`。该动作支持 `--dry-run`、`--confirm-run`、`--visible`、`--task-id`，默认顺序固定为“先报名 -> API 开仓 -> futures 一键平仓 -> taskCompletions 回查”。
- 2026-05-12 已跑通活动 ID `9046` 足球射门转盘活动合约任务恢复链路：新建 API 账号 `9207496838@weex.com` / UID `9207496838` / 合约账号 ID `748964672547324474`，FIN 发放并审核 1100 USDT，前端现货到合约划转返回 `00000 success`。先用合约 Open API 下 ETHUSDT 多单，订单 `748965118397645370` 成交额 `1004.547478 USDT`，活动页仍未计入；随后在真实前端合约页处理持仓/订单新手引导，点击 `一键平仓` 并确认，`closeAllPosition` 返回 `SUCCESS`，平仓订单 `748968366269530682` 成交额 `1001.731270 USDT`。活动页刷新后显示 `可用次数：1`、累计 `1,001.73`，`taskCompletions` 返回 `status=COMPLETED`、`tradingVolume=1001.73127000000000`。失败/恢复复盘已写入 `skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-12 已完成“创建带 API 账号并下 10u ETH 多单”：FIN Admin 创建系统/API账号 `1752792315@weex.com` / UID `1752792315` / 合约账号 ID `748959187416908410`；生成的 API 密钥只保存在本机忽略目录 `generated/fin-system-accounts/fin-system-accounts-api-1-20260512T060305.*`。新账号初始合约余额为 0，先通过 FIN `空投奖励(产品化活动)` 给 UID `1752792315` 发放并审核 20 USDT，随后用该账号前端登录态执行现货到账户类型 `8` 合约账户划转，`/v1/assets/transfer` 返回 `00000 success`。用合约 Open API 按 ETHUSDT 最新价约 `2311.026875` 折算下单数量 `0.0043 ETH`，`POST /capi/v3/order` 返回成功，订单 ID `748959975606321786`。下单后余额回查：`balance=19.99661646`、`availableBalance=19.50004171`、`unrealizePnl=0.004558`。
- 该链路已沉淀为 FIN Admin 组合脚本 `skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs`，playbook `skills/weex-fin-admin-ops/references/operations/api-account-contract-order.md`，动作缓存 `create_api_account_fund_contract_order`。后续同类“创建带 API 账号并下合约单”请求应优先运行该脚本 dry-run，再按用户明确请求传入确认开关执行；短句 `创建个带api账号 下个10u eth多单` 已能命中该动作，脚本默认 `userType/remark=codex_api_order`。
- 2026-05-12 已通过用户可见 CDP 操作完整捕获 FIN Admin `系统账户管理` 创建带 API 账号链路：`POST /api/admin/fin/asset/system/account/add` -> 轮询 `add_progress` -> `temporary/list` 取回 UID、邮箱、合约账号 ID 与 API 三件套。已沉淀脚本 `skills/weex-fin-admin-ops/scripts/system-account-create.mjs` 和 playbook `skills/weex-fin-admin-ops/references/operations/system-account.md`；脚本复现创建 1 个 STG API 账号 `4163385380@weex.com` / UID `4163385380` / 合约账号 ID `748958173183869082`，并用生成的 API 三件套验证 `stg-api-contract` 私有余额接口 HTTP 200。含密钥结果只保存到本机忽略目录 `generated/fin-system-accounts/`，不写入 docs 或 skill。
- 2026-05-12 继续排查活动 `9046` 合约交易页链路：用户指出本地普通 Chrome 能正常加载订单簿并下单，Agent 之前使用 Playwright 隔离 profile 导致订单簿 WS/可开数量状态不完整。改用 CDP 后发现当前可连接的 9222 调试 Chrome 仍不是用户普通交易页 profile；连接该 profile 打开 `/zh-CN/futures/BTC-USDT` 可见余额但订单簿/可开数量仍不可用，未执行真实下单。已把“必须连接用户实际可用 CDP profile，不能用其他 9222 profile 替代”记录到 `skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-12 已按“前端流程 / 活动 ID 9046 / 浏览器模式”探索足球射门转盘活动合约交易任务：活动后台只读回查 `9046` 为 `ONLINE / IN_PROGRESS`，别名 `frontend-draw-football-20260511093107`，任务为合约交易量 `>=1000 USDT`，`taskUrlWeb=null`。新建并充值合约账号 `codexapi17785621110411@weex.com` / UID `5845940922`，FIN 1000 USDT 发放审核成功，前端现货到合约划转第 2 次返回 `00000 success`。可见 Chrome 打开活动页后登录态正常，页面无 `立即报名`（`isPreApply=0`），任务区显示累计 0；点击 `去交易` 未跳转，改用 `/zh-CN/futures/BTC-USDT`。合约页可见保证金余额 1000 USDT，但市价下单输入 `5000` 默认按 BTC 超出最大可开；切换数量单位到 USDT 后页面显示 `数量 ≈ Infinity`、`可开 0.0000 USDT`，点击 `买入开多` 仍被 `委托数量大于最大可开仓数量` 拦截，未发出下单接口；回活动页 `/v1/activity/general/taskCompletions` 返回 `completions: []`。阻塞已记录到 `skills/weex-frontend-ops/failure-reviews/common.md`，暂不沉淀固定流程。
- 2026-05-12 已完成“重新配置上线一个 10mins 后开始的转盘抽奖活动”：活动后台 staging 创建并上线活动 ID `9049`，标题 `10分钟后转盘抽奖20260512034826`，别名 `lottery-10min-20260512034826`，抽奖样式 `圆形转盘`，`是否支持预报名=不支持`，后台业务时区活动时间 `2026-05-12 11:58:22` 至 `2026-05-19 11:58:22`。创建接口 `POST /prod-api/activity/config` 返回 `code=200`，上线接口 `POST /prod-api/activity/lottery/online` 返回 `code=200`，最终列表回查 `status=ONLINE`、`stage=NOT_START`。首次按本地 CEST 近未来时间提交被后端判定 `开始时间不可小于现在时间`，已把“近未来时间按后台 UTC+8 业务时区计算、无预报名分支不填预报名时间”记录到 `skills/weex-admin-ops/references/operations/activity-management-lottery.md` 和 `skills/weex-admin-ops/failure-reviews/activity-management.md`。
- 2026-05-11 已把转盘抽奖活动创建链路中的 `用户报名模版` 固定默认值沉淀到 `weex-admin-ops`：后续配置 `活动列表 / 转盘抽奖` 时，`用户报名模版` 默认固定选择 `2729` `【2729】 自动化报名模板_auto_manual_20260505161031`，不再按“第一个兼容模板”处理。已同步到脚本 `skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、计划文件 `skills/weex-admin-ops/scripts/business/activity-management/lottery-draft-plan.mjs`、操作文档 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`、关系和 defaults 文档。
- 2026-05-11 已完成“创建 3 个账号，合约划进去 213u”：`codexapi17785033381951@weex.com` / UID `3794362461`、`codexapi17785033381952@weex.com` / UID `9044888775`、`codexapi17785033381953@weex.com` / UID `2775257930` 已创建成功；3 笔 FIN `空投奖励(产品化活动)` 213 USDT 发放审核均成功。组合脚本首轮把前端子进程 warning 误记为 transfer 失败，随后按固定恢复思路只对 3 个账号单独补执行前端现货到合约划转，3/3 最终均返回 `00000 success`。复盘已写入 `skills/weex-fin-admin-ops/failure-reviews/common.md`。
- 2026-05-11 已按“重来 浏览器模式”重跑圆形转盘前端链路，账号 `codexapi1778492089526@weex.com` / UID `7901867346`，活动 `frontend-draw-round-20260511085251`，可见 Chrome desktop `1440x1000`。活动页登录态和展示正常；点击 `立即报名` 被资格弹窗拦截：`您无法参加该活动，请关注平台其他活动`。关闭弹窗后任务仍显示 `合约交易 新用户冒烟1000 去交易 累计 0 合约交易量 ≥1,000 USDT × 1`。正确合约交易入口确认为 `https://stg-www.weex.tech/zh-CN/futures/BTC-USDT`，旧猜测 `/zh-CN/futures/usdt/BTCUSDT` 返回 404。合约页可见 1,000 USDT 保证金余额；已切换 `市价`、数量输入 `5000`、点击 `买入开多`，页面提示 `交易买入量不可小于最小买入量`，回活动页任务进度仍为累计 0。阻塞已记录到 `skills/weex-frontend-ops/failure-reviews/common.md`，本次探索暂未沉淀固定流程。
- 2026-05-11 已完成“前端转盘抽奖 5 种抽奖样式展示验证”：创建前端账号 `codexapi1778492089526@weex.com` / UID `7901867346`；活动后台创建并上线 5 个转盘抽奖活动，样式分别为圆形转盘、飞镖转盘、彩蛋、环形跑马灯、足球射门，最终均为 `ONLINE`、`stage=NOT_START`。前端验证使用 desktop `1440x1000`，先注入该账号登录态再访问 `https://stg-www.weex.tech/zh-CN/events/draw/<alias>`；5 个页面均命中活动标题、无登录表单、token cookie 存在、无失败响应。已将“创建一个 -> 上线一个 -> 注入登录态验证一个”、彩蛋 `彩蛋类型` 必填、上线前活动时间校验等沉淀到 `skills/weex-admin-ops/references/operations/activity-management-lottery.md`、`skills/weex-frontend-ops/references/operations/draw.md` 和对应失败复盘。
- 2026-05-11 已完成“创建10个账号 划转20u合约”：10 个 STG 账号创建成功，10 笔 FIN 20 USDT 发放审核验证成功，10 次前端现货到合约划转最终均返回 `00000 success`。本次按默认并发 10 执行；其中 1 个账号首次划转返回 `70008`，组合脚本内置重试第 2 次成功，未重复创建账号或重复 FIN 发放。
- 2026-05-11 已完成“创建12个账号 合约划转10u”：12 个 STG 账号创建成功，12 笔 FIN 10 USDT 发放审核验证成功；初次前端划转 7/12 成功、5/12 返回 `70008`，随后只重试失败账号划转，最终 12/12 返回 `00000 success`。已把合约充值组合脚本更新为对前端划转 `70008`/`20105` 默认延迟重试 2 次，不重复创建账号或重复 FIN 发放。
- 2026-05-11 已完成“创建30个账号 然后合约划转进去20u”：STG 30 个邮箱账号均创建成功并回查 UID，30 笔 FIN 20 USDT 发放审核通过，30 次前端现货到合约划转均返回 `00000 success`。高并发首跑出现注册后页面 DNS 失败、FIN `fetch failed` 和初次 `70008`，已按“回查 UID -> 顺序补发 -> 顺序划转”恢复，并记录到 `skills/weex-fin-admin-ops/failure-reviews/common.md`、`skills/weex-frontend-ops/failure-reviews/common.md`。
- 2026-05-11 已完成“创建10个账号 每个账号给合约充10u”：10 个 STG 账号创建成功，10 笔 FIN 10 USDT 发放审核验证成功；初次前端划转 2/10 成功、8/10 返回 `70008`，随后只重试失败账号划转，最终 10/10 返回 `00000 success`。本次初始执行误传 `--concurrency 1`，已按用户纠正更新 FIN 复盘、组合链路和 action-cache：后续初始执行默认并发，只有用户明确要求或失败恢复阶段才顺序处理。
- 已修复合约充值/批量充值脚本的 FIN 子进程可见登录恢复问题：父流程只做一次 FIN 登录态准备，子进程设置 `WEEX_FIN_DISABLE_VISIBLE_RECOVERY=true`，避免登录态有效时中途打开 Chrome 窗口。
- 已内置前端 `loginTool` 最小运行时到 `skills/weex-frontend-ops/vendor/loginTool/`，不再依赖 `/Users/gabriel/Downloads/weexpr/loginTool`。
- 已新增根 `package.json` / `package-lock.json`，前端和后管缺少 `playwright` 时默认自动执行 `npm install --no-audit --no-fund`，可用 `WEEX_AUTO_INSTALL_DEPS=false` 禁用。
- 已修复 FIN 登录态未就绪时的处理：FIN 发放、批量充值、合约充值脚本现在自动打开持久 CDP FIN 登录页，等待用户登录并关闭页面后复验，再继续流程。
- 已新增首次启动检查 `tools/first-run-check.mjs`，检查项目依赖、skill-local `.env.local` 必需项和 FIN 登录态。
- 已新增对话配置工具 `tools/configure-skill-env.mjs`，支持把用户在对话中提供的缺失值写入对应 skill 的 `.env.local`，输出不回显真实值。
- 已更新 `AGENTS.md`：首次对话必须先检查依赖/配置；缺失时必须说明缺失项、放置路径、文件配置方式、对话配置方式和脚本配置方式。
- 已归档本轮运行时自包含改造：`docs/session-handoffs/2026-05-11-runtime-self-contained.md`。

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
