# Joker Activity Component Patterns

Business domain:
活动管理 / 小丑牌活动。

Use this file for Joker activity page-specific multilingual and rich-text components. Shared component behavior remains in `../components.md`.

## MultiLangInput Backed By Component State

Status: candidate
Last verified: 2026-05-06

Where it appears:
- Joker activity edit page top-form multilingual fields such as `活动标题`、`活动副标题`、`活动分享文案`、`代理分享文案`、`我的分享文案`、`模块介绍`、`Tab名称`.
- Joker activity table cells such as `牌型说明` and `奖池类型`.

Locator strategy:
- Prefer the field container or table cell, then resolve the nearest `.tabs-wrapper`.
- Treat `.tabs-wrapper.__vue__` as the authoritative `MultiLangInput` instance.
- If present, also resolve nested `.langs-input.__vue__` as the inner `LangInput` instance.

Operation steps:
1. Read the default language value plus any existing `英语` value that should be kept as the translation source.
2. Build the multilingual map before writing.
3. Update the real component model, not just the visible DOM:
   - write `defaultLangValue`,
   - write `langsForm`,
   - if needed also write `formData` on the nested `LangInput`.
4. Force the component to refresh before moving on.
5. After save, open a fresh tab and reload the edit page to verify persisted values from the server.

Success assertion:
- The target `MultiLangInput` instance exposes the translated values in `langsForm`.
- A fresh reload still shows the same values.

Common failure modes:
- Writing only visible `input` or `textarea` values can leave `langsForm` unchanged, so submit keeps old data.
- Some fields keep both `in_ID` and `id_ID`; update both when Indonesian is present.
- Table cells are not top-level `el-form-item`s. Resolve the cell-local `MultiLangInput` instead of scanning only the main form.

Related helpers:
- `../../scripts/lib/element-ui.mjs`

## Quill Rich Text Multilingual Editors

Status: candidate
Last verified: 2026-05-06

Where it appears:
- Joker activity edit page rich-text multilingual sections such as `活动内容规则` and `游戏玩法内容`.

Locator strategy:
- Locate the target form item by label, then enumerate `.ql-editor` roots inside that item.
- Resolve the owning Vue `Editor` instance from `editor.parentElement.parentElement.__vue__`.

Operation steps:
1. Read the source rich text from the default language editor and, when present, the English editor.
2. Decide whether the field should be translated or only synchronized:
   - translate text-rich content such as `活动内容规则`,
   - sync media-rich content such as iframe/video-based `游戏玩法内容`.
3. Update the editor through component state and Quill APIs:
   - set `currentValue`,
   - paste HTML through `Quill.clipboard.dangerouslyPasteHTML(...)`,
   - emit `input` and `change` so the parent form model updates.
4. Save the page.
5. Verify with a fresh reload instead of trusting the current tab's editor state.

Success assertion:
- The updated editors show the new text or HTML in the current tab.
- A fresh reload still shows the expected text or HTML per language.

Common failure modes:
- Editing `.ql-editor.innerHTML` only can leave the Vue form model stale.
- Different fields may use the same editor widget but have different source rules; do not translate iframe/video content as plain text.
- Language order is implicit in the editor list. Confirm the page's actual order before bulk fill.

Related helpers:
- `../../scripts/lib/browser.mjs`
