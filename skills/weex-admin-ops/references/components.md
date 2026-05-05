# Component Operation Reference

Use this file for reusable UI component operation patterns in the WEEX admin.

Business flow steps belong in `operations/`. Stable selectors belong in `selectors/`. Script implementations belong in `scripts/lib/`.

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
- Related helper function path.

## Known Component Patterns

### Element UI Single Select

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Prize category, prize subtype, reward mode, task type, comparison type, VIP type, VIP level, and similar form dropdowns.

Locator strategy:
- Prefer form label plus nearest `.el-select`.
- Select by visible option text inside the currently opened dropdown.

Operation steps:
1. Locate the form item by label.
2. Click its `.el-select` input or suffix icon.
3. Wait for a visible `.el-select-dropdown`.
4. Click the exact visible option text.
5. Wait until the selected text appears in the control or the dependent field updates.

Success assertion:
- The control displays the selected value.
- If the select drives dependent options, the dependent field refreshes before continuing.

Common failure modes:
- Multiple hidden dropdowns exist in the DOM; only interact with the visible dropdown.
- Fuzzy label matching can hit a longer label that contains the same text.

Related helper:
- `scripts/lib/element-ui.mjs`

### Element UI Multi Select With Blur

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Prize `仓位空投` trade-pair selector.
- Activity task filters `标签-转手动发奖` and `报名国家-转手动发奖`.

Locator strategy:
- Prefer form label plus `.el-select`.
- Click the visible tags input or select wrapper, not only the readonly placeholder input.

Operation steps:
1. Open the multi-select.
2. Select one or more exact visible options.
3. Click a blank area in the dialog or page body to collapse the dropdown.
4. Continue only after the dropdown is closed and selected tags are visible.

Success assertion:
- Selected tags are visible in the control.
- For immediate filters, the list API has fired or table content has updated.

Common failure modes:
- Selecting text without choosing a real dropdown option does not bind the value.
- Leaving the dropdown open can block later fields or submit buttons.

Related helper:
- `scripts/lib/element-ui.mjs`

### Multilingual Field Expansion

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Prize name.
- Activity task fields: task name, task content, and task label.

Locator strategy:
- Locate the field label, then click the adjacent multilingual button or icon.
- Fill the default language field and the English field exposed by the multilingual component.

Operation steps:
1. Fill the default field value.
2. Click the multilingual button beside the field.
3. Wait for the multilingual component to appear.
4. Fill `英语` with the requested or default English value.
5. Confirm the component remains associated with the original field.

Success assertion:
- Default and English values are present before submit.
- Submit succeeds and follow-up search/detail shows the default value.

Common failure modes:
- Clicking the wrong multilingual button when several fields expose the same component.
- English tab or row is hidden until the component expands.

Related helper:
- `scripts/lib/element-ui.mjs`

### Image Upload

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Prize add/edit dialogs.
- Lottery activity image fields.

Locator strategy:
- Prefer the specific form item label, then find the file input inside that form item.
- Avoid using the first file input in the whole page when multiple upload components exist.

Operation steps:
1. Check `assets/default-prize-images/` before selecting a file.
2. If one image exists, use it by default; if multiple images exist, ask the user to choose or allow random selection.
3. Set the file on the upload input for the target form item.
4. Wait for `/prod-api/common/uploadImgReplace` or the relevant upload endpoint to return success.
5. Verify the uploaded image preview or bound URL exists.

Success assertion:
- Upload endpoint returns HTTP 200.
- The target upload component shows an uploaded image or bound URL.

Common failure modes:
- Uploading into a hidden or unrelated file input.
- Recreating default images instead of using the existing asset directory.

Related helpers:
- `scripts/lib/element-ui.mjs`
- `scripts/lib/browser.mjs`

### Table Horizontal Scroll

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Activity task management list with many columns.

Locator strategy:
- Locate the active `.el-table__body-wrapper` or horizontal scrollbar for the visible table.

Operation steps:
1. Wait for the table rows to load.
2. Scroll the table body horizontally when validating columns outside the first viewport.
3. Assert the target column header or cell text is visible after scrolling.

Success assertion:
- Target right-side column or cell becomes visible and matches the expected filter/result.

Common failure modes:
- Scrolling the page body instead of the table body.
- Verifying hidden columns before the table finishes rendering.

Related helper:
- `scripts/lib/element-ui.mjs`

### Confirmation Dialog

Status: candidate  
Last verified: 2026-05-04

Where it appears:
- Prize copy and delete actions.

Locator strategy:
- Wait for a visible Element UI message box or dialog containing the expected confirmation text.
- Click the visible confirm button by text such as `确定` or `确认`.

Operation steps:
1. Trigger the row action.
2. Wait for the confirmation dialog.
3. Verify the dialog text matches the intended action.
4. Click confirm only after the action target is clear.
5. Wait for the backend request and page result.

Success assertion:
- Backend action endpoint succeeds.
- The list reflects the expected copied, modified, or deleted state.

Common failure modes:
- Clicking a stale confirm button from another hidden dialog.
- Treating dialog close as success without verifying the list or backend response.

Related helpers:
- `scripts/lib/element-ui.mjs`
- `scripts/lib/browser.mjs`
