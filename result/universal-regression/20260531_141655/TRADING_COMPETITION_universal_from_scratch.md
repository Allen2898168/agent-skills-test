# 交易大赛(TRADING_COMPETITION) 通用回归（从零配置）

- caseId: `TRADING_COMPETITION_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T12:16:55.623Z`

## Summary
- activityAlias: `tcr29809695`
- activityId: `9827`
- cleanup: `true`
- endTime: `2026-06-30 20:18:36`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-05-31 20:18:36`

## Links
- 后台交易大赛列表: https://stg-activity.weex.tech/activities/competition

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3383`

### ✅ create_gift_cash_prize_1_from_scratch
- ok: `true`
- prizeId: `1230`

### ✅ create_gift_cash_prize_2_from_scratch
- ok: `true`
- prizeId: `1231`

### ✅ create_competition_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6309`

### ✅ create_competition_activity
- alias: `tcr29809695`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `交易大赛通用回归121649`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "TRADING_COMPETITION",
    "applyConfigId": 3383,
    "taskIdFromDetail": 6309,
    "prizePoolCount": 2
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
  "offline": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 500,
      "msg": "任务不是上线状态不可下线"
    }
  },
  "unbindActivity": {
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
  "deletePrizes": [
    {
      "id": "1230",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1231",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
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
    "activityType": "TRADING_COMPETITION",
    "window": {
      "start": "2026-05-31 20:18:36",
      "end": "2026-06-30 20:18:36"
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
      "赠金奖品x2(从零)",
      "交易量任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3383",
    "prizeIds": [
      "1230",
      "1231"
    ],
    "taskId": "6309",
    "activityId": "9827",
    "activityAlias": "tcr29809695",
    "activityTitle": "交易大赛通用回归121649"
  },
  "cleanup": {
    "offline": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 500,
        "msg": "任务不是上线状态不可下线"
      }
    },
    "unbindActivity": {
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
    "deletePrizes": [
      {
        "id": "1230",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1231",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
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
