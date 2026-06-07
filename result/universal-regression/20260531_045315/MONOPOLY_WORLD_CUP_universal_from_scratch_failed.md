# 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（失败）

- caseId: `MONOPOLY_WORLD_CUP_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:53:15.202Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3376",
  "dicePrizeId": "1214",
  "integralPrizeId": "1215",
  "noRewardPrizeId": "1216",
  "dailyDiceTaskId": "",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `task create failed: Create task failed: {"code":500,"msg":"system error"}`
- ok: `false`

## Links
- 后台大富翁列表: https://stg-activity.weex.tech/activities/monopoly

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3376`

### ✅ create_virtual_prizes
- created: ```json
[
  {
    "id": "1214",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260531025308",
    "alias": "mwc_v_DICE_mpt6q7fw0f4i",
    "prizeSubType": "DICE"
  },
  {
    "id": "1215",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260531025308",
    "alias": "mwc_v_INTEGRAL_mpt6q7fw0f4i",
    "prizeSubType": "INTEGRAL"
  },
  {
    "id": "1216",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260531025308",
    "alias": "mwc_v_NO_REWARD_mpt6q7fw0f4i",
    "prizeSubType": "NO_REWARD"
  }
]
```
- ok: `true`

### ❌ create_daily_dice_task_from_scratch
- ok: `false`
- taskId: `null`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "offline": null,
  "unbindActivity": null,
  "deleteActivity": null,
  "deleteTask": null,
  "deletePrizes": [
    {
      "id": "1214",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1215",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1216",
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
  "error": "task create failed: Create task failed: {\"code\":500,\"msg\":\"system error\"}",
  "created": {
    "registerTemplateId": "3376",
    "dicePrizeId": "1214",
    "integralPrizeId": "1215",
    "noRewardPrizeId": "1216",
    "dailyDiceTaskId": "",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3376"
    },
    {
      "name": "create_virtual_prizes",
      "ok": true,
      "created": [
        {
          "id": "1214",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260531025308",
          "alias": "mwc_v_DICE_mpt6q7fw0f4i",
          "prizeSubType": "DICE"
        },
        {
          "id": "1215",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260531025308",
          "alias": "mwc_v_INTEGRAL_mpt6q7fw0f4i",
          "prizeSubType": "INTEGRAL"
        },
        {
          "id": "1216",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260531025308",
          "alias": "mwc_v_NO_REWARD_mpt6q7fw0f4i",
          "prizeSubType": "NO_REWARD"
        }
      ]
    },
    {
      "name": "create_daily_dice_task_from_scratch",
      "ok": false,
      "taskId": null
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "offline": null,
        "unbindActivity": null,
        "deleteActivity": null,
        "deleteTask": null,
        "deletePrizes": [
          {
            "id": "1214",
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "id": "1215",
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "id": "1216",
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
  ],
  "cleanup": {
    "offline": null,
    "unbindActivity": null,
    "deleteActivity": null,
    "deleteTask": null,
    "deletePrizes": [
      {
        "id": "1214",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1215",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1216",
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
