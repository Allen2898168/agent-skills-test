# Evidence

## Default Evidence

Report:
- Final URL.
- Viewport/device.
- Operation result.
- Assertion used.
- Network or console summary only if checked.

## Screenshots

- Save screenshots only when the user explicitly requests screenshots, visual evidence, or screenshot comparison.
- Store screenshots under `artifacts/screenshots/<业务域>/<页面或操作>/`.
- Use descriptive filenames with dates or short operation identifiers.
- Do not include raw screenshots in docs or failure reviews when they expose account, asset, token, link, or personal data.

## Console And Network

- Record only the meaningful summary: endpoint path, status, business code, or error category.
- Redact tokens, cookies, authorization headers, personal data, invite links, and full tracking query strings.
- Distinguish between ignored third-party noise and critical first-party failures.
