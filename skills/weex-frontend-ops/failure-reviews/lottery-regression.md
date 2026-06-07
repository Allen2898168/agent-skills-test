# 抽奖回归失败复盘（前端）

## 二次权重专项新建活动复制旧模板导致第 6 次未命中奖品 5

- 日期：2026-05-30
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 二次权重专项 --start-offset-seconds 3 --wait-for-start-ms 60000`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`
- 失败表现：
  - 首轮活动 `9718 / w13029373` 报告 `FE-65/66/67 PASS`，但 `FE-64 FAIL`。
  - 6 次单抽均成功、中奖弹窗均出现、最终次数 `110 -> 104`，但第 6 次弹窗为 `1 USDT 合约赠金`，不是预期 `100 USDT 合约赠金`。
- 失败原因：
  - 标准准备入口仍使用旧二次权重模板 `lw25121831`，该模板 `prizeWeight` 为 8 行均匀 `12.5`，且奖品 5 不是 `100 USDT 合约赠金`。
  - `create-online-lottery-activities-batch-fast-api.mjs` 只对 stock 分区做确定性权重处理，未对 weight 分区强制写入“累计 5 次、同用户、奖品 5 权重 100、其余 0”。
- 解决方式：
  - 新增 `applyDeterministicCumulativePrizeWeight`，weight 分区创建时固定写入奖品 5 权重 `100`、其余 `0`。
  - 标准 `run-full-headless` 的 weight 模板改为已验证模板 `wt43083858`。
- 验证结果：
  - 已清理失败活动 `9718 / w13029373`。
  - 复跑活动 `9719 / w13402457` 通过：`FE-64/65/66/67` 全 PASS；次数 `10 -> 4`；第 6 次弹窗 `100 USDT 合约赠金`；奖励记录最新文案包含 `100 USDT 合约赠金`。
  - 活动 `9719 / w13402457` 已下线并删除，别名搜索无残留。
- 后续处理：解决方式已吸收到固定活动准备脚本和 `run-full-headless` 默认模板。

## 五连抽真实成功但脚本误判接口与奖励记录失败

