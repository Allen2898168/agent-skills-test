# 人人代理(AGENT) 通用回归（从零配置）

- caseId: `AGENT_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T13:32:36.919Z`

## Summary
- activityAlias: `agr34349503`
- activityId: `9835`
- awardAmount: `1`
- cleanup: `true`
- endTime: `2026-06-30 21:34:17`
- inviteNetRecharge: `1`
- inviteTradingVolume: `1`
- ok: `true`
- startTime: `2026-05-31 21:34:17`

## Links
- 后台人人代理列表: https://stg-activity.weex.tech/activities/agency

## Steps
### ✅ upload_banner
- ok: `true`
- url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3404`

### ✅ create_gift_cash_prize_from_scratch
- ok: `true`
- prizeId: `1250`

### ✅ create_agent_invite_task_from_scratch
- inviteTaskId: `6333`
- invitedTaskId: `6332`
- ok: `true`

### ✅ refresh_api_session_before_activity_create
- ok: `true`

### ✅ create_agent_activity
- alias: `agr34349503`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `人人代理通用回归133229`

### ✅ draft_checks
- ok: `true`
- verify: ```json
{
  "ok": true,
  "checks": {
    "type": "AGENT",
    "applyConfigId": 3404,
    "inviteTaskId": 6333
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
  "deleteInviteTask": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteInvitedTask": {
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
    "activityType": "AGENT",
    "window": {
      "start": "2026-05-31 21:34:17",
      "end": "2026-06-30 21:34:17"
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
      "邀请/被邀请任务(从零，含 linkTaskId)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3404",
    "prizeId": "1250",
    "invitedTaskId": "6332",
    "inviteTaskId": "6333",
    "activityId": "9835",
    "activityAlias": "agr34349503",
    "activityTitle": "人人代理通用回归133229"
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
    "deleteInviteTask": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteInvitedTask": {
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
