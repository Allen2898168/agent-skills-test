# 转盘抽奖(LOTTERY) 通用回归（失败）

- caseId: `LOTTERY_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:45:24.877Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3374",
  "prizeId": "1212",
  "taskIds": [
    "6291",
    "6292"
  ],
  "activityId": "9820",
  "activityAlias": "lr95517576",
  "activityTitle": "转盘通用回归517576"
}
```
- error: `online failed: {"code":401,"msg":"请求访问：/activity/lottery/online，认证失败，无法访问系统资源"}`
- ok: `false`

## Links
- 后台转盘抽奖列表: https://stg-activity.weex.tech/activities/lottery

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3374`

### ✅ create_position_airdrop_prize
- ok: `true`
- prizeId: `1212`

### ✅ create_contract_volume_task
- ok: `true`
- taskId: `6291`

### ✅ create_spot_volume_task
- ok: `true`
- taskId: `6292`

### ✅ create_lottery_activity
- alias: `lr95517576`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `转盘通用回归517576`

### ✅ draft_checks
- checks: ```json
{
  "byId": {
    "ok": true,
    "activityId": "9820"
  },
  "byTitle": {
    "ok": true,
    "title": "转盘通用回归517576",
    "activityId": "9820"
  },
  "byAlias": {
    "ok": true,
    "alias": "lr95517576",
    "activityId": "9820"
  },
  "byType": {
    "ok": true,
    "type": "转盘抽奖",
    "activityId": "9820"
  },
  "byDate": {
    "ok": true,
    "start": "2026-05-31 10:47:17",
    "end": "2026-06-30 10:47:17",
    "activityId": "9820"
  }
}
```
- ok: `true`

### ❌ online
- ok: `false`
- response: ```json
{
  "code": 401,
  "msg": "请求访问：/activity/lottery/online，认证失败，无法访问系统资源"
}
```

### ✅ cleanup_on_failure
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
      "id": "6291",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "6292",
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
  "error": "online failed: {\"code\":401,\"msg\":\"请求访问：/activity/lottery/online，认证失败，无法访问系统资源\"}",
  "created": {
    "registerTemplateId": "3374",
    "prizeId": "1212",
    "taskIds": [
      "6291",
      "6292"
    ],
    "activityId": "9820",
    "activityAlias": "lr95517576",
    "activityTitle": "转盘通用回归517576"
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3374"
    },
    {
      "name": "create_position_airdrop_prize",
      "ok": true,
      "prizeId": "1212"
    },
    {
      "name": "create_contract_volume_task",
      "ok": true,
      "taskId": "6291"
    },
    {
      "name": "create_spot_volume_task",
      "ok": true,
      "taskId": "6292"
    },
    {
      "name": "create_lottery_activity",
      "ok": true,
      "response": {
        "code": 200,
        "msg": "操作成功"
      },
      "alias": "lr95517576",
      "title": "转盘通用回归517576"
    },
    {
      "name": "draft_checks",
      "ok": true,
      "checks": {
        "byId": {
          "ok": true,
          "activityId": "9820"
        },
        "byTitle": {
          "ok": true,
          "title": "转盘通用回归517576",
          "activityId": "9820"
        },
        "byAlias": {
          "ok": true,
          "alias": "lr95517576",
          "activityId": "9820"
        },
        "byType": {
          "ok": true,
          "type": "转盘抽奖",
          "activityId": "9820"
        },
        "byDate": {
          "ok": true,
          "start": "2026-05-31 10:47:17",
          "end": "2026-06-30 10:47:17",
          "activityId": "9820"
        }
      }
    },
    {
      "name": "online",
      "ok": false,
      "response": {
        "code": 401,
        "msg": "请求访问：/activity/lottery/online，认证失败，无法访问系统资源"
      }
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
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
            "id": "6291",
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "id": "6292",
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
  ],
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
        "id": "6291",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "6292",
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
