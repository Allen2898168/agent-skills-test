# Defaults

Use defaults only when the value is low risk or the tester has already approved the default policy.

## Confirmation Required

Always ask before using or changing:
- Activity start time and end time.
- Reward amount, reward type, reward pool, and release rules.
- User scope, UID list, allowlist, blacklist, region, KYC level, or eligibility.
- Enable/disable state.
- Risk-control rules.
- Production environment.
- Delete, batch delete, import, export, reward issuance, or irreversible update.
- Any state change that is protected by a fresh Google verification step, such as activity `上线`.

## Safe Defaults

These can be suggested, but still mention them before execution when creating or editing records:
- Environment: staging.
- Default staging username: `auto`.
- Browser automation visibility: invisible/background by default.
- Screenshot directory: `artifacts/screenshots/<中文业务域>/<中文页面或操作>/`.
- First-time workflow status: `candidate`.
- Secret placeholders: `<USERNAME>`, `<PASSWORD>`, `<GOOGLE_CODE>`.

## Default Confirmation Policy

- Stored defaults are candidate values, not implicit user approval.
- When the user says `用默认配置` or equivalent, first list the proven configurable items for the current chain and show which of them have defaults.
- Ask the user which items should keep defaults and which items should be overridden before executing any state-changing action.
- If the chain has missing verified defaults for a required field, say so explicitly instead of inventing one.
- If the requested combination is unreasonable, conflicts with the proven chain, or is blocked by page/backend validation, explain the issue before execution and wait for updated inputs or confirmation.

## Browser Visibility Defaults

- Run browser automation in invisible/background mode by default.
- Open a headed visible real browser only when the user explicitly asks for visible operation, such as `可见操作`, `打开浏览器操作`, `让我看着操作`, or `真实浏览器可见执行`.
- When visible/browser mode is requested for state-changing work, execute the write through real page UI behavior: click, fill, select, upload, and confirm in the browser. Do not substitute a direct API write for the visible-mode operation.
- API calls in visible/browser mode are allowed only for read-only verification or evidence after the UI action has triggered the write.
- Invisible/background mode may use faster API-assisted execution for proven low-risk staging workflows, as long as business response and result lookup are verified.
- Visible operation changes only how the operation is displayed; it does not replace success assertions. Always verify URL, page text, table/form state, toast/message, API response, or requested screenshot evidence.
- If an invisible run is blocked by browser-only behavior, explain the reason before switching to visible mode.

## Browser Tool Defaults

- Use bundled Playwright scripts as the default path for stored deterministic workflows.
- Use optional `web-access` CDP only when Chrome remote debugging is available and the operation benefits from reusing the user's existing Chrome login state or live browser context.
- If CDP is unavailable, continue with bundled Playwright scripts; `web-access` is not a hard dependency for this skill.
- Bundled prize creation script: `scripts/create-prizes.mjs`.
- Do not pass secrets as command-line arguments. Use `WEEX_ADMIN_PASSWORD` and `WEEX_ADMIN_GOOGLE_CODE` from `skills/weex-admin-ops/.env.local` or same-skill current process environment variables.

## Cached Action Defaults

- Check `scripts/action-cache.json` before manual browser operation.
- Use `scripts/run-cached-action.mjs --query "<user request>" --dry-run` to inspect cache matching without changing backend state.
- If dry-run shows a safe, correct cached command, execute it before conventional exploration.
- If the cached script fails, keep its output as evidence and fall back to bundled Playwright browser automation unless CDP/login-state reuse is required.
- After a fallback succeeds and the fix is reusable, update the cached script or register a new action.
- Do not cache secrets, cookies, tokens, one-time verification codes, personal data, or high-risk business values.

## Script Structure Defaults

