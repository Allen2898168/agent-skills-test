---
name: weex-fin-admin-ops
description: Operate, validate, and document WEEX FIN Admin finance-management backend workflows. Use when Codex is asked to inspect or automate FIN Admin pages such as stg-admin-web-fin.weex.tech, reuse a current Chrome CDP FIN login state, create or approve financial asset adjustment orders, run reward or recharge grant scripts, check FIN action caches, or update FIN Admin routes, API chains, safety rules, failures, and operation playbooks.
---

# WEEX FIN Admin Ops

## Overview

Use this skill for WEEX FIN Admin operations that belong to the finance-management backend, not the activity-management backend. The default staging FIN Admin web host is `https://stg-admin-web-fin.weex.tech`, and the API host currently observed for financial asset adjustment is `https://stg-admin-fin-app.weex.tech/api`.

FIN workflows are usually financial, reward-affecting, or hard to revert. Treat UID, amount, asset, order status, approval type, Google code, and target environment as high-risk values.

## Operating Workflow

1. Classify the request as read-only inspection, dry-run planning, order creation, approval, or another state-changing FIN operation.
2. Before changing FIN automation, define the exact target result, success signal, and non-goals for the request. If UID, amount, currency, approval scope, or environment is unclear, ask first.
3. Prefer the smallest safe extension to existing cached actions, helpers, and verified flows. Do not widen financial write scope just because a nearby script looks similar.
4. Read only the needed references:
   - Environments and auth: `references/environments.md`
   - Operation index: `references/operations/index.md`
   - Existing operation playbooks: `references/operations/<business-domain>.md`
   - Cached action catalog: `references/action-cache.md`
   - Failure review index: `FAILURES.md`
   - Relevant failure reviews: `failure-reviews/<business-domain>.md`
5. Before using FIN platform capability, run `scripts/fin-auth-check.mjs` to verify the persistent CDP login state and a basic read-only FIN interface.
6. If the base check fails, open the persistent CDP Chrome FIN page and ask the user to log in. Keep waiting until the user closes the FIN page; do not stop because of a default timeout. Treat closing the FIN page as the signal that user-side login/handling is complete. Re-run the base check after the page closes. If it still fails, ask whether to retry; if the user says no, ask whether to continue with non-FIN parts of the current task when such parts exist.
7. If the base check succeeds after the FIN page closes, do not add extra commentary; continue with the requested FIN operation in default non-visible/headless CDP/API-assisted mode.
8. For every state-changing operation, identify missing required parameters before acting. Do not guess UID, amount, asset, approval type, Google code, or production/staging target.
9. Before creating or approving FIN records, summarize the exact action, target environment, UID, amount, currency, sub business type, and approval scope. If the user explicitly requested a FIN recharge/grant such as `充值`, `发放`, or `下发`, and the environment, target account/UID, amount, currency, and approval method are available from the request or current workflow, treat that as confirmation and do not ask for a second confirmation. If any high-risk value is missing or ambiguous, ask for it before acting.
10. Check `scripts/action-cache.json`. If the request matches a cached script and required parameters are available, run `scripts/run-cached-action.mjs --dry-run` first.
11. If the cache script is missing, fails, or the page/API chain is unclear, use CDP against the user's current FIN Chrome session for read-only exploration. Do not print or store token, cookie, or Google code.
12. Default execution mode is dry-run or non-visible CDP/API-assisted execution after confirmation. Visible browser mode is for observation or UI verification unless a FIN operation playbook explicitly marks visible UI writes as verified.
13. Verify success with a business response and result lookup, not only HTTP 200. For grants and approvals, verify the created order appears in the expected list/status.
14. Save screenshots only when the user explicitly asks. Store FIN screenshots under `artifacts/screenshots/<中文业务域>/<中文页面或操作>/`.
15. If a FIN flow is newly discovered or changed, update the relevant reference and evaluate action-cache registration. Keep `SKILL.md` focused on workflow rules and navigation.
16. If a failure, blocker, false assumption, retry success, script error, cache mismatch, or backend validation problem occurs, update `FAILURES.md` or the relevant `failure-reviews/` file before finishing.

## Cached Execution

- Catalog: `scripts/action-cache.json`
- Runner: `scripts/run-cached-action.mjs`
- Base auth/interface check: `scripts/fin-auth-check.mjs`
- Reference: `references/action-cache.md`
- Dry-run example:

