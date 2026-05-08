# Known Issues

Use this file for recurring frontend operation issues that should be checked before execution.

## Current Known Issues

- STG cookie login depends on a local loginTool checkout. Configure `WEEX_FRONTEND_LOGIN_TOOL_DIR` in `skills/weex-frontend-ops/.env.local`; if it is unset and `/Users/gabriel/Downloads/weexpr/loginTool` is unavailable, `scripts/check-auth-config.mjs` reports `loginToolFound=false`.

## Recording Format

- Issue:
- Affected page or flow:
- Symptom:
- Cause:
- Workaround:
- Verification:
- Related failure review:
