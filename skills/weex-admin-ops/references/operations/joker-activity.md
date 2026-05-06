# Joker Activity Operations

Use this file for reusable Joker activity (`小丑牌活动`) editing and validation workflows.

Keep route-independent component rules in `../components.md`.
Keep cross-page dependencies in `../relationships.md`.

## Joker Activity Multilingual Fill And Save

Status: candidate
Last verified: 2026-05-06

Goal:
- Read Chinese and English source content from a Joker activity edit page.
- Automatically translate supported multilingual text fields.
- Fill the real form models for top-form fields, table-cell fields, and Quill rich-text fields.
- Save and verify with a fresh reload.

Validated page type:
- Joker activity edit page under `/activities/jokerCard/modal?activityId=<ID>&operation=edit`.

Recommended execution mode:
- Visible browser mode when the tester wants to watch the page.
- CDP browser workflow is acceptable because the page depends on login state and dynamic Vue components.

### Supported multilingual targets

Top-form text fields:
- `活动标题`
- `活动副标题`
- `活动分享文案`
- `代理分享文案`
- `我的分享文案`
- `模块介绍`
- `Tab名称`

Rich-text fields:
- `活动内容规则`
- `游戏玩法内容`

Table multilingual fields:
- `牌型说明`
- `奖池类型`

### Default handling rules

- Translate text fields from the current Chinese and English source values.
- Treat duplicate labels such as `模块介绍` as separate fields in page order; do not merge them.
- For rich text:
  - `活动内容规则`: translate and fill multilingual text.
  - `游戏玩法内容`: if the content is iframe/video HTML rather than plain prose, sync the main HTML across languages instead of producing textual translations.
- Do not auto-process image, video upload, or other media asset multilingual fields unless the user explicitly asks for them.

### Stable workflow

1. Open the Joker activity edit page and confirm the target activity ID before editing.
2. Enumerate multilingual fields by actual DOM structure, not by assumptions from another activity type.
3. Read the current Chinese and English source content first.
4. Build the target language map offline before writing any values.
5. Fill:
   - top-form multilingual text fields through their `MultiLangInput` component state,
   - table multilingual cells through the cell-local `MultiLangInput`,
   - rich-text fields through the Vue `Editor` instance and Quill APIs.
6. Save only after all target sections have been updated.
7. Open a fresh tab to the same edit page and re-read representative values. Treat the fresh reload as the source of truth.

### Validation rules

- Do not trust the current tab alone after editing. The current tab may still hold unsaved or in-memory component state.
- Verify at least one representative language value from each structure type:
  - top-form `MultiLangInput`,
  - table-cell `MultiLangInput`,
  - Quill rich text.
- If a field still shows stale unrelated text after write, inspect `langsForm` and nested `formData`; updating visible inputs alone is not sufficient.

### Known pitfalls

- Some Joker edit pages share generic admin shells with other activity pages; if the tab unexpectedly lands on another activity type after save, reopen the Joker edit route and verify from a fresh tab.
- `牌型说明` and `奖池类型` are table columns, not normal top-form items.
- Some fields expose both visible input controls and hidden component state. Persisted submit values come from the component model.
- Indonesian may appear as `in_ID` or `id_ID` depending on component wiring; update both when needed.

### Related references

- `../components.md`
- `../relationships.md`
- `../routes.md`
