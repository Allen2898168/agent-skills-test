---
name: weex-frontend-ops
description: Operate, inspect, validate, and document WEEX frontend pages with browser automation, page-state checks, visual evidence, reusable component helpers, and failure reviews. Use when Codex is asked to open or test a WEEX frontend page, click through user-facing flows, verify text/layout/forms/navigation/API calls, capture screenshots or page evidence, compare visible behavior with expected frontend requirements, or update stored frontend routes, selectors, assertions, components, known issues, and operation playbooks.
---

# WEEX Frontend Ops

## Overview

Use this skill for WEEX frontend page operations and checks that require reproducible browser evidence: route loading, navigation, UI interaction, visual state, responsive behavior, frontend API observations, screenshots when requested, and reusable workflow documentation.

This skill is for user-facing frontend pages, not activity-admin backend operations. Use `weex-admin-ops` for WEEX activity admin pages and backend write workflows.

## Operating Workflow

1. Classify the request as read-only inspection, interaction check, visual/layout check, form submission, or state-changing frontend operation.
2. Before changing frontend automation, define the target page, expected visible result, verification signal, and what is out of scope for this request.
3. Prefer the smallest reusable change. Reuse existing routes, cached actions, selectors, assertions, and component helpers before adding new page-specific logic.
4. Read only the needed references:
   - Environment and URL rules: `references/environments.md`
   - Runtime auth and account config: `references/runtime-auth.md`
   - Operation index: `references/operations/index.md`
   - Existing operation playbooks: `references/operations/<domain>.md`
   - Cached action catalog: `references/action-cache.md`
   - Page routes: `references/routes.md`
   - Selector strategy: `references/selectors.md`
   - Success assertions: `references/assertions.md`
   - Evidence and screenshot rules: `references/evidence.md`
   - Reusable component operations: `references/components.md`
   - Cross-page relationships: `references/relationships.md`
   - Known issues: `references/known-issues.md`
   - Failure review index: `FAILURES.md`
   - Relevant failure review: `failure-reviews/<domain>.md`
5. Identify the target URL, device/viewport, locale, login/session requirements, test data, and expected result before running browser actions.
6. If required information is missing, list only the missing items. Do not guess production URLs, user credentials, order amounts, KYC/account state, or other high-risk data.
7. Check the action cache. If the request matches a cached check and required parameters are available, run `scripts/run-cached-action.mjs --dry-run` first.
8. If the cached action is suitable, execute it; otherwise use Playwright browser automation or the in-app browser workflow appropriate to the task.
9. Prefer real page behavior for frontend checks: navigate, click, type, select, upload, resize, scroll, and wait for visible page or network state. Use API calls only as supporting evidence unless the task is explicitly API-only.
10. Verify success using at least one durable signal: final URL, visible text, DOM state, screenshot, console/network evidence, API response, local storage/session state, or user-specified assertion.
11. Save screenshots only when the user explicitly asks for screenshots, visual evidence, or a screenshot comparison. Store them under `artifacts/screenshots/<业务域>/<页面或操作>/`.
12. If a flow is newly discovered or improved, ask whether to persist it unless the user has already authorized automatic skill updates. If persisted, update the relevant operation, selectors, assertions, components, relationships, and action-cache docs.
13. If any browser, selector, layout, network, data, environment, cache, or verification failure occurs, update `FAILURES.md` or the relevant `failure-reviews/` file before finishing.

## Browser Execution

- Default to non-visible Playwright automation for deterministic checks unless the user asks to watch the browser.
- Use visible browser mode when the user says `浏览器模式`, `可见操作`, `打开浏览器`, `让我看着`, or asks for visual inspection while actions run.
- Frontend authentication is an exception to page-click requirements: for login and registration, visible browser mode only needs to show the final authenticated page unless the user explicitly asks to test the form UI itself. Use the proven cookie/API path, then open the final page for browser evidence.
- For frontend state-changing actions, state what will be changed before executing. For irreversible, financial, account-affecting, or production actions, wait for explicit confirmation.
- Use mobile, tablet, or desktop viewport only when the user requests it or the reference playbook requires it. Otherwise use the project default viewport documented in `references/environments.md`.
- Capture network requests, console errors, and screenshots when they are part of the requested evidence or the stored assertion.

## Script Organization

- Keep script entrypoints under `scripts/*.mjs`.
- Keep changes local to the page or shared helper that actually needs them. Do not mix selector cleanup, route renames, and new flow logic in one change unless the request truly needs all of them.
- Put cache matching and command construction under `scripts/cache/`.
- Put reusable browser, viewport, selector, screenshot, console, and network helpers under `scripts/lib/`.
- Put page- or product-specific automation under `scripts/business/<domain>/` when added later.
- Keep business scripts as orchestration only. Move component-level DOM logic to `scripts/lib/` and document it in `references/components.md`.
- Cached scripts should support `--dry-run` or a non-mutating preview whenever practical.

## Safety Rules

- Never store or print real passwords, tokens, cookies, API keys, session IDs, or private user data. Staging/test account emails and UIDs can be printed and recorded in full; production or unspecified-environment identifiers must still be redacted or avoided.
- Do not use production for write or destructive frontend flows unless the user explicitly names production and confirms the action.
- Do not guess high-risk test data. Ask for it.
- Prefer staging or test URLs. If the user provides only a page name, ask for or derive the URL from `references/routes.md`; if not present, ask for the target URL.
- Redact sensitive values from logs, screenshots summaries, failure reviews, and handoff notes.

## Natural-Language Frontend Handling

When the user asks for a frontend operation like "检查活动页报名按钮是否可用":

1. Match the page or operation against `references/operations/index.md`.
2. If no playbook exists, inspect routes and ask for the minimum missing context needed to open the page.
3. Summarize:
   - Target environment and URL.
   - Target viewport/device, if relevant.
   - Operation or check to run.
   - Required inputs still missing.
   - Expected visible result or assertion.
   - Any state-changing or high-risk behavior.
4. Execute only after required information and risk confirmation are handled.
5. Report final URL, result, verification evidence, console/network issues if checked, screenshot path if requested, and whether the flow was recorded or updated.

## Updating This Skill

When a frontend route or workflow is proven in a real session, update the relevant files:

- `references/operations/index.md` for operation summaries and links only.
- `references/operations/<domain>.md` for reusable playbooks.
- `references/routes.md` for page paths and route parameters.
- `references/runtime-auth.md` for login, account selection, and credential source rules.
- `references/selectors.md` and `references/selectors/<domain>.md` for stable locators.
- `references/assertions.md` and `references/assertions/<domain>.md` for success checks.
- `references/components.md` and `references/components/<domain>.md` for reusable component behavior.
- `references/relationships.md` for dependencies between frontend routes, API data, feature flags, locales, and backend/admin configuration.
- `references/known-issues.md` for redirects, rendering issues, permission issues, browser quirks, and recurring failures.
- `scripts/action-cache.json` and `references/action-cache.md` when a proven check has a reusable script.

If a workflow fails, update failure review docs:

- `FAILURES.md` for the index and high-frequency summary.
- `failure-reviews/common.md` for browser, login/session, rendering, network, selector, cache, or environment failures.
- `failure-reviews/<domain>.md` for page-specific failures.

## Growth Management

- Keep `SKILL.md` focused on workflow rules and reference navigation.
- Store detailed page steps under `references/operations/`.
- Store long selector, assertion, component, and relationship details in references instead of duplicating them.
- If any markdown file approaches 250 lines, split it before adding more content.
- After updating skill knowledge or failure reviews, run `node scripts/maintenance/validate-knowledge-structure.mjs` from the skill root when available.
