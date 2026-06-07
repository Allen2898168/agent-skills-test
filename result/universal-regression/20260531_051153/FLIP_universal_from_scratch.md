# 小丑牌(FLIP) 通用回归（从零配置）

- caseId: `FLIP_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T03:11:53.835Z`

## Summary
- activityAlias: `flipr97106995`
- activityId: `9824`
- cleanup: `true`
- endTime: `2026-06-30 11:13:29`
- ok: `true`
- startTime: `2026-05-31 11:13:29`

## Links
- 后台小丑牌列表: https://stg-activity.weex.tech/activities/jokerCard/index

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3380`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1225`

### ✅ create_flip_virtual_prizes
- created: ```json
[
  {
    "id": "1226",
    "alias": "VIRTUAL-FLIP_CARD-097422",
    "subtype": "FLIP_CARD",
    "name": "虚拟积分或资格-小丑牌-抽牌次数"
  },
  {
    "id": "1227",
    "alias": "VIRTUAL-FLIP_INTEGRAL-097422",
    "subtype": "FLIP_INTEGRAL",
    "name": "虚拟积分或资格-小丑牌-积分加成"
  }
]
```
- ok: `true`

### ✅ create_flip_card_task_from_scratch
- ok: `true`
- taskId: `6299`

### ✅ create_flip_integral_task_from_scratch
- ok: `true`
- taskId: `6300`

### ✅ create_flip_activity
- alias: `flipr97106995`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `小丑牌通用回归031146`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "FLIP",
    "applyConfigId": 3380,
    "flipsCount": 1,
    "cardTaskIdFromDetail": 6299,
    "integralTaskIdFromDetail": 6300,
    "prizeIdFromDetail": 1225
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
  "deleteTasks": [
    {
      "id": "6299",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "6300",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "deletePrizes": [
    {
      "id": "1225",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1226",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1227",
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
    "activityType": "FLIP",
    "window": {
      "start": "2026-05-31 11:13:29",
      "end": "2026-06-30 11:13:29"
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
      "小丑牌虚拟奖品(从零)",
      "小丑牌邀请任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3380",
    "applyConfigId": "3380",
    "giftCashPrizeId": "1225",
    "virtualFlipCardPrizeId": "1226",
    "virtualFlipIntegralPrizeId": "1227",
    "cardTaskId": "6299",
    "integralTaskId": "6300",
    "activityId": "9824",
    "activityAlias": "flipr97106995",
    "activityTitle": "小丑牌通用回归031146"
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
    "deleteTasks": [
      {
        "id": "6299",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "6300",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "deletePrizes": [
      {
        "id": "1225",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1226",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1227",
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
