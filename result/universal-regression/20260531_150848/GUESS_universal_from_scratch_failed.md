# 竞猜大赛(GUESS) 通用回归（失败）

- caseId: `GUESS_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:08:48.725Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3397",
  "prizeId": "1245",
  "integralTaskId": "6324",
  "guessTaskId": "",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `guessTask create failed: Create guessTask failed: {"code":500,"msg":"system error"}`
- ok: `false`

## Links
- 后台竞猜大赛列表: https://stg-activity.weex.tech/activities/guessCompetition

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3397`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1245`

### ✅ create_guess_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6324`

### ❌ create_guess_task_from_scratch
- guessTaskId: `null`
- ok: `false`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "deleteIntegralTask": {
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
  "error": "guessTask create failed: Create guessTask failed: {\"code\":500,\"msg\":\"system error\"}",
  "created": {
    "registerTemplateId": "3397",
    "prizeId": "1245",
    "integralTaskId": "6324",
    "guessTaskId": "",
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
      "registerTemplateId": "3397"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1245"
    },
    {
      "name": "create_guess_trading_volume_task_from_scratch",
      "ok": true,
      "taskId": "6324"
    },
    {
      "name": "create_guess_task_from_scratch",
      "ok": false,
      "guessTaskId": null
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "deleteIntegralTask": {
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
    "deleteIntegralTask": {
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
