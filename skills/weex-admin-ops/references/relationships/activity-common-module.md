# Activity Common Module Relationships

## Guide Template Activity Type Controls Create Compatibility

Status: candidate
Last verified: 2026-05-06

Source object:
- Activity type selector in `活动通用模块管理 / 活动流程引导配置`.

Consumer object:
- Guide-template create API `/prod-api/activity/guideTemplate`.

Dependency or limitation:
- The UI lists `暂无特殊配置` with backend value `NONE`.
- Creating a guide template with `activityType=NONE` currently returns HTTP 200 with business `code=500` and does not create a record.
- The cached create script excludes this branch by default and only retests it when `--include-none` is explicitly passed.

Related playbooks:
- `operations/activity-guide-template.md`