- Script entrypoints under `scripts/*.mjs` should stay thin and call reusable modules.
- Shared helpers live under `scripts/lib/`.
- Action-cache helpers live under `scripts/cache/`.
- Business workflows live under `scripts/business/<business-domain>/`.
- Keep individual script files around 180 lines or less; split before crossing 200 lines.
- Reuse common login, Element UI, upload, response-waiting, and table assertion helpers.

## Credential Defaults

- At the start of a new project task that may require login or admin page operation, check whether `WEEX_ADMIN_USERNAME`, `WEEX_ADMIN_PASSWORD`, and `WEEX_ADMIN_GOOGLE_CODE` are present in `skills/weex-admin-ops/.env.local` or same-skill current process environment variables without printing their values.
- If `WEEX_ADMIN_USERNAME` is unavailable and the target is staging, use the staging default username `auto` and state that default explicitly.
- Do not store the default password or Google code in the skill.
- Read the password from `WEEX_ADMIN_PASSWORD`; it is required before login.
- Read the Google code from `WEEX_ADMIN_GOOGLE_CODE`; it is required before login.
- If either `WEEX_ADMIN_PASSWORD` or `WEEX_ADMIN_GOOGLE_CODE` is unavailable, stop before login or state-changing admin operation and ask the user to set the missing environment variable.
- Do not read activity admin credentials from root `.env.local`, other skill directories, `WEEX_FIN_*`, `WEEX_FRONTEND_*`, or legacy fallback variables.
- If an already logged-in page later asks for a Google verification code again during a protected action, such as `上线`, treat that as a fresh required runtime secret:
  - use the current user-provided code for that run, or
  - use `WEEX_ADMIN_GOOGLE_CODE`,
  - but never persist the real code to the repository.

## Activity Defaults

No verified default configuration for creating a newbie activity has been captured yet.

For `活动列表 / 转盘抽奖`:
- `用户报名模版` default fixed value: `【2729】 自动化报名模板_auto_manual_20260505161031`.
- `活动别名` default rule: keep the alias within `10` characters.
- Use longer aliases only when the tester explicitly asks for alias boundary-value testing.
- This default should still be surfaced to the user as part of the configurable-item confirmation step before execution.

When the user asks to create a newbie activity with default configuration:
1. Search `operations.md` for a verified playbook.
2. If no verified playbook exists, ask for the target activity type/page and required high-risk fields.
3. Do not invent reward, time, scope, or enablement settings.

## Roulette Task Defaults

- For `转盘抽奖 / 单一奖励`, if the user does not specify reward range values:
  - default suggested `输入最小数值=10`
  - default suggested `输入最大数值` left blank
- These values must still be shown to the user as defaults and confirmed before execution.
- For `转盘抽奖` task condition defaults, do not suggest or auto-select `kyc任务`.
- `kyc任务` is prohibited for general lottery-task configuration because it hides old-user scenarios.
- If the user asks for a lottery task and does not specify `任务条件1`, prefer a non-KYC branch that is already validated for the current chain, such as `KOL绑定`, or ask the user to choose an explicit non-KYC task type.
- If the chosen task condition or backend rule requires a different prize type, do not keep the default lottery-count reward. Explain the restriction and ask for a valid reward choice.

## Prize Image Defaults

- Prize image directory: `assets/default-prize-images/`.
- Before uploading a prize image, list image files in the directory.
- If exactly one image exists, use it as the default image unless the user asks otherwise.
- If multiple images exist, ask the user which image to use or whether to choose one randomly.
- If no image exists, ask the user to provide an image or explicitly approve creating a safe placeholder image.
- Do not create a new default image on every prize creation attempt.

## Prize Creation Defaults

- For `虚拟积分或资格` prize creation, when a visible configuration field is a dropdown, select the first available option unless the tester specifies another value.
- For low-risk numeric fields used only to make staging test records, use `1` by default.
- For min/max pairs, use a simple valid range such as `1` and `10`.
- Do not use these defaults for reward amount, user scope, activity eligibility, production data, or any field that controls real user impact.
