# Known Issues

## Google Authenticator Binding Redirect

Observed: 2026-05-04

After login, the account can be redirected to:
`/user/profile?tab=googleBind`

Meaning:
- The account may need Google Authenticator binding before accessing some admin pages.

Handling:
1. Report the redirect clearly.
2. Do not attempt to bind Google Authenticator unless the user explicitly asks and provides the necessary confirmation.
3. Retry target navigation only if it is safe; if it redirects again, treat binding as a blocker.
