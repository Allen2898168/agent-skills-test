# 代理小活动(AGENT_TRACE_PRO) 通用回归（失败）

- caseId: `AGENT_TRACE_PRO_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:00:51.315Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3395",
  "prizeId": "1243",
  "taskId": "6321",
  "resourceCardIds": [
    "171",
    "172",
    "173"
  ],
  "activityId": "9831",
  "activityAlias": "atpr32445633",
  "activityTitle": "代理小活动通用回归130045"
}
```
- error: `draft-checks failed: {"type":"TRACE_PRO","channelCategory":"AGENT","applyConfigId":3395,"firstMiniTaskId":null,"resourceCount":3}`
- ok: `false`

## Links
- 后台代理小活动列表: https://stg-activity.weex.tech/activities/copyTrading

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3395`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1243`

### ✅ create_agent_tracepro_order_volume_task_from_scratch
- ok: `true`
- taskId: `6321`

### ✅ create_resource_cards_from_scratch
- count: `3`
- ok: `true`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_agent_trace_pro_activity
- alias: `atpr32445633`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `代理小活动通用回归130045`

### ❌ draft_checks
- ok: `false`
- verify: ```json
{
  "ok": false,
  "checks": {
    "type": "TRACE_PRO",
    "channelCategory": "AGENT",
    "applyConfigId": 3395,
    "firstMiniTaskId": null,
    "resourceCount": 3
  }
}
```

### ✅ cleanup_on_failure
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
  "error": "draft-checks failed: {\"type\":\"TRACE_PRO\",\"channelCategory\":\"AGENT\",\"applyConfigId\":3395,\"firstMiniTaskId\":null,\"resourceCount\":3}",
  "created": {
    "registerTemplateId": "3395",
    "prizeId": "1243",
    "taskId": "6321",
    "resourceCardIds": [
      "171",
      "172",
      "173"
    ],
    "activityId": "9831",
    "activityAlias": "atpr32445633",
    "activityTitle": "代理小活动通用回归130045"
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
      "registerTemplateId": "3395"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1243"
    },
    {
      "name": "create_agent_tracepro_order_volume_task_from_scratch",
      "ok": true,
      "taskId": "6321"
    },
    {
      "name": "create_resource_cards_from_scratch",
      "ok": true,
      "count": 3
    },
    {
      "name": "refresh_api_session_before_activity_create",
      "ok": true
    },
    {
      "name": "create_agent_trace_pro_activity",
      "ok": true,
      "response": {
        "code": 200,
        "msg": "操作成功"
      },
      "alias": "atpr32445633",
      "title": "代理小活动通用回归130045"
    },
    {
      "name": "draft_checks",
      "ok": false,
      "verify": {
        "ok": false,
        "checks": {
          "type": "TRACE_PRO",
          "channelCategory": "AGENT",
          "applyConfigId": 3395,
          "firstMiniTaskId": null,
          "resourceCount": 3
        }
      }
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
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
