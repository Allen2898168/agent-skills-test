# 人人代理(AGENT) 通用回归（失败）

- caseId: `AGENT_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:30:17.673Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3402",
  "prizeId": "1248",
  "invitedTaskId": "",
  "inviteTaskId": "",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `invite task create failed: Create task failed: {"code":500,"msg":"新手任务Tab不允许为空,请选择Tab"}`
- ok: `false`

## Links
- 后台人人代理列表: https://stg-activity.weex.tech/activities/agency

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3402`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1248`

### ❌ create_agent_invite_task_from_scratch
- inviteTaskId: `null`
- invitedTaskId: `null`
- ok: `false`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "deletePrize": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteRegisterTemplate": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  }
}
```
- ok: `true`

## Raw

```json
{
  "error": "invite task create failed: Create task failed: {\"code\":500,\"msg\":\"新手任务Tab不允许为空,请选择Tab\"}",
  "created": {
    "registerTemplateId": "3402",
    "prizeId": "1248",
    "invitedTaskId": "",
    "inviteTaskId": "",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "upload_banner",
      "ok": true,
      "url": "https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp"
    },
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3402"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1248"
    },
    {
      "name": "create_agent_invite_task_from_scratch",
      "ok": false,
      "inviteTaskId": null,
      "invitedTaskId": null
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "deletePrize": {
          "ok": true,
          "status": 200,
          "body": {
            "code": 200,
            "msg": "操作成功"
          }
        },
        "deleteRegisterTemplate": {
          "ok": true,
          "status": 200,
          "body": {
            "code": 200,
            "msg": "操作成功"
          }
        }
      }
    }
  ],
  "cleanup": {
    "deletePrize": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteRegisterTemplate": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  }
}
```
