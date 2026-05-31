# 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（失败）

- caseId: `MONOPOLY_WORLD_CUP_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:55:11.628Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3377",
  "dicePrizeId": "1217",
  "integralPrizeId": "1218",
  "noRewardPrizeId": "1219",
  "dailyDiceTaskId": "6295",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create activity failed: {"code":500,"msg":"大富翁活动用户报名模板仅支持用户手动点击报名"}`
- ok: `false`

## Links
- 后台大富翁列表: https://stg-activity.weex.tech/activities/monopoly

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3377`

### ✅ create_virtual_prizes
- created: ```json
[
  {
    "id": "1217",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260531025502",
    "alias": "mwc_v_DICE_mpt6snqtroof",
    "prizeSubType": "DICE"
  },
  {
    "id": "1218",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260531025502",
    "alias": "mwc_v_INTEGRAL_mpt6snqtroof",
    "prizeSubType": "INTEGRAL"
  },
  {
    "id": "1219",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260531025502",
    "alias": "mwc_v_NO_REWARD_mpt6snqtroof",
    "prizeSubType": "NO_REWARD"
  }
]
```
- ok: `true`

### ✅ create_daily_dice_task_from_scratch
- ok: `true`
- taskId: `6295`

### ❌ create_monopoly_activity
- alias: `mwcr96108771`
- ok: `false`
- response: ```json
{
  "code": 500,
  "msg": "大富翁活动用户报名模板仅支持用户手动点击报名"
}
```
- title: `大富翁通用回归025508`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "offline": null,
  "unbindActivity": null,
  "deleteActivity": null,
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
      "id": "1217",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1218",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1219",
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
  "error": "Create activity failed: {\"code\":500,\"msg\":\"大富翁活动用户报名模板仅支持用户手动点击报名\"}",
  "created": {
    "registerTemplateId": "3377",
    "dicePrizeId": "1217",
    "integralPrizeId": "1218",
    "noRewardPrizeId": "1219",
    "dailyDiceTaskId": "6295",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3377"
    },
    {
      "name": "create_virtual_prizes",
      "ok": true,
      "created": [
        {
          "id": "1217",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260531025502",
          "alias": "mwc_v_DICE_mpt6snqtroof",
          "prizeSubType": "DICE"
        },
        {
          "id": "1218",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260531025502",
          "alias": "mwc_v_INTEGRAL_mpt6snqtroof",
          "prizeSubType": "INTEGRAL"
        },
        {
          "id": "1219",
          "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260531025502",
          "alias": "mwc_v_NO_REWARD_mpt6snqtroof",
          "prizeSubType": "NO_REWARD"
        }
      ]
    },
    {
      "name": "create_daily_dice_task_from_scratch",
      "ok": true,
      "taskId": "6295"
    },
    {
      "name": "create_monopoly_activity",
      "ok": false,
      "response": {
        "code": 500,
        "msg": "大富翁活动用户报名模板仅支持用户手动点击报名"
      },
      "alias": "mwcr96108771",
      "title": "大富翁通用回归025508"
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "offline": null,
        "unbindActivity": null,
        "deleteActivity": null,
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
            "id": "1217",
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "id": "1218",
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "id": "1219",
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
        "id": "1217",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1218",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1219",
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
