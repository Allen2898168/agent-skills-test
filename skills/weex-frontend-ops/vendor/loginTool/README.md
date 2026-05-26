# Bundled loginTool Runtime

This directory contains the minimal WEEX frontend login runtime used by `skills/weex-frontend-ops`.

Included files:

- `weex-login.mjs`
- `weex-auth-cookie.mjs`
- `http.mjs`

The copy is intentionally small and self-contained. `http.mjs` uses Node's built-in `fetch`, so this skill does not require the external `/Users/gabriel/Downloads/weexpr/loginTool` checkout or its `node_modules`.

Do not store passwords, tokens, cookies, API keys, or local `.env.local` values in this directory.
