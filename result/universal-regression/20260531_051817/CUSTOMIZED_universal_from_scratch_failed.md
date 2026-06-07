# 定制化活动(CUSTOMIZED) 通用回归（失败）

- caseId: `CUSTOMIZED_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T03:18:17.186Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3381",
  "prizeId": "1228",
  "taskId": "6301",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create customized activity failed: {"code":500,"msg":"用户报名模板不可为空"}`
- ok: `false`

## Links
- 后台定制化列表: https://stg-activity.weex.tech/activities/commission

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3381`

### ✅ create_position_airdrop_prize
- ok: `true`
- prizeId: `1228`

### ✅ create_customized_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6301`

### ❌ create_customized_activity
- alias: `czr97494746`
- ok: `false`
- response: ```json
{
  "code": 500,
  "msg": "用户报名模板不可为空"
}
```
- title: `定制活动通用回归031814`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "offline": null,
  "unbindActivity": null,
  "deleteActivity": null,
  "deleteTask": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
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
  "error": "Create customized activity failed: {\"code\":500,\"msg\":\"用户报名模板不可为空\"}",
  "created": {
    "registerTemplateId": "3381",
    "prizeId": "1228",
    "taskId": "6301",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3381"
    },
    {
      "name": "create_position_airdrop_prize",
      "ok": true,
      "prizeId": "1228"
    },
    {
      "name": "create_customized_trading_volume_task_from_scratch",
      "ok": true,
      "taskId": "6301"
    },
    {
      "name": "create_customized_activity",
      "ok": false,
      "response": {
        "code": 500,
        "msg": "用户报名模板不可为空"
      },
      "alias": "czr97494746",
      "title": "定制活动通用回归031814"
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "offline": null,
        "unbindActivity": null,
        "deleteActivity": null,
        "deleteTask": {
          "ok": true,
          "status": 200,
          "body": {
            "code": 200,
            "msg": "操作成功"
          }
        },
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
    "offline": null,
    "unbindActivity": null,
    "deleteActivity": null,
    "deleteTask": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
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
