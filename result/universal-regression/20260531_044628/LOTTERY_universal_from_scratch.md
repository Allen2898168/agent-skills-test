# 转盘抽奖(LOTTERY) 通用回归（从零配置）

- caseId: `LOTTERY_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:46:28.907Z`

## Summary
- activityAlias: `lr95581009`
- activityId: `9821`
- cleanup: `true`
- endTime: `2026-06-30 10:48:05`
- ok: `true`
- raffleStyle: `EASTER_EGG`
- startTime: `2026-05-31 10:48:05`

## Links
- 后台转盘抽奖列表: https://stg-activity.weex.tech/activities/lottery
- 前台转盘抽奖页: https://stg-www.weex.tech/zh-CN/events/draw/lr95581009

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3375`

### ✅ create_position_airdrop_prize
- ok: `true`
- prizeId: `1213`

### ✅ create_contract_volume_task
- ok: `true`
- taskId: `6293`

### ✅ create_spot_volume_task
- ok: `true`
- taskId: `6294`

### ✅ create_lottery_activity
- alias: `lr95581009`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `转盘通用回归581009`

### ✅ draft_checks
- checks: ```json
{
  "byId": {
    "ok": true,
    "activityId": "9821"
  },
  "byTitle": {
    "ok": true,
    "title": "转盘通用回归581009",
    "activityId": "9821"
  },
  "byAlias": {
    "ok": true,
    "alias": "lr95581009",
    "activityId": "9821"
  },
  "byType": {
    "ok": true,
    "type": "转盘抽奖",
    "activityId": "9821"
  },
  "byDate": {
    "ok": true,
    "start": "2026-05-31 10:48:21",
    "end": "2026-06-30 10:48:21",
    "activityId": "9821"
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
      "id": "6293",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "6294",
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
      "start": "2026-05-31 10:48:05",
      "end": "2026-06-30 10:48:05"
    },
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "奖品(从零)",
      "任务(合约/现货, 复用已沉淀脚本)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3375",
    "prizeId": "1213",
    "taskIds": [
      "6293",
      "6294"
    ],
    "activityId": "9821",
    "activityAlias": "lr95581009",
    "activityTitle": "转盘通用回归581009"
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
        "id": "6293",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "6294",
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
