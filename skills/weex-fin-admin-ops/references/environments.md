# FIN Admin Environments

## Staging

- Web host: `https://stg-admin-web-fin.weex.tech`
- Current airdrop reward product page: `https://stg-admin-web-fin.weex.tech/zh-CN/spotProGrant/airdropRewardProd/`
- Observed API base: `https://stg-admin-fin-app.weex.tech/api`
- Default CDP URL: `http://127.0.0.1:9222`
- Default persistent Chrome profile: `~/.codex/browser-profiles/weex-fin-admin`

## Runtime Auth

- Preferred auth source for current scripts: persistent Chrome profile Local Storage. If an existing FIN tab is open, scripts may read its localStorage; if the FIN tab was closed, scripts read auth directly from the profile files and must not open a new FIN tab/target unless entering explicit login recovery.
- CDP URL override: `WEEX_FIN_CDP_URL`.
- CDP auto-launch toggle: `WEEX_FIN_CDP_AUTO_LAUNCH`; set `false` to require a manually started CDP Chrome.
- CDP headless toggle: `WEEX_FIN_CDP_HEADLESS`; default behavior is headless CDP/profile auth reuse. Set `false` only when a visible FIN login page is required.
- FIN target opening policy: default scripts must not open a new FIN tab/target after the user has logged in and closed the FIN tab. They first reuse an existing FIN tab when present; otherwise they read auth directly from the persistent Chrome profile Local Storage files. `WEEX_FIN_ALLOW_OPEN_TARGET=true` is reserved for explicit login recovery flows such as `fin-auth-check.mjs --wait-for-close`.
- Persistent profile override: `WEEX_FIN_CDP_USER_DATA_DIR`.
- Chrome executable override: `WEEX_FIN_CHROME_EXECUTABLE`.
- FIN page URL override: `WEEX_FIN_PAGE_URL`.
- Local runtime config must live in `skills/weex-fin-admin-ops/.env.local`.
- Approval Google code source: `WEEX_FIN_GOOGLE_CODE`.
- Optional Google OAuth exploration variables: `WEEX_FIN_GOOGLE_USERNAME`, `WEEX_FIN_GOOGLE_PASSWORD`.
- Do not read `WEEX_ADMIN_*` or `WEEX_FRONTEND_*` from this skill.
- Never pass Google code, token, cookie, or fingerprint as CLI arguments.
- Never write raw token, cookie, fingerprint, or Google code to references, docs, failures, or action-cache output. Staging/test UIDs can be printed and recorded in full; production or unspecified-environment identifiers must still be redacted or avoided.

## Persistent CDP Login Behavior

- Before any FIN operation, run `scripts/fin-auth-check.mjs` to verify login state and the basic FIN interface.
- FIN write scripts are CDP/API-assisted, not UI-click automation. After the user logs in and closes the FIN tab, later runs must not reopen a FIN tab/target as long as the persistent profile Local Storage auth is readable and the FIN API check passes.
- Auth resolution order is: existing FIN tab localStorage, then persistent profile Local Storage files, then fail. The only exception is explicit login recovery: if the base check fails and the operator runs `fin-auth-check.mjs --wait-for-close`, the script may open a visible FIN page, wait for the user to log in and close it, then return to no-tab/profile-auth mode.
- `WEEX_FIN_ALLOW_OPEN_TARGET=true` is an internal recovery switch for the visible login flow. Do not set it for normal FIN reads or writes.
- Pure headless execution without opening any FIN page requires a separate trusted API authentication source for token/fingerprint. Do not invent or persist such credentials in docs or scripts.
- The FIN tab does not need to stay open forever. After the user logs in and closes the tab, scripts should continue through profile-file auth when the FIN API check passes.
- After the user logs in once in the persistent CDP Chrome, later scripts must not reopen the FIN page just to read localStorage; they should read the persistent profile files directly.
- If FIN session storage expires or the user logs out, the script opens the FIN page but stops with a login-required error.
- If the base check fails, open the FIN page and ask the user to log in. Keep waiting until the user closes the FIN page; do not stop on a default timeout. Closing the FIN page means user-side handling is complete; re-run the base check after close.
- The visible FIN page is only for invalid or missing login state. After the user closes that login page, all re-checks and business operations must switch back to headless CDP/API mode; do not open another visible FIN tab for normal verification or writes.
- If the re-check still fails, ask whether the user wants to retry. If not, ask whether to continue with any non-FIN work in the current task.
- If the re-check succeeds after close, continue silently in non-visible/headless CDP/API-assisted mode.

## Base Check Commands

```bash
node skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs
```

```bash
node skills/weex-fin-admin-ops/scripts/fin-auth-check.mjs --wait-for-close
```

`--wait-for-close` waits indefinitely by default. Use `--timeout-ms <ms>` only for manual diagnostics.
