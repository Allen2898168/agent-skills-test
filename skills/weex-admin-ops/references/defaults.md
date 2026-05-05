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
- Visible operation changes only how the operation is displayed; it does not replace success assertions. Always verify URL, page text, table/form state, toast/message, API response, or requested screenshot evidence.
- If an invisible run is blocked by browser-only behavior, explain the reason before switching to visible mode.

## Browser Tool Defaults

- For networked browser operations, use or follow `web-access` first.
- Prefer `web-access` CDP when Chrome remote debugging is available and user login state should be reused.
- If CDP is unavailable, use bundled Playwright scripts for stored deterministic workflows.
- Bundled prize creation script: `scripts/create-prizes.mjs`.
- Do not pass secrets as command-line arguments. Use `WEEX_ADMIN_PASSWORD` and `WEEX_ADMIN_GOOGLE_CODE`.

## Cached Action Defaults

- Check `scripts/action-cache.json` before manual browser operation.
- Use `scripts/run-cached-action.mjs --query "<user request>" --dry-run` to inspect cache matching without changing backend state.
- If dry-run shows a safe, correct cached command, execute it before conventional exploration.
- If the cached script fails, keep its output as evidence and fall back to `web-access` or normal browser automation.
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

- If the user does not specify an account, use the staging default username `auto`.
- Do not store the default password or Google code in the skill.
- Read the password from `WEEX_ADMIN_PASSWORD` when available.
- Read the Google code from `WEEX_ADMIN_GOOGLE_CODE` when available.
- If either secret is unavailable, ask the user for it at action time.

## Activity Defaults

No verified default configuration for creating a newbie activity has been captured yet.

When the user asks to create a newbie activity with default configuration:
1. Search `operations.md` for a verified playbook.
2. If no verified playbook exists, ask for the target activity type/page and required high-risk fields.
3. Do not invent reward, time, scope, or enablement settings.

## Roulette Task Defaults

- For `转盘抽奖 / 单一奖励`, if the user does not specify reward range values:
  - default suggested `输入最小数值=10`
  - default suggested `输入最大数值` left blank
- These values must still be shown to the user as defaults and confirmed before execution.
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
