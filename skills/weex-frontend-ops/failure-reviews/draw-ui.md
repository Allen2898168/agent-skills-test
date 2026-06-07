# 转盘活动页 UI 失败复盘

本文件记录转盘活动页（`/zh-CN/events/draw/<alias>`）的 UI 展示与字段一致性类问题。

## 页面基础展示副标题与后管配置不一致（FE-04）

- 日期：2026-05-26
- 页面/流程：抽奖回归 `frontend_page_basic` 用例 `FE-04 活动副标题展示正确`，活动别名 `lf26084942`，前端 URL `https://stg-www.weex.tech/zh-CN/events/draw/lf26084942`。
- 环境/viewport：STG，隐藏 Playwright，desktop `1440x1000`。
- 失败表现：后管快照 `subtitle="严格 UI 复杂配置副标题"`，但前端页面副标题位置展示为 `自动化测试 - 实物_20260525134927`（疑似奖池/奖品文案），断言 `subtitleMatched=false`。
- 可能原因：前端未渲染后管 `subTitle` 字段；或页面副标题区域复用了奖池首条文案；需前端/后管确认字段映射与渲染逻辑。
- 验证依据：`orchestrations/lottery-regression/artifacts/tmp/admin-snapshot-lf26084942.json` 与 `lottery-frontend-main-flow.mjs` readonly 输出 `consistency.subtitleMatched=false`。
- 后续处理状态：已按业务口径从抽奖回归用例集中移除该用例（页面确实不渲染后管副标题）；仍保留该复盘供字段映射排查参考。

## 后管快照字段与前端展示字段不一致：需优先使用 i18n（FE-03）

- 日期：2026-05-26
- 场景：抽奖回归 `FE-03 活动标题展示正确` 初次失败，后定位为“后管快照取错字段”导致误报。
- 现象：后管 `activity/config` 根字段 `title="N100207"`，但 `activityConfigI18n.zh_CN.title="前端主回归20260525085715"`；前端标题展示使用 i18n 字段，导致 `titleMatched=false`。
- 处理：`skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs` 的 `snapshot` 已改为优先取 `activityConfigI18n.zh_CN`（缺失再回退根字段），`FE-03` 重新验证 `PASS`。

## URL 去语言前缀后仍重定向回 /zh-CN（FE-75）

- 日期：2026-05-26
- 场景：抽奖回归 `FE-75 后管多语言配置后前端切语言展示正确`。
- 现象：访问 `https://stg-www.weex.tech/events/draw/<alias>` 最终 URL 仍为 `https://stg-www.weex.tech/zh-CN/events/draw/<alias>`，`document.documentElement.lang=zh-CN`；但页面数据中英文标题可区分（如 `EN 前端主回归...`）。
- 结论：当前 `/events/draw/<alias>` 在该环境下“默认英语”不成立（或存在强制重定向逻辑）；需确认正确的语言切换入口/路由规则后再调整用例口径。

## FAQ 配置存在但前端未识别/未展示（FE-76）

- 日期：2026-05-26
- 场景：抽奖回归 `FE-76 后管FAQ配置后前端展示正确`。
- 现象：后管详情中存在 `questions`（FAQ 结构），但前端页面主内容区未发现“FAQ/常见问题”入口或文案；脚本已排除全站 footer 的“常见问题”链接，避免误报。
- 后续：需要前端确认 FAQ 入口的文案/组件位置（是否为图标、是否异步加载、是否文案不含 FAQ/常见问题），再增强前端探测与断言。

## 后管标题改动后前端未展示/未命中可见断言（FE-73）

- 日期：2026-05-26
- 场景：抽奖回归 `FE-73 后管活动标题改动后前端展示正确`（`frontend_backend_linkage` 阶段）。
- 活动别名：`lf96150630`（前端 URL `https://stg-www.weex.tech/zh-CN/events/draw/lf96150630`）。
- 失败表现：后管已变更标题并触发联动校验，但前端侧未命中“标题可见”断言，汇总失败原因为 `frontend title not visible`。
- 验证依据：`orchestrations/lottery-regression` 回归执行输出中 `frontend_backend_linkage` 阶段 `FE-73 FAIL`。
- 后续：需要前端确认标题 DOM/文案区域是否异步渲染或被样式隐藏；如属“可见但 selector 不稳”，应增强 `lottery-frontend-main-flow.mjs` 的标题探测/可见性策略，并补充断言证据字段。
