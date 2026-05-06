# Activity Register Management Bulk Delete

Business domain:
活动通用模块管理 / 活动用户报名管理。

Page:
`/activity/register`

References:
- Main page workflow: `activity-register-management.md`
- Relationships: `../relationships.md`
- Cache: `../../scripts/delete-register-templates-by-operator.mjs`

## Delete Registration Templates By Recent Editor

Status: candidate
Last verified: 2026-05-06
Verified modes: invisible browser deletion, visible browser dry-run, invisible browser dry-run

Purpose:
Delete registration templates whose exact recent editor/operator matches the requested value.

Safety policy:
- This is a destructive bulk operation and must be confirmed by the tester before execution.
- Always run dry-run first and show candidate count, IDs, and fuzzy matches that will be skipped.
- The backend `最近编辑人` search is fuzzy. Only delete rows whose response field `operator` exactly equals the requested operator.
- Do not delete `operator=auto_test` or other fuzzy matches when the request is for `operator=auto`.
- If a template is referenced by an activity, backend deletion returns business failure and the template must remain until the referenced activity is handled explicitly.

Verified flow:
1. Open `/activity/register` after login.
2. Fill search input `最近编辑人` with the requested operator, for example `auto`.
3. Click `搜索` and capture the authorized `/prod-api/activity/apply/list` request headers.
4. Request a larger page size for `/prod-api/activity/apply/list?operator=<operator>&pageNum=1&pageSize=200`.
5. Build candidates from rows where `row.operator === <operator>`.
6. Record fuzzy rows where `row.operator !== <operator>` as skipped.
7. After explicit confirmation, call `DELETE /prod-api/activity/apply/<id>` for each exact candidate.
8. Treat HTTP 200 with business `code=200` as deleted.
9. Preserve HTTP 200 with business failure code as blocked, not deleted.
10. Re-query the same operator and verify no exact candidates remain except blocked records.

Verification record:
- Requested operator: `auto`.
- Initial backend search returned 63 rows.
- Fuzzy skipped row: ID `177`, `operator=auto_test`.
- Exact `operator=auto` candidates: 62.
- Deleted successfully: 61.
- Blocked: ID `2729`, name `自动化报名模板_auto_manual_20260505161031`, backend message indicated activity references `8990,8993`.
- Final re-query: exact `operator=auto` remaining only ID `2729`; fuzzy query still returns skipped ID `177`.
- Cached script dry-run was verified in both invisible and visible browser modes after the destructive run.

Cached script:
```bash
node scripts/delete-register-templates-by-operator.mjs --operator auto --dry-run
node scripts/delete-register-templates-by-operator.mjs --operator auto --confirm-delete
node scripts/delete-register-templates-by-operator.mjs --operator auto --visible --dry-run
```
