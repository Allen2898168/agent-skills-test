# 失败复盘索引

本文件是失败复盘入口。每次后台操作、脚本执行、页面探测、缓存命中或验证中出现失败，都必须主动记录到对应复盘文档。

## 使用规则
- 执行新流程或重试失败流程前，先查看本索引和相关业务线复盘。
- 新失败按业务线写入 `failure-reviews/`；跨业务通用问题写入 `failure-reviews/common.md`。
- 同类失败多次出现时，必须把解决方式反写到原流程、skill reference、组件 helper 或缓存脚本，并重新验证。
- 单个复盘文件接近 250 行时，必须按业务线、场景或时间拆分，再更新本索引。
- 不记录真实密码、验证码、token、cookie、API key、完整账号凭证或个人隐私数据。

## 文档索引
- `failure-reviews/README.md`：目录结构、写入规范和复盘模板。
- `failure-reviews/common.md`：登录、浏览器、Element UI、脚本运行、缓存匹配等通用失败。
- `failure-reviews/prize-management.md`：奖品管理相关失败。
- `failure-reviews/activity-task-management.md`：活动任务管理相关失败。
- `failure-reviews/activity-register-management.md`：活动用户报名管理相关失败。
- `failure-reviews/activity-management.md`：活动列表与具体活动配置创建相关失败。
- `failure-reviews/activity-management-agent.md`：人人代理（AGENT）活动相关失败。
- `failure-reviews/activity-management-monopoly-worldcup.md`：大富翁世界杯（MONOPOLY_WORLD_CUP）相关失败。
- `failure-reviews/activity-management-race.md`：交易竞速赛（RACE_COMPETITION）相关失败。
- `failure-reviews/contract-mining-activity.md`：合约挖矿活动相关失败。
- `failure-reviews/joker-activity.md`：小丑牌活动相关失败。
- `failure-reviews/activity-common-module.md`：活动通用模块管理相关失败。

## 当前已知高频问题摘要
- Element UI 多选下拉选中后常需要点击弹窗空白、按 Escape 或调用公共 helper 收起，否则后续字段会被遮挡或 Vue 状态未稳定。
- 页面操作不能只看 HTTP 200；必须同时检查业务响应 `code`、toast/message、列表回查或表单状态。
- `AGENT` 活动上线前需先确认 staging 不存在其他在线 `AGENT` 活动；否则上线会返回 `已有上线状态的人人代理活动`。
- 登录页普通 `验证码` 可能短暂出现，staging 当前以 `/prod-api/captchaImage` 的 `captchaEnabled=false` 为准，不应把 Google 验证码填到普通验证码字段。
- 多语言字段必须按具体表单项分别打开和回填，不能用全局第一个 `英语` 输入框。
- 后管 API 手动调用不能只依赖 cookie；页面请求通常带 `Authorization` 头，缺失时可能返回 HTTP 200 但业务 `code=401`。
- 转盘抽奖新增页的奖品表格不能用通用数值循环填充；第一列 `奖品池ID` 必须保持 `1`-`8`，否则奖品配置前端校验会失败且不触发创建接口。
- 转盘抽奖活动如需前端展示验证，必须先上线；批量创建时应创建一个、上线一个、验证一个，避免统一上线时开始时间已过。
- 转盘抽奖 `彩蛋` 样式奖品表额外必填 `彩蛋类型`；不填会导致奖品配置提交校验失败。