- 日期：2026-05-30
- 触发入口：`orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs --case-ids FE-25,FE-29,FE-40,FE-41,FE-42,FE-43,FE-44,FE-47`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`
- 失败表现：
  - 首轮活动 `9710 / lf05342110` 五连抽已出现中奖弹窗，次数 `110 -> 105`，但 `FE-40/FE-43/FE-44` 被判定 FAIL。
  - 证据中 `requestObserved=true`、`popupVisible=true`、`popupRewardCount=6`，但 `requestSent=false`、`apiSuccess=false`，奖励记录未打开。
- 失败原因：
  - 脚本只捕获 legacy `/v1/activity/general/raffle/luckDraw` 响应，五连抽实际成功响应可能落在其他非 frequency 的 raffle draw 接口。
  - 中奖弹窗关闭只按 Escape，后续点击 `我的奖品` 容易被弹窗遮挡。
- 解决方式：
  - `lottery-frontend-main-flow.mjs` 增加非 frequency `/v1/activity/general/raffle/*` draw 响应捕获。
  - `lottery-frontend-main-flow-helpers.mjs` 增加中奖弹窗关闭 helper，优先点可见关闭/确认控件，再打开奖励记录。
- 验证结果：
  - 重跑活动 `9711 / lf05746869` 通过：`FE-25/FE-29/FE-40/FE-41/FE-42/FE-43/FE-44/FE-47` 全 PASS；五连抽接口 `code=00000`，次数 `110 -> 105`，奖励记录字段 `活动名称/奖励金额/获奖时间/备注` 均捕获。
  - 两轮测试活动 `9710 / lf05342110`、`9711 / lf05746869` 均已下线并删除，别名搜索无残留。
- 后续处理：解决方式已吸收到固定脚本与 `references/operations/draw-five.md`。

## 小库存五连抽返回“所剩不多”但旧断言未识别

- 日期：2026-05-30
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 小库存专项 --start-offset-seconds 3 --wait-for-start-ms 60000`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`
- 失败表现：
  - 活动 `9712 / s06872444` 已触发小库存五连抽限制，接口返回 `51031 / 当日奖品所剩不多，请尝试单次抽奖。`，次数 `110 -> 110` 未扣减。
  - `FE-45/FE-46` PASS，但 `FE-23/FE-57` FAIL。
- 失败原因：
  - 小库存提示断言只匹配 `库存/不足/抢光`，未包含真实接口文案中的 `所剩不多/尝试单次抽奖`。
- 解决方式：
  - 小库存提示匹配增加 `所剩不多/奖品所剩不多/尝试单次抽奖`。
  - 按业务口径将 `FE-23` 改为五连抽库存不足固定断言：接口码 `51031`、文案 `当日奖品所剩不多，请尝试单次抽奖。`、次数不扣减。
  - 新增 `FE-85`：小库存单抽首次成功后再次提示库存不足，且必须在小库存活动发生任何成功抽奖前执行。
  - 按业务口径调整执行顺序：先跑五连抽库存不足 `FE-23/45/46/57`，确认 `110 -> 110` 不扣减；再跑单抽小库存 `FE-85`，因为前序五连抽不会成功抽奖，仍保留 1 个库存。
- 验证结果：
  - 单测已覆盖 `FE-85` 和小库存五连抽文案匹配；真实复跑被用户中断，尚未完成新版真实无头复验。
- 后续处理：解决方式已吸收到固定脚本与 `references/operations/draw-low-stock.md`；下次真实执行需新建 stock 活动，先跑 `FE-23/45/46/57` 再跑 `FE-85`。

## 小库存单抽第二次返回奖品抽完而非五连抽库存码

- 日期：2026-05-30
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 小库存专项 --start-offset-seconds 3 --wait-for-start-ms 60000`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`
- 失败表现：
  - 活动 `9713 / s08022680` 中 `FE-23/45/46/57` 五连抽库存不足均 PASS，接口 `51031 / 当日奖品所剩不多，请尝试单次抽奖。`，次数 `110 -> 110`。
  - `FE-85` 第一次单抽成功，次数 `110 -> 109`；第二次单抽失败，接口返回 `51020 / 今日奖品已被抽完，请明天再来！`，次数 `109 -> 109`，但脚本按 `51031` 判 FAIL。
- 失败原因：
  - 五连抽库存不足和单抽奖品抽完是两个不同后端业务码；`51031` 是五连抽不足固定断言，不应复用到 `FE-85`。
- 解决方式：
  - `FE-23` 继续严格断言 `51031 / 当日奖品所剩不多，请尝试单次抽奖。` 和次数不扣。
  - `FE-85` 改为断言第二次单抽失败、提示属于库存不足/奖品抽完类文案、次数不扣，不绑定固定业务码。
- 验证结果：
  - 已新增失败单测复现 `51020 / 今日奖品已被抽完，请明天再来！`，修复后单测通过。
  - 活动 `9715 / s08786837` 使用确定性 stock 权重后真实复跑通过：`FE-23/45/46/57/85` 全 PASS。
- 后续处理：解决方式已吸收到 stock 活动准备脚本和 `references/operations/draw-low-stock.md`；旧活动 `9712 / s06872444`、失败活动 `9713 / s08022680`、`9714 / s08401140` 与通过活动 `9715 / s08786837` 均已清理。

## 小库存单抽模板多奖品库存导致第二次仍成功

- 日期：2026-05-30
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 小库存专项 --start-offset-seconds 3 --wait-for-start-ms 60000`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`
- 失败表现：
  - 活动 `9714 / s08401140` 中 `FE-23/45/46/57` PASS。
  - `FE-85` 第一次单抽成功，次数 `110 -> 109`；第二次单抽也成功，次数 `109 -> 108`，未触发库存不足。
- 失败原因：
  - 小库存模板 8 个奖品均为库存 `1`，权重均为 `12.5`；第一次抽完一个奖品后，第二次仍可能命中另一个有库存奖品。
- 解决方式：
  - stock 活动准备阶段对奖品权重做确定性处理：奖品 1 权重 `100`，其余 7 个奖品权重 `0`，库存仍保持 `1`。
  - 五连抽因可命中库存只有 1 个仍返回 `51031`；单抽第一次命中奖品 1，第二次稳定返回奖品抽完类提示。
- 验证结果：
  - 新增 `applySinglePrizeStockWeights` 单测通过。
  - 活动 `9715 / s08786837` 真实复跑通过：五连抽 `110 -> 110`，单抽 `110 -> 109 -> 109`。
- 后续处理：解决方式已固定到 `create-online-lottery-activities-batch-fast-api.mjs`，后续 `--selection 小库存专项` 自动使用确定性 stock 活动；相关测试活动均已清理无残留。

## `logFlowProgress is not defined` 导致报名/充值阶段全链路阻塞

- 日期：2026-05-26
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 全部`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop（默认）
- 失败表现：
  - 前端回归阶段 `frontend_signup_flow` / `frontend_recharge_prepare` 报错：`logFlowProgress is not defined`
  - FAIL 用例：`FE-81`、`FE-82`、`FE-83`（报名链路），`FE-22`（次数>0 展示）
  - 后续用例大量被 `blocked by frontend_signup_flow` / `blocked by frontend_recharge_prepare` 标记为 `SKIPPED`
- 失败原因：
  - `skills/weex-frontend-ops/scripts/lib/lottery-frontend-main-flow-helpers.mjs` 内部调用 `logFlowProgress(...)`，但该函数未在模块内定义，也未从外部导入，触发 `ReferenceError`。
- 解决方式：
  - 在 `skills/weex-frontend-ops/scripts/lib/lottery-frontend-main-flow-helpers.mjs` 增加本地 `logFlowProgress(phase, message)`，统一写入 `stderr`，避免流程被日志函数缺失中断。
- 验证结果：
  - 已修复代码（待用户确认后重跑失败 selection 验证恢复）。
- 关联报告：
  - `orchestrations/lottery-regression/artifacts/reports/20260526_170823/summary.json`

## `repoRoot is not defined` 导致“奖励记录”阶段脚本异常（FE-36/37/48/49/50/55/56）

- 日期：2026-05-26
- 触发入口：`orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection 全部`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop（默认）
- 失败表现：
  - 前端回归阶段 `frontend_reward_record` 报错：`repoRoot is not defined`
  - FAIL 用例：`FE-36`、`FE-37`、`FE-48`、`FE-49`、`FE-50`、`FE-55`、`FE-56`
- 失败原因：
  - “奖励记录”阶段使用了未定义变量 `repoRoot`，导致阶段内断言与后续检查无法执行。
- 解决方式：
  - 在触发脚本内补齐 `repoRoot` 的定义（与其他阶段一致从 `import.meta.url` 反推 repo root），或移除对 `repoRoot` 的依赖并改用明确的 `reportRoot`/`artifacts` 路径。
- 验证结果：
  - 本次仅记录失败与汇总，未自动修复/重跑。
- 关联报告：
  - `orchestrations/lottery-regression/artifacts/reports/20260526_172109/summary.json`

## 剩余前端 UI 专项真实执行暴露登录态、异常断言与奖励记录解析问题

- 日期：2026-05-30
- 触发入口：
  - `orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "抽奖样式展示,异常提示,奖励记录,响应式" --start-offset-seconds 3 --wait-for-start-ms 60000`
  - 复跑活动：`9721 / n16120468`
- 环境/viewport：STG，隐藏 Playwright Chrome，desktop `1440x1000`；响应式阶段覆盖 `390x844`、`360x640`、`390x568`。
- 失败表现：
  - 首轮全量入口创建活动成功，但多阶段因 `fetch failed url=https://stg-gateway.weex.tech/v1/user/login/new` 失败，后续用例阻塞。
  - 复跑后 `frontend_exception_ui` 因预期文案 `系统繁忙，请稍后再试！` 被 `detectPageError` 识别为页面异常，导致 `FE-63` 误失败。
  - `frontend_reward_record` 再次出现 `repoRoot is not defined`，本次根因在 helper `readOptionalJsonFile` 内错误引用未传入变量。
  - 奖励记录弹窗点击偶发无内容，且原解析会取到页面顶部中奖广播，导致 `FE-56` 弹窗奖品与奖励记录一致性误判。
- 失败原因：
  - STG 登录接口存在瞬时失败或 cookie 注入后短暂 401，需复跑或重建登录态。
  - 异常注入阶段把业务失败提示当成页面崩溃信号。
  - helper 缺少 `node:fs` import，读取 draw payload 失败时被 catch 掉，导致期望奖品为空。
  - 奖励记录弹窗打开和数据回写存在延迟；记录列表排序不保证刚抽中的奖品一定是第一行。
- 解决方式：
  - 异常阶段 pageAlive 改为检查活动/抽奖主结构仍存在，不再把预期失败文案作为崩溃。
  - `readOptionalJsonFile(filePath, repoRootPath)` 显式接收 repo root，并补 `node:fs` import。
  - `openRewardRecord` 增加最多 3 次点击/等待，弹窗识别同时看字段表头。
  - 奖励记录解析限定在字段表头后的表格内容，排除顶部中奖广播；`FE-56` 改为断言记录列表包含本次弹窗奖品，不要求第一行严格匹配。
- 验证结果：
  - 真实活动 `9721 / n16120468`：`frontend_style_display`、`frontend_exception_ui`、`frontend_reward_record`、`frontend_reward_record_extended`、`frontend_responsive_ui` 均真实跑通。
  - `FE-56` 单独复跑通过；弹窗奖品 `自动化测试 - 实物_20260522070743`，奖励记录列表包含同名奖品。
  - 相关语法检查与 `lottery-frontend-main-regression.test.mjs` 通过。
  - 活动已先下线再删除，别名搜索无残留。
- 后续处理：解决方式已吸收到固定脚本；后续同类执行如复用已报名活动，前置报名/MQ 用例可能按设计 `SKIPPED`，目标 UI 用例仍按实际 phase 结果判断。

## 2026-05-31 全量回归中前后端联动与响应式断言失败

- 日期：2026-05-31
- 触发入口：`node skills/weex-admin-ops/scripts/regress-full-test-cases.mjs --confirm-run`
- 环境/viewport：STG，隐藏 Playwright；前端主回归 activityAlias=`n53882896`
- 失败表现：
  - 全量结果 `PASS 141 / FAIL 6 / SKIPPED 10 / TOTAL 285`；失败均来自 lottery 文档用例。
  - 失败用例：`FE-56`、`FE-68`、`FE-69`、`FE-73`、`FE-75`、`FE-76`。
  - `FE-73`：联动标题断言中 `titleMatched=true`，但 `subtitleMatched=false`（期望副标题为空，页面实际有副标题）。
  - `FE-75/FE-76`：只读联动阶段 `languageSwitch.switched=false`、`faq.found=false`，语言切换与 FAQ 展示未命中。
  - `FE-56`：弹窗奖品与奖励记录对比不一致，记录最新命中 `0.1 ETH`，期望来自本次弹窗奖品文本。
  - `FE-68/FE-69`：响应式断言 `h5Opened=false`、`mobileWidthsOk=false`。
- 失败原因：
  - 前后端联动断言对“副标题是否必须为空”的口径与当前活动配置不一致。
  - 多语言和 FAQ 的前端页面结构/可见性与现有只读检查逻辑存在偏差。
  - 奖励记录一致性断言仍受列表排序和历史记录干扰。
  - H5/移动端断言链路未稳定识别当前页面状态。
- 解决方式：
  - 先按失败 evidence 复跑四个 phase：`frontend_backend_linkage`、`frontend_backend_linkage_readonly`、`frontend_reward_record`、`frontend_responsive_ui`，逐项校准断言口径和页面定位。
  - 对 `FE-56` 增加“按本次抽奖时间窗口/活动名过滤记录”或“弹窗奖品与记录集合匹配”的稳定规则，避免被历史记录首行污染。
  - 对 `FE-68/69` 增加可复用 viewport 断言 helper，拆分“页面可打开”与“布局合规”两个信号，避免单一布尔值误判。
- 验证结果：
  - 本次仅完成失败定位和证据采集，未在本轮修复断言后重跑。
- 关联报告：
  - `result/full-regression/20260531_205800/summary.json`
  - `result/full-regression/20260531_205800/frontend_normal.json`
  - `orchestrations/lottery-regression/artifacts/reports/20260531_205800/`

## 2026-06-07 全量回归复跑仍命中 5 个前端主链路失败

- 日期：2026-06-07
- 触发入口：`node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '全部' --confirm-run`
- 环境/viewport：STG，隐藏 Playwright；主前端活动 `10049 / n52012169`；responsive phase 覆盖 `390x844`、`360x640`、`390x568`。
- 失败表现：
  - 全量结果 `PASS 141 / FAIL 6 / SKIPPED 10 / TOTAL 285`；lottery 文档用例失败收敛到 `FE-56/68/69/73/75`，`FE-76` 本轮已恢复通过。
  - `FE-73`：后管联动改标题后，`titleMatched=true`，但 `subtitleMatched=false`；前端 URL 为 `https://stg-www.weex.tech/zh-CN/events/draw/n52012169?__cacheBust=1780852317030_1`。
  - `FE-75`：语言切换预期英文页 `https://stg-www.weex.tech/events/draw/n52012169`，实际最终仍回到中文页，`enHtmlLang=zh-CN`、`languageSwitch.switched=false`；FAQ 与活动日历已找到，`FE-76/77/78` 通过。
  - `FE-56`：弹窗期望奖品 `1 USDT 合约赠金`，奖励记录最新命中 `自动化测试 - 实物_20260522070743 × 1`，`prizeMatchesPopup=false`。
  - `FE-68/69`：responsive phase 三个 viewport 都出现 `opened=false`，但 `buttonVisible=true`、`horizontalOverflow=false`、`mobileDialogWithinViewport=true`，说明更像“打开态识别失败”而非纯布局崩坏。
- 失败原因：
  - `FE-73/75` 仍是联动断言口径与当前页面表现不一致：副标题清空未被接受，语言切换后 locale 保持在中文路由。
  - `FE-56` 仍受历史奖励记录排序/过滤口径影响，未稳定关联到本次抽奖结果。
  - `FE-68/69` 的 viewport 检测仍未稳定识别移动端打开态。
- 验证结果：
  - `frontend_stock.json` 与 `frontend_weight.json` 均 PASS，说明 stock/weight 专项已经稳定；问题集中在 `frontend_normal.json`。
  - 关联报告：`result/full-regression/20260607_190648/summary.json`、`orchestrations/lottery-regression/artifacts/reports/20260607_190649/frontend_normal.json`。
- 后续处理：优先按 `frontend_backend_linkage`、`frontend_backend_linkage_readonly`、`frontend_reward_record`、`frontend_responsive_ui` 四个 phase 单独复跑并修正断言；修复后再复跑 `selection '全部'`。
