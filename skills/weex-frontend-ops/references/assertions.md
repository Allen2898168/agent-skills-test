# Assertions

Do not consider a frontend check successful only because navigation or a click completed. Verify at least one durable signal.

## Baseline Page Load

Success:
- Final URL is the expected route or accepted redirect.
- Expected title, heading, text, component, or route-specific element is visible.
- No blocking error page, blank screen, or login wall appears unless expected.

Failure or blocked:
- Page stays blank after load timeout.
- Visible frontend error, permission page, login requirement, or region restriction appears unexpectedly.
- Critical network request fails and the page cannot render the expected content.

## Frontend Login State

Success:
- `WEEX_TOKEN_COOKIE_STAGING` cookie is present as a boolean assertion only.
- Login form text is absent.
- Account overview, account security text, or `/account` URL is visible.

Failure or blocked:
- Login form remains visible after cookie injection.
- loginTool is missing or cannot produce an auth cookie.
- Required runtime account config is missing.

## Frontend Registration

Success:
- `/v1/user/register/submit` returns business code `00000`.
- Returned token data can build `WEEX_TOKEN_COOKIE_STAGING` without printing token values.
- Account overview opens at `/zh-CN/account` with token cookie present.
- Login form text is absent.

Failure or blocked:
- `register/check` fails to return `serialNO`.
- `register/submit` returns a non-success business code.
- Token-cookie injection succeeds but account overview still shows login form.
- Browser captcha path appears during page automation; use the documented API path only when the user permits API-layer registration.

## Interaction Check

Success:
- The intended UI state changes: menu opens, tab switches, modal appears, form value binds, button enables, toast appears, or next route loads.
- Optional API or event evidence matches the intended action.

Failure or blocked:
- Click is intercepted or has no visible effect.
- Form value appears typed but bound state does not update.
- UI changes only after an unrelated refresh or manual workaround.

## Visual/Layout Check

Success:
- Text is readable and not clipped.
- Interactive controls are visible and reachable.
- Important content does not overlap at the requested viewport.
- Screenshot evidence is saved if requested.

Failure or blocked:
- Content overlaps, disappears, clips, or cannot be interacted with at the requested viewport.
- Screenshot contains sensitive information that cannot be safely shared without redaction.
