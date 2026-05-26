# Frontend Authentication

## Authentication Browser Mode Rule

Status: verified
Last verified: 2026-05-08

For frontend login and registration, `浏览器模式` means the final authenticated frontend page must be visible or verifiable in a browser context. It does not require manually clicking the login or register form controls unless the user explicitly asks to test the form UI itself.

Required behavior:
- Login: use the proven token-cookie injection path, then open the final logged-in page.
- Registration: use the proven STG registration API path when the user asks for fast account creation, then inject the returned token cookie and open the final logged-in page.
- Do not ask for macOS Accessibility, local device, or computer-assistance permissions for these auth paths.
- If a visible browser is requested, open only the final authenticated page unless the user asks to inspect the captcha/form UI.
- Keep all password, token, cookie, verification-code, and full-account values redacted.

## Domain Playbooks

- Cookie login-state validation: `auth-cookie-login.md`
- Email registration (single + batch): `auth-register-api.md`
- Authenticated asset transfer API: `auth-assets-transfer-api.md`
