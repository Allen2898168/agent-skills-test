# Credentials

Do not store real passwords, Google codes, tokens, cookies, or API keys in this repository or skill.

## Default Staging Login Profile

Use this profile when the user does not provide another account.

- Environment: staging
- Username: `auto`
- Password source: `WEEX_ADMIN_PASSWORD`
- Google code source: `WEEX_ADMIN_GOOGLE_CODE`

Resolution order:
1. User-provided account/password/code in the current request.
2. Environment variables from the current shell.
3. Local untracked `.env.local` file if the active tooling loads it.
4. Ask the user for the missing secret.

Local setup:
1. Copy `.env.example` to `.env.local`.
2. Keep `WEEX_ADMIN_USERNAME=auto` unless using another account.
3. Fill password and Google code locally.
4. Do not commit `.env.local`.
