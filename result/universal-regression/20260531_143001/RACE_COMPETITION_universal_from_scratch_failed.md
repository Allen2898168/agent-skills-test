# 交易竞速赛(RACE_COMPETITION) 通用回归（失败）

- caseId: `RACE_COMPETITION_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T12:30:01.729Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3386",
  "prizeId": "1234",
  "taskId": "6312",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create RACE_COMPETITION activity failed: {"code":401,"msg":"请求访问：/activity/config，认证失败，无法访问系统资源"}`
- ok: `false`

## Links
- 后台交易竞速赛列表: https://stg-activity.weex.tech/activities/speedRace

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3386`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1234`

### ✅ create_race_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6312`

### ✅ auth_refresh_before_create_retry
- ok: `true`
- reason: `create_activity_401`

### ❌ create_race_activity
- alias: `rcr30582735`
- ok: `false`
- response: ```json
{
  "code": 401,
  "msg": "请求访问：/activity/config，认证失败，无法访问系统资源"
}
```
- title: `竞速赛通用回归122942`

### ✅ cleanup_on_failure
- cleanup: ```json
{
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
  "error": "Create RACE_COMPETITION activity failed: {\"code\":401,\"msg\":\"请求访问：/activity/config，认证失败，无法访问系统资源\"}",
  "created": {
    "registerTemplateId": "3386",
    "prizeId": "1234",
    "taskId": "6312",
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
      "registerTemplateId": "3386"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1234"
    },
    {
      "name": "create_race_trading_volume_task_from_scratch",
      "ok": true,
      "taskId": "6312"
    },
    {
      "name": "auth_refresh_before_create_retry",
      "ok": true,
      "reason": "create_activity_401"
    },
    {
      "name": "create_race_activity",
      "ok": false,
      "response": {
        "code": 401,
        "msg": "请求访问：/activity/config，认证失败，无法访问系统资源"
      },
      "alias": "rcr30582735",
      "title": "竞速赛通用回归122942"
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
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
