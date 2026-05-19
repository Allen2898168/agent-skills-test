# Visible Character Counter / Maxlength

Status: candidate
Last verified: 2026-05-18

Where it appears:
- Activity task add/edit dialog text fields.
- Activity, prize, and other admin forms that show `0/N` counters or explicit maxlength hints.

Locator strategy:
- Prefer the field-local counter, helper text, or native `maxlength` attribute inside the current form item.
- Re-check both create view and edit view when the page allows it; some pages validate only on edit.

Operation steps:
1. Before filling a text field, inspect whether the form item shows a visible `current/max` counter or a maxlength hint.
2. Record the discovered limit in the active playbook or test notes for that chain.
3. Keep default automation values within the discovered limit unless the current task is explicitly a negative-case test.
4. After save, reopen the edit view when available and confirm the same field does not show red over-limit state.

Success assertion:
- The entered value remains within the visible limit.
- Create and edit views both show non-error counter state for the saved value.

Common failure modes:
- Create accepts an over-limit value but edit shows a red counter or blocks re-save.
- Multilingual text fields can have a different visible limit than the default-language field.
- Assuming one field's limit applies to all sibling fields causes silent over-limit data.

Related helper:
- None yet; inspect per page until a shared helper is justified.
