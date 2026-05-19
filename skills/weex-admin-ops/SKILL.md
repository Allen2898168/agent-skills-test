---
name: weex-admin-ops
description: Operate, validate, and document WEEX activity admin workflows with bundled Playwright scripts and optional web-access/CDP browser handling. Use when Codex is asked to log in to the WEEX admin, navigate admin pages, create or edit activities or prizes, run browser-driven backend operations, apply default admin configurations, ask testers for missing business parameters, capture screenshots when explicitly requested, or update stored WEEX admin routes, selectors, assertions, defaults, known issues, and operation playbooks.
---

# WEEX Admin Ops

## Overview

Use this skill for WEEX activity admin operations that require stored procedural knowledge: routes, page behavior, required business inputs, default values, selectors, validation signals, optional screenshots, and workflow updates.

This skill is not only for testing. It should help Codex interpret natural-language admin commands, identify the correct stored workflow, ask for missing high-risk inputs, execute browser operations, verify results, and record newly proven flows.

## Operating Workflow

1. Classify the user's request as read-only inspection, low-risk navigation, or state-changing operation.
2. Before adding or changing automation logic, define the target outcome, completion signal, and out-of-scope items for this request. If a high-risk business value is still unclear, stop and ask instead of guessing.
3. Prefer the smallest proven change that satisfies the request. Reuse an existing playbook, cached action, helper, selector, or assertion before adding new business logic.
4. Read only the needed references:
   - Login or session behavior: `references/login.md`
   - Default credential profile and secret sources: `references/credentials.md`
   - Operation index: `references/operations/index.md`
   - Existing operation playbooks: `references/operations/<business-domain>.md`
   - Cached action catalog: `references/action-cache.md`
   - Page paths: `references/routes.md`
   - Default values and confirmation rules: `references/defaults.md`
   - Field/button locators: `references/selectors.md`
   - Page-specific locators: `references/selectors/<page-or-domain>.md`
   - Success checks: `references/assertions.md`
   - Page-specific success checks: `references/assertions/<page-or-domain>.md`
   - Cross-page business dependencies: `references/relationships.md`
   - Reusable UI component operations: `references/components.md`
   - Known redirects, permission issues, and failures: `references/known-issues.md`
   - Skill failure review index: `FAILURES.md`
   - Relevant business failure reviews: `failure-reviews/<business-domain>.md`
5. For state-changing operations, identify missing required parameters before acting.
6. Before creating, editing, or deleting records, summarize the current chain's required fields, configurable fields, safe defaults, and known limits, then ask the tester which items should use defaults and which should be explicitly set.
7. Use stored defaults only for low-risk fields. Ask the tester to confirm high-risk values such as activity time, reward amount, reward scope, user scope, enable/disable state, and risk-control behavior.
8. If the tester's requested parameters conflict with the proven workflow, page constraints, or known backend rules, explain the issue first and wait for confirmation or corrected inputs.
9. Before executing a known failure-prone workflow, check `FAILURES.md` and the relevant `failure-reviews/` file for existing solutions.
10. Check the action cache. If the request matches a cached script and required parameters are available, run `scripts/run-cached-action.mjs` first.
11. If the cached script fails or matching confidence is low, fall back to project Playwright browser automation. Use optional `web-access`/CDP only when reusing the user's Chrome login state, exploring a dynamic page through an existing browser session, or when CDP behavior is explicitly needed.
12. Execute browser automation in invisible/background mode by default. If the user explicitly requests visible operation, open a headed real browser so the tester can watch the page actions.
13. When the tester explicitly requests `浏览器模式`, visible operation, or watching the operation, state-changing work must be performed through real UI actions: click buttons, fill fields, select dropdown/radio/checkbox controls, upload files, and click submit/confirm in the page. Do not replace visible-mode writes with a direct API call. API calls may be used only for read-only verification or evidence after the UI action.
14. Invisible/background mode does not require user-like clicks when a proven script can safely use a faster page-context or API-assisted path; still verify business response and result lookup.
15. Before adding new browser script logic, check `references/components.md`, page-specific component references, and `scripts/lib/` for existing helpers. Reuse or extend shared helpers for dropdowns, radios, checkboxes, switches, date pickers, uploads, tables, dialogs, search forms, buttons, and form-label lookup.
16. Keep business scripts as orchestration only. If a component-level helper cannot be reused, document why and evaluate extraction after the flow succeeds.
17. During every backend configuration test, inspect the visible text-field counters or maxlength hints on the page. Record the limit for each field touched by the current chain, keep generated default values within those limits unless the tester explicitly asks for a negative test, and treat any "create succeeds but edit view shows red over-limit counter" case as a validation inconsistency that must be documented.
18. Verify success using URL, page text, table/form state, toast/message, API response, or user-requested screenshot evidence. Do not treat a completed click as success by itself.
19. Save screenshots only when the user explicitly asks for screenshots or visual evidence. Store them under `artifacts/screenshots/<中文业务域>/<中文页面或操作>/`.
20. If a flow is newly discovered or improved, update the references with placeholders instead of secrets.
21. For newly proven reusable flows, evaluate both documentation and action-cache updates. If a flow is cacheable, add or update the script and cache manifest; if it is not cached, record the reason.
22. If any failure, blocker, false assumption, retry success, script error, cache mismatch, or backend validation problem occurred, update `FAILURES.md` or the relevant `failure-reviews/` file before finishing the task.

