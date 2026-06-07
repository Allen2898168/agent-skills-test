# 奖品管理失败复盘

## 2026-06-07 lottery 后管回归奖品行操作目标行丢失
- 业务线：奖品管理 / 转盘抽奖后管回归。
- 场景：执行 `node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection '后管回归' --recharge-amount 1000 --wait-for-start-ms 60000`，进入 `prize_row_actions` 阶段。
- 失败表现：`PM-08`~`PM-11` 全部失败，统一报错 `Cannot read properties of null (reading 'id')`；报告目录：`orchestrations/lottery-regression/artifacts/reports/20260607_202339/`。
- 失败原因：`prize-row-actions-fast-api.mjs` 在读取临时奖品行操作目标时直接访问空对象的 `id`，当前行回查缺少空值保护与重试。
- 解决方式：后续需要先补临时奖品创建后的列表回查重试，并在进入查看/修改/复制/删除前对目标行做 null guard。
- 验证结果：本轮 `create_regression_prizes` 仍通过，但奖品行操作 4 条 case 全部失败，后续活动配置链路未受该阶段影响。
- 关联文件：`skills/weex-admin-ops/scripts/prize-row-actions-fast-api.mjs`、`orchestrations/lottery-regression/artifacts/reports/20260607_202339/admin.json`。
- 后续处理：补稳后需先单跑 `PM-08`~`PM-11` 再恢复到后管主回归固定路径。

## 2026-05-04 仓位空投交易对未落值
- 业务线：奖品管理。
- 场景：新增 `虚拟积分或资格 / 仓位空投` 奖品。
- 失败表现：提交时页面提示 `请选择交易对`。
- 失败原因：`交易对` 是多选下拉，选中后下拉浮层未收起，后续字段填写和 Vue 状态绑定不稳定。
- 解决方式：选择真实交易对后点击弹窗空白区域收起下拉，并确认表单项内出现已选 tag，再继续填写后续字段。
- 验证结果：重试后成功创建仓位空投奖品，按别名搜索返回新增记录。
- 关联文件：`references/operations/prize-management.md`、`references/components.md`。
- 后续处理：多选下拉解决方式已抽为通用组件规则。
