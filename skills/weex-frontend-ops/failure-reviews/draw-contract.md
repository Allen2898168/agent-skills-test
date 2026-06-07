# 转盘合约任务失败复盘

## 2026-05-13 9046 新账号 BTC 页面交易前合约余额未到账

- 页面/流程：活动 ID `9046`，别名 `frontend-draw-football-20260511093107`，BTC-USDT 合约页页面下单链路。
- 环境/viewport：STG，可见浏览器，desktop `1440x1000`。
- 失败表现：新系统/API账号 `3447598495@weex.com` / UID `3447598495` 在 9046 活动页 `applyStatus=true`，但 BTC-USDT 页面显示 `可用 0.0000`、`保证金余额 0.0000 USDT`、`可开 0 BTC`，未执行页面下单；活动页回查 `taskCompletions.completions=[]`、`doTaskGetCount=0`、页面 `可用次数：0`。
- 失败原因：FIN 发放审核通过后，前端现货到合约划转返回 `70011 划转处理中`，但合约页余额尚未到账；页面交易必须以合约页可用余额为准，不能用 API 下单或余额假设代替。
- 解决方式：后续继续该账号前，先重试或查询前端划转直到合约页显示可用余额大于 0；BTC 页面交易默认使用 `/zh-CN/futures/BTC-USDT`，处理 Cookie、引导和分享弹窗后切 `市价`，金额单位选 `USDT`，输入任务阈值 +100 的名义金额，再点击 `买入开多` 或 `卖出开空` 并确认。
- 验证结果：本次未完成新账号页面交易；未产生 `createOrder` 页面下单响应。旧可用账号 `7479616356@weex.com` 的 9046 任务已在此前页面交易后完成，回查 `taskId=4882`、`status=COMPLETED`、`tradingVolume=1689.1317324`、`doTaskGetCount=1`，但本次不能作为新账号成功证据。
- 关联流程或脚本：临时可见 Playwright 页面链路；FIN `finance-airdrop-reward-grant.mjs`；前端 `frontend-assets-transfer.mjs`。
- 后续处理状态：待补充一个“新账号资金就绪 -> BTC 页面开仓/平仓 -> 9046 回查”的固定页面脚本；脚本必须在页面余额为 0 时停止，不得回退到 API 下单。
