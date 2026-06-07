# 用例库总览（统一口径）

> 本文件由 `node tools/generate-test-cases-index.mjs` 生成，请勿手改。

## 统一统计口径（默认）
- 用户问“总用例数”时，默认按 **“可自动化回归用例总数”** 统计（文档用例 + 已落地自动化子用例）。
- 自动化脚本若包含子步骤（`steps.push({ name })`），则按 **“子用例 = 1 条 case”** 统计与沉淀。
- orchestrations YAML 若包含 `steps`，则按 **“steps 条数 = 子用例数”** 统计。

## 可自动化回归用例库（文档用例）
- 转盘抽奖（后管）：56
- 转盘抽奖（前端）：84
- 转盘抽奖合计：140

## 已落地自动化用例库（子用例口径）

| 套件 | 用例数 | 子用例总数 | 类型 | 入口 |
| --- | ---: | ---: | --- | --- |
| universal-regression | 13 | 141 | 自动化文档(脚本) | docs/test-cases/universal-regression/README.md |
| lottery-regression | 4 | 4 | 编排(orchestration) | orchestrations/lottery-regression/README.md |

- 自动化子用例合计（脚本）：141
- 自动化子用例合计（编排）：4

## 总用例数（默认口径：可自动化回归）
- 合计：285

## 维护方式
- 新增/修改自动化链路脚本后：`npm run generate:test-cases`
- 新增 step name 如需更友好的中文描述/预期：补充 `tools/lib/result-md.mjs` 的 `DEFAULT_STEP_META_ZH`
