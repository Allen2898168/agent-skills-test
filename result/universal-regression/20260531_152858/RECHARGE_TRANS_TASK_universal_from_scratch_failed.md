# 充值交易(RECHARGE_TRANS_TASK) 通用回归（失败）

- caseId: `RECHARGE_TRANS_TASK_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:28:58.241Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3400",
  "taskId": "",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `task create failed: Create task failed: {"code":500,"msg":"system error"}`
- ok: `false`

## Links
- 后台充值交易列表: https://stg-activity.weex.tech/activities/depositTrade

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3400`

### ❌ create_recharge_trans_trading_volume_task_from_scratch
- ok: `false`
- taskId: `null`

### ✅ cleanup_on_failure
- cleanup: ```json
{
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
  "error": "task create failed: Create task failed: {\"code\":500,\"msg\":\"system error\"}",
  "created": {
    "registerTemplateId": "3400",
    "taskId": "",
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
      "registerTemplateId": "3400"
    },
    {
      "name": "create_recharge_trans_trading_volume_task_from_scratch",
      "ok": false,
      "taskId": null
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
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
