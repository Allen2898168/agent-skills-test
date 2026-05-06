# Activity Register Management Row Actions

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page:
`/activity/register`

References:
- Main page workflow: `activity-register-management.md`
- Components: `../components.md`
- Page-specific components: `../components/activity-register-management.md`
- Cache: `../../scripts/register-template-row-actions.mjs`

## Registration Template Row Actions

Status: candidate
Last verified: 2026-05-06
Verified modes: visible browser, invisible browser

Purpose:
Verify the row operation buttons in `活动用户报名管理`: `查看`, `修改`, and `删除`.

Safe test-data policy:
- Use a newly created temporary all-platform template for this verification.
- Do not run row-action tests against existing business templates unless the tester explicitly names the target and confirms the risk.
- The cached script creates the temporary template, modifies its name, then deletes it before finishing.

Verified flow:
1. Create a temporary template with `平台用户参与范围=全平台用户`, `限制用户参与范围=无`, and `用户报名方式=注册即报名`.
2. Search by the temporary template name and capture the row ID.
3. Click row action `查看`.
4. Verify `GET /prod-api/activity/apply/<id>` returns HTTP 200 with `code=200`.
5. Verify the business dialog title is `用户报名管理（查看）`; do not rely only on `innerText` because disabled input values may not appear there.
6. Close the view dialog.
7. Click row action `修改`.
8. Verify the edit dialog pre-fills `用户管理模板名称`.
9. Change `用户管理模板名称` by appending `_已修改`.
10. Click `确认` and verify `PUT /prod-api/activity/apply` returns HTTP 200 with `code=200`.
11. Search by the modified name and verify the row appears.
12. Click row action `删除`.
13. Verify the second confirmation dialog includes the target template name.
14. Click `确定` and verify `DELETE /prod-api/activity/apply/<id>` returns HTTP 200 with `code=200`.
15. Search by the modified name and verify the row is absent.

Component rule:
- Locate the business dialog by title text such as `用户报名管理（查看）` or `用户报名管理（编辑）`.
- Do not use the last visible `.el-dialog` as the only selector because other visible dialogs may coexist on the page.

Verification records:
- Invisible mode: ID `2773` was created, viewed, renamed, and deleted successfully.
- Invisible script validation: ID `2774` was created, viewed, renamed, and deleted successfully.
- Visible script validation: ID `2775` was created, viewed, renamed, and deleted successfully.

Cached script:
```bash
node scripts/register-template-row-actions.mjs --dry-run
node scripts/register-template-row-actions.mjs
node scripts/register-template-row-actions.mjs --visible
```
