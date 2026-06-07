# 小活动(TRACE_PRO) 通用回归（从零配置）

- caseId: `TRACE_PRO_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T12:54:06.313Z`

## Summary
- activityAlias: `tpr32038130`
- activityId: `9830`
- cleanup: `true`
- endTime: `2026-06-30 20:55:42`
- ok: `true`
- requiredVolume: `1`
- resourceCards: `3`
- startTime: `2026-05-31 20:55:42`

## Links
- 后台小活动列表: https://stg-activity.weex.tech/activities/tracePro

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3394`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1242`

### ✅ create_tracepro_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6320`

### ✅ create_resource_cards_from_scratch
- count: `3`
- ok: `true`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_trace_pro_activity
- alias: `tpr32038130`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `小活动通用回归125358`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "TRACE_PRO",
    "applyConfigId": 3394,
    "firstMiniTaskId": 6320,
    "resourceCount": 3
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
  },
  "deleteResourceCards": [
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ]
}
```
- ok: `true`

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "TRACE_PRO",
    "window": {
      "start": "2026-05-31 20:55:42",
      "end": "2026-06-30 20:55:42"
    },
    "requiredVolume": 1,
    "resourceCards": 3,
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "赠金奖品(从零)",
      "交易量任务(从零)",
      "资源卡(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3394",
    "prizeId": "1242",
    "taskId": "6320",
    "resourceCardIds": [
      "168",
      "169",
      "170"
    ],
    "activityId": "9830",
    "activityAlias": "tpr32038130",
    "activityTitle": "小活动通用回归125358"
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
    },
    "deleteResourceCards": [
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ]
  }
}
```
