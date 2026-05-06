# 奖品管理操作归档

## 2026-05-04 18:17 CEST 奖品管理行操作按钮验证

- 当前目标：验证 `活动通用模块管理 / 奖品管理` 列表行操作按钮 `查看 / 修改 / 复制 / 删除`。
- 环境：staging。
- 页面：`/activity/prize`。
- 执行模式：用户要求浏览器模式，已使用可见浏览器执行。
- 操作类型：新增测试奖品、修改奖品、复制奖品、删除复制奖品，改变后台状态。
- 已完成事项：
  - 创建专用测试奖品：奖品ID `473`，`币种 / BTC`，别名 `auto_action_btc_20260504161432`。
  - `查看`：详情弹窗打开，表单值包含测试奖品名称和别名。
  - `修改`：将测试奖品名称修改为 `操作按钮测试_BTC_20260504161432_已修改`，`PUT /prod-api/activity/prize` 返回 200，搜索列表显示修改后的名称。
  - `复制`：确认弹窗打开，`POST /prod-api/activity/prize/copy` 返回 200，复制记录奖品ID `474`，名称为 `复制从 操作按钮测试_BTC_20260504161432_已修改`，别名为 `复制从 auto_action_btc_20260504161432`。
  - `删除`：删除复制记录 `474`，`DELETE /prod-api/activity/prize/474` 返回 200，按奖品ID `474` 搜索不再展示该复制记录。
- 截图路径：
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/00-测试奖品创建后列表.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/01-查看详情弹窗.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/02-修改弹窗-已回填.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/03-修改后列表验证.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/04-复制确认弹窗.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/05-复制后列表最上方.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/06-删除确认弹窗.png`
  - `skills/weex-admin-ops/artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/07-删除后搜索无结果.png`
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/operations/index.md`
  - `skills/weex-admin-ops/references/operations/prize-management.md`
  - `skills/weex-admin-ops/references/selectors/prize-management.md`
  - `skills/weex-admin-ops/references/assertions/prize-management.md`
- 当前阻塞点：无。
- 下一步建议：如需清理本次专用测试奖品，可后续按奖品ID `473` 执行删除；该删除会改变 staging 后台状态，执行前需确认。
- 是否可回滚：复制记录已删除；原始测试奖品 `473` 仍保留，可通过行操作 `删除` 清理。

## 2026-05-04 18:30 CEST 奖品 ID 复制缓存测试

- 当前目标：按用户自然语言指令“复制奖品id为462的奖品”测试已沉淀 skill。
- 环境：staging。
- 页面：`/activity/prize`。
- 执行模式：默认不可见浏览器自动化；CDP 未连接，按 skill 规则使用项目 Playwright 兜底。
- 操作类型：复制奖品，改变后台状态。
- 动作缓存：
  - 首次 dry-run 未命中专用复制脚本，仅命中创建奖品缓存的参数缺失报错。
  - 已新增缓存动作 `copy_prize_by_id`，并登记到 `skills/weex-admin-ops/scripts/action-cache.json`。
  - 新 dry-run 已通过：`复制奖品id为462的奖品` 命中 `scripts/copy-prize.mjs --prize-id 462`。
- 已完成事项：
  - 找到源奖品：奖品ID `462`，`虚拟积分或资格 / 理财加息券`，奖品名称 `券7+staking+apy+btc`，别名 `券7+staking+apy+btc`。
  - 点击源奖品行操作 `复制` 并确认。
  - `POST /prod-api/activity/prize/copy` 返回 200。
  - 验证复制记录已出现：新奖品ID `475`，奖品名称 `复制从 券7+staking+apy+btc`，别名 `复制从 券7+staking+apy+btc`。
- 截图：用户未要求截图，本次未保存截图。
- 已更新 skill 文件：
  - `skills/weex-admin-ops/references/action-cache.md`
  - `skills/weex-admin-ops/references/operations/prize-management.md`
  - `skills/weex-admin-ops/scripts/action-cache.json`
  - `skills/weex-admin-ops/scripts/cache/command.mjs`
  - `skills/weex-admin-ops/scripts/cache/matcher.mjs`
  - `skills/weex-admin-ops/scripts/copy-prize.mjs`
  - `skills/weex-admin-ops/scripts/business/prize-management/copy.mjs`
  - `skills/weex-admin-ops/scripts/lib/runtime.mjs`
  - `skills/weex-admin-ops/scripts/create-prizes.mjs`
- 当前阻塞点：无。
- 下一步建议：如需清理本次复制记录，可按奖品ID `475` 执行删除；该删除会改变 staging 后台状态，执行前需确认。
- 是否可回滚：复制记录 `475` 仍保留，可通过行操作 `删除` 清理。