## Browser Execution

- Cached execution:
  - Catalog: `scripts/action-cache.json`
  - Reference: `references/action-cache.md`
  - Runner: `scripts/run-cached-action.mjs`
  - Use this before manual exploration for requests that look like already-scripted workflows.
  - Dry-run example: `node scripts/run-cached-action.mjs --query "创建3个ETH币种奖励" --dry-run`
  - If cached execution fails, report the failure and continue with bundled Playwright browser automation unless CDP/login-state reuse is required.
- Project Playwright scripts are the default execution path for deterministic stored workflows.
- Visible browser mode is a UI-operation commitment, not only a headed browser flag. For state-changing operations, headed scripts must drive the page controls and submit buttons just as a tester would; direct API writes are not valid visible-mode verification.
- Invisible/background scripts may use a faster API-assisted path only when the workflow has been proven and the result is independently verified.
- `web-access` is optional. Use it for CDP browser operations when Chrome remote debugging is available and the task benefits from the user's existing browser login state.
- Run `web-access/scripts/check-deps.mjs` before CDP browser operations. If it reports Chrome remote debugging is not connected, use a bundled Playwright script or explain the fallback.
- Bundled prize creation script:
  - Path: `scripts/create-prizes.mjs`
  - Use when creating one or more prize records with stored defaults.
  - It reads secrets from `WEEX_ADMIN_PASSWORD` and `WEEX_ADMIN_GOOGLE_CODE`; never pass secrets as CLI arguments.
  - Default mode is invisible/background. Pass `--visible` only when the user asks for browser-visible operation.
  - Example: `node scripts/create-prizes.mjs --category 币种 --subtype ETH --count 3 --name-prefix ETH币种奖励 --alias-prefix eth_coin`
  - Dry run: add `--dry-run` to print the planned records without opening a browser.

## Script Organization

- Keep script entrypoints thin. Files directly under `scripts/*.mjs` should parse arguments, call modules, and print results.
- Keep code changes surgical. Do not refactor unrelated domains, rename stable files, or broaden a script's scope unless the current request requires it.
- Put reusable browser, CLI, runtime, and Element UI helpers under `scripts/lib/`.
- Put action cache matching and command construction under `scripts/cache/`.
- Put business-specific automation under `scripts/business/<business-domain>/`, for example `scripts/business/prize-management/`.
- Keep each script module around 180 lines or less. If a file approaches 200 lines, split by responsibility before adding more behavior.
- Do not duplicate login, dropdown, upload, table, or assertion helpers across business scripts.
- Do not duplicate component-level DOM logic such as form-label lookup, checkbox/radio selection, switches, search form inputs, button clicks, date pickers, or message-box handling across business scripts.
- Cached scripts should support dry-run or an equivalent non-mutating preview whenever practical.

## Safety Rules

- Never store or print real passwords, Google codes, tokens, cookies, API keys, or secrets.
- Use placeholders such as `<USERNAME>`, `<PASSWORD>`, `<GOOGLE_CODE>`, `<ACTIVITY_NAME>`, `<START_TIME>`, and `<END_TIME>` in skill references.
- Use default username `auto` for staging only when the user does not provide another account. Read password and Google code from local environment or ask the user; never write them into the skill.
- Do not perform production write operations unless the user explicitly names production and confirms the action.
- Before destructive, bulk, financial, reward, or hard-to-revert actions, describe the exact action and wait for explicit confirmation.
- Do not guess high-risk business values. Ask for them.

## Natural-Language Operation Handling

When the user asks for an operation like "创建一个新手活动，用默认配置":

1. Match the operation name against `references/operations/index.md`.
2. If no playbook exists, inspect routes and ask for the minimum missing context needed to find the page.
3. Summarize:
   - Target environment.
   - Target operation.
   - Required inputs still missing.
   - Configurable items exposed by the proven chain.
   - Defaults that can be applied.
   - Any high-risk fields needing confirmation.
   - Any requested values that appear invalid, risky, or inconsistent with the chain.
