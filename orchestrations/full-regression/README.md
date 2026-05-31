# 全量回归编排（跨域）

本目录用于跨活动后台、前端页面与通用回归脚本的“全量回归”编排与报告汇总。

## 入口

```bash
# dry-run
node orchestrations/full-regression/scripts/run-full-regression.mjs --dry-run

# run (writes)
node orchestrations/full-regression/scripts/run-full-regression.mjs --confirm-run
```

## 说明

- 默认目标环境：staging。
- 会产生写操作：创建/上线/下线/删除临时活动、创建依赖任务/奖品、前端链路可能触发 MQ 回调。
- 默认会清理本次创建的活动（offline + delete）。

