# 充值交易(RECHARGE_TRANS_TASK) 通用回归（从零配置）

- caseId: `RECHARGE_TRANS_TASK_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:29:58.188Z`

## Summary
- activityAlias: `rtr34192338`
- activityId: `9834`
- cleanup: `true`
- endTime: `2026-06-30 21:31:44`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-05-31 21:31:44`

## Links
- 后台充值交易列表: https://stg-activity.weex.tech/activities/depositTrade

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3401`

### ✅ create_recharge_trans_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6331`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_recharge_trans_activity
- alias: `rtr34192338`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `充值交易通用回归132952`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "RECHARGE_TRANS_TASK",
    "applyConfigId": 3401,
    "taskId": 6331
  }
}
```

### ✅ online
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```

### ✅ offline
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```

### ✅ cleanup
- cleanup: ```json
{
  "unbind": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteActivity": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteTask": {
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
  "plan": {
    "mode": "headless_api",
    "activityType": "RECHARGE_TRANS_TASK",
    "window": {
      "start": "2026-05-31 21:31:44",
      "end": "2026-06-30 21:31:44"
    },
    "requiredVolume": 1,
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "交易量任务(TRADING_VOLUME，从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3401",
    "taskId": "6331",
    "activityId": "9834",
    "activityAlias": "rtr34192338",
    "activityTitle": "充值交易通用回归132952"
  },
  "cleanup": {
    "unbind": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteActivity": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteTask": {
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