4. Ask the tester to confirm which configurable items should use defaults and which should use explicit values.
5. Execute only after required information is available and risk confirmation has been handled.
6. Report final URL, result, evidence, screenshot path if one was requested, and whether the flow was recorded or updated.

## Updating This Skill

When a route or operation is proven in a real session, update the relevant reference file:

- `references/operations/index.md` for operation summaries and links only.
- `references/operations/<business-domain>.md` for reusable operation playbooks.
- `references/routes.md` for page paths and navigation.
- `references/selectors.md` for stable field/button/table locators.
- `references/selectors/<page-or-domain>.md` for page-specific locators.
- `references/assertions.md` for success checks.
- `references/assertions/<page-or-domain>.md` for page-specific success checks.
- `references/defaults.md` for safe defaults and confirmation policy.
- `references/relationships.md` for dependencies between lists, config items, dropdown data sources, rewards, tasks, templates, activity types, and backend validation rules.
- `references/components.md` for reusable UI component operation patterns and related helper functions.
- `references/known-issues.md` for redirects, permissions, environment issues, and recurring failures.
- `scripts/action-cache.json` and `references/action-cache.md` when a proven workflow has a reusable script.

Use `scripts/append-operation.py` when adding a new operation from a markdown snippet. Mark first-time flows as `candidate`; promote to `verified` only after repeated validation or explicit user confirmation.

When a workflow has been successfully repeated or is stable enough to script, add or update a script under `scripts/`, register it in `scripts/action-cache.json`, and make future matching requests try that cached script before manual browser work.

If a workflow first failed but a retry exposed a stable path, treat that retry path as a required documentation update. Record the stable retry path in the relevant references. When this skill is used inside a repository that has a handoff file, add a short handoff summary there as well.

If a workflow fails, update the skill failure review docs:

- `FAILURES.md` for the skill index and high-frequency summary.
- `failure-reviews/common.md` for cross-business login, browser, component, script, cache, or environment failures.
- `failure-reviews/<business-domain>.md` for page or business-specific failures.

When the same failure appears repeatedly, do not only add another review entry. Change the original workflow, reference, helper, or cached script so the known solution is applied before failure, then validate the corrected path. If the same issue appears for a second time and the documented failure-review solution successfully fixes it, replace the original fixed execution path with that successful path; after validating the new fixed path, delete the corresponding failure-review item so resolved historical failures do not remain as active review guidance. If the fixed path cannot be replaced or the review item cannot be removed yet, document the reason, risk, and next step in both the handoff and the review item's follow-up status.

Before adding or updating a workflow, check whether the flow reveals a reusable relationship or component operation:

- Record cross-page or cross-module dependencies in `references/relationships.md`.
- Record reusable UI behavior in `references/components.md`.
- Reference those files from the operation playbook instead of repeating long explanations.
- If the reusable operation is scripted, put the helper in `scripts/lib/` and keep business orchestration under `scripts/business/<business-domain>/`.
- Record whether the proven path used visible browser mode or default invisible mode. Treat untested mode variants as unverified until they are run and checked.

## Growth Management

Keep the skill small, searchable, and organized by business domain.

- Keep `SKILL.md` focused on workflow rules and reference navigation.
- Do not append every operation to one large file.
- Store operation playbooks under `references/operations/`.
- Keep `references/operations/index.md` as an index with operation name, domain file, status, date, and short notes.
- Split operation files by business domain, such as:
  - `activity-management.md`
  - `offline-user-manage.md`
  - `reward-issue.md`
  - `risk-control.md`
  - `import-export.md`
- Store shared selectors in `references/selectors.md`.
- Store page-specific selectors in `references/selectors/<page-or-domain>.md`.
- Store shared assertions in `references/assertions.md`.
- Store page-specific assertions in `references/assertions/<page-or-domain>.md`.
- Store business relationships in `references/relationships.md` when a list, config item, dropdown, API source, or backend rule affects another page or workflow.
- Store reusable UI component operation patterns in `references/components.md`; component scripts belong in `scripts/lib/`.
- If any markdown file approaches 250 lines, split it before adding more content.
- Do not duplicate long steps, selectors, routes, defaults, or assertions across files. Reference existing files instead.
- When creating a new business-domain file, add it to `references/operations/index.md`.
- Failure review docs follow the same growth rule: keep `FAILURES.md` as an index, store details under `failure-reviews/`, and split any `failure-reviews/**/*.md` file before it exceeds 250 lines.
- After updating skill knowledge or failure review docs, run `node scripts/maintenance/validate-knowledge-structure.mjs` from the skill root when available.
