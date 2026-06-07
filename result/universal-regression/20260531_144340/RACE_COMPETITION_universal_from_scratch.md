# 交易竞速赛(RACE_COMPETITION) 通用回归（从零配置）

- caseId: `RACE_COMPETITION_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T12:43:40.725Z`

## Summary
- activityAlias: `rcr31415071`
- activityId: `9829`
- cleanup: `true`
- endTime: `2026-06-30 20:45:24`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-05-31 20:45:24`

## Links
- 后台交易竞速赛列表: https://stg-activity.weex.tech/activities/speedRace

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3392`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1240`

### ✅ create_race_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6318`

### ✅ create_race_activity
- alias: `rcr31415071`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `竞速赛通用回归124335`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "RACE_COMPETITION",
    "applyConfigId": 3392,
    "stage0TaskId": 6318,
    "stage0PrizeId": 1240
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
  }
}
```
- ok: `true`

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "RACE_COMPETITION",
    "window": {
      "start": "2026-05-31 20:45:24",
      "end": "2026-06-30 20:45:24"
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
      "赠金奖品(从零)",
      "交易量任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3392",
    "prizeId": "1240",
    "taskId": "6318",
    "activityId": "9829",
    "activityAlias": "rcr31415071",
    "activityTitle": "竞速赛通用回归124335"
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
    }
  }
}
```
