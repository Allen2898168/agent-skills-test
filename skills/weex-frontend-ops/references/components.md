# Component Operation Reference

Use this file for reusable frontend component operation patterns. Business flow steps belong in `operations/`. Stable selectors belong in `selectors/`. Script implementations belong in `scripts/lib/`.

## Recording Format

For each component pattern, record:

- Component or pattern name.
- Status: `candidate` or `verified`.
- Last verified date.
- Where it appears.
- Stable locator strategy.
- Operation steps.
- Success assertion.
- Common failure modes.
- Related helper path.

## Known Component Patterns

### Navigation Link Or Tab

Status: candidate
Last verified: not yet run

Locator strategy:
- Prefer role `link` or `tab` with exact visible name.
- Scope to header, footer, side nav, or tablist when duplicate labels exist.

Operation steps:
1. Locate the nav container.
2. Click the exact link or tab.
3. Wait for route, active state, or visible panel content.

Success assertion:
- URL, active tab state, or panel content matches the intended destination.

Common failure modes:
- Mobile menus hide links behind a hamburger/menu button.
- Sticky headers can intercept clicks after scroll.

Related helper:
- Not yet implemented.

### Form Field

Status: candidate
Last verified: not yet run

Locator strategy:
- Prefer label plus input/control.
- Use placeholder only when labels are absent and placeholder text is stable.

Operation steps:
1. Locate the field by label or accessible name.
2. Fill or select the requested value.
3. Blur when validation or formatting depends on focus change.
4. Assert the control value or validation state.

Success assertion:
- The field value is visible and bound.
- Required validation message appears or disappears as expected.

Common failure modes:
- Masked inputs display formatted text while the raw value is invalid.
- Autocomplete overlays intercept submit buttons.

Related helper:
- Not yet implemented.

### Responsive Screenshot Check

Status: candidate
Last verified: not yet run

Locator strategy:
- Define the target viewport and page section before taking screenshots.

Operation steps:
1. Set viewport.
2. Navigate to the route and wait for stable content.
3. Capture screenshot if requested.
4. Inspect visible overlap, clipping, blank areas, and unreachable controls.

Success assertion:
- Content is readable and controls are reachable at the requested viewport.

Common failure modes:
- Late-loading images or animations make screenshots flaky.
- Cookie banners, popups, or sticky widgets cover the target content.

Related helper:
- Not yet implemented.
