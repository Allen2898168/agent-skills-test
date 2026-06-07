# 合约挖矿(CONTRACT_MINING) 通用回归（从零配置）

- caseId: `CONTRACT_MINING_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:33:34.108Z`

## Summary
- activityAlias: `cmr34408120`
- activityId: `9836`
- awardAmount: `1`
- cleanup: `true`
- endTime: `2026-06-30 21:35:17`
- miningReward: `100`
- ok: `true`
- productCode: `10000001`
- startTime: `2026-05-31 21:35:17`

## Links
- 后台合约挖矿列表: https://stg-activity.weex.tech/activities/contractMining/index

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3406`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1252`

### ✅ create_contract_mining_trading_mining_task_from_scratch
- ok: `true`
- taskId: `6335`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_contract_mining_activity
- alias: `cmr34408120`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `合约挖矿通用回归133328`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "CONTRACT_MINING",
    "applyConfigId": 3406,
    "miningListCount": 1,
    "taskId": 6335
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
    "activityType": "CONTRACT_MINING",
    "window": {
      "start": "2026-05-31 21:35:17",
      "end": "2026-06-30 21:35:17"
    },
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "赠金奖品(从零)",
      "挖矿任务(TRADING_MINING，从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3406",
    "prizeId": "1252",
    "taskId": "6335",
    "activityId": "9836",
    "activityAlias": "cmr34408120",
    "activityTitle": "合约挖矿通用回归133328"
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
