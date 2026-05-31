# 小活动(TRACE_PRO) 通用回归（失败）

- caseId: `TRACE_PRO_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T12:53:24.807Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3393",
  "prizeId": "1241",
  "taskId": "6319",
  "resourceCardIds": [
    "165",
    "166",
    "167"
  ],
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `apply detail failed: {"code":401,"msg":"请求访问：/activity/apply/3393，认证失败，无法访问系统资源"}`
- ok: `false`

## Links
- 后台小活动列表: https://stg-activity.weex.tech/activities/tracePro

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3393`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1241`

### ✅ create_tracepro_trading_volume_task_from_scratch
- ok: `true`
- taskId: `6319`

### ✅ create_resource_cards_from_scratch
- count: `3`
- ok: `true`

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
  },
  "deleteResourceCards": [
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ]
}
```
- ok: `true`

## Raw

```json
{
  "error": "apply detail failed: {\"code\":401,\"msg\":\"请求访问：/activity/apply/3393，认证失败，无法访问系统资源\"}",
  "created": {
    "registerTemplateId": "3393",
    "prizeId": "1241",
    "taskId": "6319",
    "resourceCardIds": [
      "165",
      "166",
      "167"
    ],
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
      "registerTemplateId": "3393"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1241"
    },
    {
      "name": "create_tracepro_trading_volume_task_from_scratch",
      "ok": true,
      "taskId": "6319"
    },
    {
      "name": "create_resource_cards_from_scratch",
      "ok": true,
      "count": 3
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
        },
        "deleteResourceCards": [
          {
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          },
          {
            "ok": true,
            "status": 200,
            "body": {
              "code": 200,
              "msg": "操作成功"
            }
          }
        ]
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
    },
    "deleteResourceCards": [
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ]
  }
}
```
