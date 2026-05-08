# Common Frontend Checks

## Open Frontend Page And Verify Baseline State

Status: candidate
Last verified: not yet run

Use when the user asks to open a frontend URL and confirm the page is usable.

### Required Inputs

- Target URL.
- Expected page identity: title, heading, known text, route, or component.

### Optional Inputs

- Login/session requirement.
- Locale.
- Viewport/device.
- Screenshot requirement.
- Expected API endpoint or network condition.

### Steps

1. Open the target URL in the requested browser mode.
2. Wait for the page load state and the expected page identity.
3. Check visible page content against the expected assertion.
4. Check console errors and failed network requests when the user asks for health or QA validation.
5. Capture screenshots only when requested.

### Success Assertions

- Final URL matches the target route or expected redirect.
- Expected visible text or component is present.
- No blocking frontend error is visible.
- Optional: no unexpected console errors or failed critical network calls.

### Evidence To Report

- Final URL.
- Viewport/device.
- Visible assertion used.
- Console/network summary if checked.
- Screenshot path if requested.
