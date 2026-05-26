# Lottery Regression Orchestration

Status: candidate
Owner: cross-skill workflow layer

This directory owns lottery regression workflows that span multiple skill domains.

## Boundary

- `skills/weex-admin-ops/`: activity admin creation, update, online/offline, and admin-only regression phases.
- `skills/weex-frontend-ops/`: frontend draw page login state, signup, draw, reward-record, and browser evidence phases.
- `skills/weex-fin-admin-ops/`: FIN Admin funding, MQ callback, and approval actions.
- `orchestrations/lottery-regression/`: scenario selection, dependency ordering, phase orchestration, and cross-skill result aggregation.

## Contract

- Orchestration may call skill scripts through CLI contracts and JSON output.
- Orchestration must not import skill-private browser, auth, or business helpers.
- Skill scripts should not own cross-skill scenario dispatch. Keep backward-compatible wrappers only when needed.

## Entrypoints

```bash
node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --menu
node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --selection "报名链路, 单抽主流程" --dry-run
node orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs --activity-alias <alias> --dry-run
```

## Execution Standard (Team Default)

- Run full regression once, then report results only (no auto-retry / no auto-fix).
- After reporting, ask the user whether to:
  - retry failed cases/scenarios,
  - adjust timeouts / rerun in visible mode,
  - or accept failures and stop.

中文约定：
- 全量只跑一次；失败只记录与汇总；全部输出后等待用户说 `ok` 再做失败重试或其他方案。
