# 代理小活动(AGENT_TRACE_PRO) 通用回归（从零配置）

- caseId: `AGENT_TRACE_PRO_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:02:07.296Z`

## Summary
- activityAlias: `atpr32520655`
- activityId: `9832`
- cleanup: `true`
- endTime: `2026-06-30 21:03:44`
- ok: `true`
- requiredVolume: `1`
- resourceCards: `3`
- startTime: `2026-05-31 21:03:44`

## Links
- 后台代理小活动列表: https://stg-activity.weex.tech/activities/copyTrading

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3396`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1244`

### ✅ create_agent_tracepro_order_volume_task_from_scratch
- ok: `true`
- taskId: `6322`

### ✅ create_resource_cards_from_scratch
- count: `3`
- ok: `true`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_agent_trace_pro_activity
- alias: `atpr32520655`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `代理小活动通用回归130200`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "TRACE_PRO",
    "channelCategory": "AGENT",
    "applyConfigId": 3396,
    "firstMiniTaskId": 6322,
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
    "activityType": "AGENT_TRACE_PRO",
    "window": {
      "start": "2026-05-31 21:03:44",
      "end": "2026-06-30 21:03:44"
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
      "ORDER_VOLUME任务(从零)",
      "资源卡(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3396",
    "prizeId": "1244",
    "taskId": "6322",
    "resourceCardIds": [
      "174",
      "175",
      "176"
    ],
    "activityId": "9832",
    "activityAlias": "atpr32520655",
    "activityTitle": "代理小活动通用回归130200"
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
