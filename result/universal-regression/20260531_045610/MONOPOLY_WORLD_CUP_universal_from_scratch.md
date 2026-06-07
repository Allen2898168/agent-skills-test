# 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（从零配置）

- caseId: `MONOPOLY_WORLD_CUP_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:56:10.708Z`

## Summary
- activityAlias: `mwcr96164645`
- activityId: `9822`
- cleanup: `true`
- endTime: `2026-06-30 10:57:52`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-05-31 10:57:52`

## Links
- 后台大富翁列表: https://stg-activity.weex.tech/activities/monopoly

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3378`

### ✅ create_virtual_prizes
- created: ```json
[
  {
    "id": "1220",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260531025558",
    "alias": "mwc_v_DICE_mpt6tuul6xf2",
    "prizeSubType": "DICE"
  },
  {
    "id": "1221",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260531025558",
    "alias": "mwc_v_INTEGRAL_mpt6tuul6xf2",
    "prizeSubType": "INTEGRAL"
  },
  {
    "id": "1222",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260531025558",
    "alias": "mwc_v_NO_REWARD_mpt6tuul6xf2",
    "prizeSubType": "NO_REWARD"
  }
]
```
- ok: `true`

### ✅ create_daily_dice_task_from_scratch
- ok: `true`
- taskId: `6296`

### ✅ create_monopoly_activity
- alias: `mwcr96164645`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `大富翁通用回归025604`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "MONOPOLY_WORLD_CUP",
    "applyConfigId": 3378,
    "monopolyListCount": 1,
    "dailyTaskIdFromDetail": 6296
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
      "id": "1220",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1221",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1222",
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
    "activityType": "MONOPOLY_WORLD_CUP",
    "window": {
      "start": "2026-05-31 10:57:52",
      "end": "2026-06-30 10:57:52"
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
      "虚拟奖品(从零)",
      "每日合约交易任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3378",
    "dicePrizeId": "1220",
    "integralPrizeId": "1221",
    "noRewardPrizeId": "1222",
    "dailyDiceTaskId": "6296",
    "activityId": "9822",
    "activityAlias": "mwcr96164645",
    "activityTitle": "大富翁通用回归025604"
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
        "id": "1220",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1221",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1222",
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
