# 合约挖矿(CONTRACT_MINING) 通用回归（失败）

- caseId: `CONTRACT_MINING_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:33:00.851Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3405",
  "prizeId": "1251",
  "taskId": "6334",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create CONTRACT_MINING activity failed: {"code":500,"msg":"任务配置重复，请检查"}`
- ok: `false`

## Links
- 后台合约挖矿列表: https://stg-activity.weex.tech/activities/contractMining/index

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3405`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1251`

### ✅ create_contract_mining_trading_mining_task_from_scratch
- ok: `true`
- taskId: `6334`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ❌ create_contract_mining_activity
- alias: `cmr34373123`
- ok: `false`
- response: ```json
{
  "code": 500,
  "msg": "任务配置重复，请检查"
}
```
- title: `合约挖矿通用回归133253`

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
  "error": "Create CONTRACT_MINING activity failed: {\"code\":500,\"msg\":\"任务配置重复，请检查\"}",
  "created": {
    "registerTemplateId": "3405",
    "prizeId": "1251",
    "taskId": "6334",
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
      "registerTemplateId": "3405"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1251"
    },
    {
      "name": "create_contract_mining_trading_mining_task_from_scratch",
      "ok": true,
      "taskId": "6334"
    },
    {
      "name": "refresh_api_session_before_activity_create",
      "ok": true
    },
    {
      "name": "create_contract_mining_activity",
      "ok": false,
      "response": {
        "code": 500,
        "msg": "任务配置重复，请检查"
      },
      "alias": "cmr34373123",
      "title": "合约挖矿通用回归133253"
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
