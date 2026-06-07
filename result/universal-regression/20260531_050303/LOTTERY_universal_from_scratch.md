# 转盘抽奖(LOTTERY) 通用回归（从零配置）

- caseId: `LOTTERY_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T03:03:03.371Z`

## Summary
- activityAlias: `lr96575268`
- activityId: `9823`
- cleanup: `true`
- contractRequiredVolume: `1`
- endTime: `2026-06-30 11:04:36`
- ok: `true`
- raffleStyle: `EASTER_EGG`
- spotRequiredVolume: `1`
- startTime: `2026-05-31 11:04:36`

## Links
- 后台转盘抽奖列表: https://stg-activity.weex.tech/activities/lottery
- 前台转盘抽奖页: https://stg-www.weex.tech/zh-CN/events/draw/lr96575268

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3379`

### ✅ create_position_airdrop_prize
- ok: `true`
- prizeId: `1223`

### ✅ create_lottery_count_prize_from_scratch
- ok: `true`
- prizeId: `1224`

### ✅ create_contract_volume_task_from_scratch
- ok: `true`
- taskId: `6297`

### ✅ create_spot_volume_task_from_scratch
- ok: `true`
- taskId: `6298`

### ✅ create_lottery_activity
- alias: `lr96575268`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `转盘通用回归575268`

### ✅ draft_checks
- checks: ```json
{
  "byId": {
    "ok": true,
    "activityId": "9823"
  },
  "byTitle": {
    "ok": true,
    "title": "转盘通用回归575268",
    "activityId": "9823"
  },
  "byAlias": {
    "ok": true,
    "alias": "lr96575268",
    "activityId": "9823"
  },
  "byType": {
    "ok": true,
    "type": "转盘抽奖",
    "activityId": "9823"
  },
  "byDate": {
    "ok": true,
    "start": "2026-05-31 11:04:55",
    "end": "2026-06-30 11:04:55",
    "activityId": "9823"
  }
}
```
- ok: `true`

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
  "unbindActivity": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "offline": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 500,
      "msg": "任务不是上线状态不可下线"
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
      "id": "6297",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "6298",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "deletePrize": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteLotteryCountPrize": {
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
    "activityType": "LOTTERY",
    "raffleStyle": "EASTER_EGG",
    "window": {
      "start": "2026-05-31 11:04:36",
      "end": "2026-06-30 11:04:36"
    },
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "奖品(仓位空投, 从零)",
      "奖品(抽奖次数, 从零)",
      "任务(合约/现货, 从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3379",
    "prizeId": "1223",
    "lotteryCountPrizeId": "1224",
    "taskIds": [
      "6297",
      "6298"
    ],
    "activityId": "9823",
    "activityAlias": "lr96575268",
    "activityTitle": "转盘通用回归575268"
  },
  "cleanup": {
    "unbindActivity": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "offline": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 500,
        "msg": "任务不是上线状态不可下线"
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
        "id": "6297",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "6298",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "deletePrize": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteLotteryCountPrize": {
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
