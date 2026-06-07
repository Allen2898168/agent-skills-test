# 定制化活动(CUSTOMIZED) 通用回归（从零配置）

- caseId: `CUSTOMIZED_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T03:19:08.086Z`

## Summary
- activityAlias: `czr97542669`
- activityId: `9825`
- cleanup: `true`
- endTime: `2026-06-30 11:20:50`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-05-31 11:20:50`

## Links
- 后台定制化列表: https://stg-activity.weex.tech/activities/commission

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3382`

### ✅ create_position_airdrop_prize
- ok: `true`
- prizeId: `1229`

### ✅ create_customized_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6302`

### ✅ create_customized_activity
- alias: `czr97542669`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `定制活动通用回归031902`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "CUSTOMIZED",
    "applyConfigId": 3382,
    "taskIdFromDetail": 6302
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
  "plan": {
    "mode": "headless_api",
    "activityType": "CUSTOMIZED",
    "window": {
      "start": "2026-05-31 11:20:50",
      "end": "2026-06-30 11:20:50"
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
      "奖品(仓位空投, 从零)",
      "任务(合约交易量, 从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3382",
    "prizeId": "1229",
    "taskId": "6302",
    "activityId": "9825",
    "activityAlias": "czr97542669",
    "activityTitle": "定制活动通用回归031902"
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
