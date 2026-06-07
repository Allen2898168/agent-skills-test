# Draw UI Extended Regression

Status: standard regression partial
Last verified: 2026-05-30
Environment: staging `https://stg-www.weex.tech`
Viewport: desktop `1440x1000`; responsive phase also opens `390x844`, `360x640`, `390x568`.

Use `lottery_frontend_main_regression` when the user asks to补齐或执行抽奖样式、异常容错、奖励记录补充分支、响应式前端回归。

## Phase Mapping

- `frontend_style_display` covers `FE-09`-`FE-15`: style container, main visual, prize image/name, and non-circle five-draw visibility rule.
- `frontend_exception_ui` covers `FE-38`, `FE-39`, `FE-58`-`FE-63`: injected single-draw failure, no prize popup on failure, no count deduction, failure prompt, button recovery, duplicate-popup guard, and page survival.
- `frontend_reward_record_extended` covers `FE-51`-`FE-54`: reward-record empty/data state signal, time field/filter operability signal, and scroll/load stability.
- `frontend_responsive_ui` covers `FE-68`-`FE-72`: H5/mobile open, common mobile widths, low-height button visibility, mobile dialog boundary signal, and long-text overflow guard.

## Execution

```bash
node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "抽奖样式展示,异常提示,奖励记录,响应式" --start-offset-seconds 3 --wait-for-start-ms 60000
```

Dry-run:

```bash
node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "抽奖样式展示,异常提示,奖励记录,响应式" --start-offset-seconds 3 --wait-for-start-ms 60000 --dry-run
```

## Current Boundaries

- Style display currently verifies the current activity style with real page evidence and fills other style keys through the style contract evidence in the report. Strict per-style real activity creation can be added later if the requirement changes to five independent style activities.
- Exception UI currently uses route injection for draw API failure and records timeout/network exception signals under the same injected exception phase.
- Reward-record empty state is a dialog/state signal in the current activity context; a strict no-record account or no-reward activity should be used if the business wants a pure empty dataset assertion.
- Responsive phase opens multiple mobile viewports and checks page/layout signals; strict popup geometry on mobile can be strengthened with a dedicated mobile draw interaction.
