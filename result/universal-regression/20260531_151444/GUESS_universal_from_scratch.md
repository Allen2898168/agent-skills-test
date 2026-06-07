# 竞猜大赛(GUESS) 通用回归（从零配置）

- caseId: `GUESS_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:14:44.589Z`

## Summary
- activityAlias: `gcr33277121`
- activityId: `9833`
- cleanup: `true`
- endTime: `2026-06-30 21:16:23`
- ok: `true`
- requiredIntegral: `1`
- requiredVolume: `1`
- startTime: `2026-05-31 21:16:23`

## Links
- 后台竞猜大赛列表: https://stg-activity.weex.tech/activities/guessCompetition

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3399`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1247`

### ✅ create_guess_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6328`

### ✅ create_guess_task_from_scratch
- guessTaskId: `6329`
- ok: `true`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_guess_activity
- alias: `gcr33277121`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `竞猜大赛通用回归131437`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "GUESS",
    "applyConfigId": 3399,
    "integralTaskId": 6328,
    "guessTaskId": 6329
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
  "deleteIntegralTask": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteGuessTask": {
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
    "activityType": "GUESS",
    "window": {
      "start": "2026-05-31 21:16:23",
      "end": "2026-06-30 21:16:23"
    },
    "requiredVolume": 1,
    "requiredIntegral": 1,
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "赠金奖品(从零)",
      "积分任务(TRADING_VOLUME，从零)",
      "竞猜任务(guessTask，从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3399",
    "prizeId": "1247",
    "integralTaskId": "6328",
    "guessTaskId": "6329",
    "activityId": "9833",
    "activityAlias": "gcr33277121",
    "activityTitle": "竞猜大赛通用回归131437"
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
    "deleteIntegralTask": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteGuessTask": {
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
