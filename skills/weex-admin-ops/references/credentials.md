# Credentials

Do not store real passwords, Google codes, tokens, cookies, or API keys in this repository or skill.

## Default Staging Login Profile

Use this profile when the user does not provide another account.

- Environment: staging
- Username source: `WEEX_ADMIN_USERNAME`; fallback username: `auto`
- Password source: `WEEX_ADMIN_PASSWORD`
- Google code source: `WEEX_ADMIN_GOOGLE_CODE`

Resolution order:
1. User-provided account/password/code in the current request.
2. Local untracked `skills/weex-admin-ops/.env.local` file loaded by project tooling.
3. Same-skill `WEEX_ADMIN_*` environment variables from the current shell.
4. If username is still missing, use staging default `auto` and state that default explicitly.
5. If password or Google code is missing, stop before login and ask the user to set the missing environment variable.

Do not read activity admin credentials from the repository root `.env.local`, another skill directory, or non-`WEEX_ADMIN_*` fallback variables.

Local setup:
1. Copy `skills/weex-admin-ops/.env.example` to `skills/weex-admin-ops/.env.local`.
2. Keep `WEEX_ADMIN_USERNAME=auto` unless using another account.
3. Fill `WEEX_ADMIN_PASSWORD` and `WEEX_ADMIN_GOOGLE_CODE` locally; both are required for login operations.
4. Do not commit `skills/weex-admin-ops/.env.local`.

Startup check:
- At the start of a new project task that may require login or admin page operation, check whether `WEEX_ADMIN_USERNAME`, `WEEX_ADMIN_PASSWORD`, and `WEEX_ADMIN_GOOGLE_CODE` are present in `skills/weex-admin-ops/.env.local` or same-skill runtime environment variables.
- Do not print the actual values.
- Missing `WEEX_ADMIN_USERNAME` is allowed only for staging because `auto` is the documented fallback.
- Missing `WEEX_ADMIN_PASSWORD` or `WEEX_ADMIN_GOOGLE_CODE` must be reported before any login or state-changing admin operation.
