# History

本目录用于沉淀自动化治理流水线的权威运行产物。

目录格式：

- `YYYY-MM-DD-001`
- `YYYY-MM-DD-002`

每个运行目录至少包含：

- `00-任务说明.md`
- `context/*.md`
- `context/*.json`
- `run-state.json`
- `run-index.json`
- 已实际进入阶段的 Markdown/JSON 报告
- `07-最终结论报告.md`

本目录与 `result/` 双轨并存：

- `result/`：业务脚本原始执行产物
- `history/`：多阶段审阅、整合、执行结论和汇总
