# Environments

## 默认规则

- 用户未提供目标 URL 时，先查 `references/routes.md`。
- `references/routes.md` 无匹配时，询问目标 URL，不要猜测前端域名。
- 涉及写操作、支付、资产、实名、风控、报名、交易或账号状态变化时，默认只在 staging/test 环境执行；生产必须由用户明确指定并确认。
- 默认 viewport 记录为 `desktop-default`，实际尺寸由执行脚本或浏览器环境输出。移动端、平板、宽屏必须作为单独验证项记录。

## Known STG Frontend

- Login URL: `https://stg-www.weex.tech/zh-CN/login`.
- Account overview URL: `https://stg-www.weex.tech/zh-CN/account`.
- Login-state cookie name observed in STG: `WEEX_TOKEN_COOKIE_STAGING`.
- Runtime auth details: `references/runtime-auth.md`.

## 执行前置项

- 目标 URL 或可解析路由。
- 是否需要登录态。
- 语言/地区。
- viewport/device。
- 需要验证的明确结果。
- 是否需要截图或保存视觉证据。

## 证据输出

- 最终 URL。
- viewport/device。
- 操作结果。
- 验证依据。
- 截图路径，仅在用户要求截图时提供。
- console/network 异常摘要，仅在实际检查时提供。
