# Selectors

Use this file for shared selector strategy. Page-specific selectors belong in `references/selectors/<domain>.md`.

## Selector Priority

1. Accessible role and name, such as button/link/input names.
2. Stable visible text scoped to a section.
3. Stable form label plus nearby input/control.
4. Test IDs or stable data attributes.
5. CSS selectors only when the DOM structure is stable and documented.

## Rules

- Scope selectors to the smallest reliable container.
- Avoid global first-match selectors on pages with repeated cards, tabs, modals, or lists.
- Prefer exact text when choosing buttons, tabs, and menu items.
- Record viewport-specific selectors separately if the mobile layout changes DOM structure.
- Do not record selectors that include user-specific data, tokens, dynamic IDs, or full query strings.