```bash
node skills/weex-fin-admin-ops/scripts/run-cached-action.mjs --action finance_airdrop_reward_grant --uid <UID> --amount <AMOUNT> --dry-run
```

Actual FIN writes must still pass explicit confirmation flags in the target script. When the user has already clearly requested recharge/grant execution, the operator should pass those flags without asking for another confirmation. Approval must read Google code from `skills/weex-fin-admin-ops/.env.local` or same-skill `WEEX_FIN_*` runtime environment variables only.

## Safety Rules

- Never store or print real passwords, Google codes, tokens, cookies, API keys, or complete account credentials. Staging/test account emails and UIDs can be printed and recorded in full; production or unspecified-environment identifiers must still be redacted or avoided.
- Use placeholders such as `<UID>`, `<AMOUNT>`, `<GOOGLE_CODE>`, `<ORDER_ID>`, and `<TOKEN>` in references.
- Use the persistent Chrome CDP FIN login profile only when the user has logged in to FIN Admin once or explicitly asks to connect to that browser. Scripts may reopen the FIN tab from the persistent profile, but must stop if the session is expired or no token is present.
- Approval code source is `WEEX_FIN_GOOGLE_CODE` from `skills/weex-fin-admin-ops/.env.local` or same-skill current process environment variables. Never pass Google code as a CLI argument or fallback to another skill's variables.
- Do not run production writes unless the user explicitly names production and confirms the exact financial action.
- Do not approve a record unless approval scope is clear from the user request or confirmed by the user, and the script verifies the order is in the expected pending status.

## Script Organization

- Keep script entrypoints thin. Files directly under `scripts/*.mjs` should parse almost nothing and delegate to modules.
- Keep edits narrow and auditable. Avoid opportunistic refactors in financial scripts; every extra change raises review and rollback cost.
- Put reusable CLI helpers under `scripts/lib/`.
- Put action cache matching and command construction under `scripts/cache/`.
- Put FIN business automation under `scripts/business/<business-domain>/`.
- Keep each script module around 180 lines or less. If a module approaches 200 lines, split by responsibility before adding behavior.
- Cached scripts should support `--dry-run` or an equivalent non-mutating preview whenever practical.

## Updating This Skill

When a FIN route or operation is proven:

- Update `references/operations/index.md` for operation summaries and links only.
- Update `references/operations/<business-domain>.md` for reusable operation playbooks.
- Update `references/environments.md` for hosts, auth sources, and runtime variable rules.
- Update `scripts/action-cache.json` and `references/action-cache.md` when a reusable script is added or changed.
- Update `docs/session-handoff.md` in the project with a short Chinese summary and file paths, without secrets. Staging/test UIDs may be recorded in full.

Use `candidate` for first-time or dry-run-only flows. Promote to `verified` only after a real staging execution is completed and independently checked.

## Regression Test Case Library (Required)

When a FIN API chain (headed browser or headless/CDP/API-assisted) is proven runnable and verifiable, it must be standardized into the regression test case library:

- The runnable script should output standardized result markdown via `tools/lib/result-md.mjs` `writeResultMarkdown({ testCase, steps })`.
- `testCase.number/description/preconditions/tags` must be stable and safe (no secrets).
- Each `steps.push({ name })` counts as 1 sub-testcase by the default library counting rule; add friendly `desc/expected` into `tools/lib/result-md.mjs` `DEFAULT_STEP_META_ZH` when new step names are introduced.
- After the flow is proven, run `npm run generate:test-cases` to sync `docs/test-cases/index.md` and the suite libraries.

## Failure Reviews

- `FAILURES.md` is the failure index.
- `failure-reviews/common.md` stores cross-FIN login, CDP, script, cache, and environment failures.
- Business-specific failure files store page or API-chain failures.

When the same failure appears repeatedly, update the normal workflow, helper, or cached script so the known solution is applied before failure, then validate the corrected path.

## Growth Management

- Keep `SKILL.md` concise and navigational.
- Keep full operation details under `references/operations/`.
- Keep `references/operations/index.md` as an index with operation name, domain file, status, date, and notes.
- Split any markdown file before it exceeds 250 lines.
- After updating FIN skill knowledge or failure reviews, run:

```bash
node skills/weex-fin-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs
```
