# 新手活动(BEGINNER_TASK) 通用回归（失败）

- caseId: `BEGINNER_TASK_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:33:35.055Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3371",
  "multilanguageTemplateId": "107",
  "resourceCardIds": [
    "156",
    "157",
    "158"
  ],
  "taskPackageId": "100",
  "routineTaskPackageId": "101",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create newbie activity failed: {"code":500,"msg":"新手活动的新手任务包和常规活动任务包中的任务不可以重复！重复的任务id：1237,1238,1239"}`
- ok: `false`
- uploadedBannerUrl: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

## Links
- 后台新手活动列表: https://stg-activity.weex.tech/activities/newbie

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3371`

### ✅ create_multilanguage_template
- multilanguageTemplateId: `107`
- ok: `true`

### ✅ create_resource_cards
- ok: `true`
- resourceCardIds: ```json
[
  "156",
  "157",
  "158"
]
```

### ✅ pick_task_ids
- ok: `true`
- picked: ```json
[
  {
    "id": 1239,
    "name": "新手kyc邀请任务 1234",
    "score": 656
  },
  {
    "id": 1238,
    "name": "邀请kyc 33333",
    "score": 656
  },
  {
    "id": 1237,
    "name": "新手活动kyc邀请测试2222",
    "score": 656
  }
]
```

### ✅ create_task_package
- ok: `true`
- taskPackageId: `100`

### ✅ create_routine_task_package
- ok: `true`
- routineTaskPackageId: `101`

### ❌ create_newbie_activity
- alias: `nbreg94801430`
- ok: `false`
- response: ```json
{
  "code": 500,
  "msg": "新手活动的新手任务包和常规活动任务包中的任务不可以重复！重复的任务id：1237,1238,1239"
}
```
- title: `新手通用回归801430`

### ✅ cleanup_on_failure
- cleanup: ```json
{
  "activity": null,
  "taskPackage": {
    "ok": true,
    "id": "100"
  },
  "routineTaskPackage": {
    "ok": true,
    "id": "101"
  },
  "resourceCards": [
    {
      "id": "156",
      "ok": true,
      "error": null
    },
    {
      "id": "157",
      "ok": true,
      "error": null
    },
    {
      "id": "158",
      "ok": true,
      "error": null
    }
  ],
  "multilanguageTemplate": {
    "ok": true,
    "id": "107"
  },
  "registerTemplate": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 401,
      "msg": "请求访问：/activity/apply/3371，认证失败，无法访问系统资源"
    }
  }
}
```
- ok: `true`

## Raw

```json
{
  "error": "Create newbie activity failed: {\"code\":500,\"msg\":\"新手活动的新手任务包和常规活动任务包中的任务不可以重复！重复的任务id：1237,1238,1239\"}",
  "created": {
    "registerTemplateId": "3371",
    "multilanguageTemplateId": "107",
    "resourceCardIds": [
      "156",
      "157",
      "158"
    ],
    "taskPackageId": "100",
    "routineTaskPackageId": "101",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3371"
    },
    {
      "name": "create_multilanguage_template",
      "ok": true,
      "multilanguageTemplateId": "107"
    },
    {
      "name": "create_resource_cards",
      "ok": true,
      "resourceCardIds": [
        "156",
        "157",
        "158"
      ]
    },
    {
      "name": "pick_task_ids",
      "ok": true,
      "picked": [
        {
          "id": 1239,
          "name": "新手kyc邀请任务 1234",
          "score": 656
        },
        {
          "id": 1238,
          "name": "邀请kyc 33333",
          "score": 656
        },
        {
          "id": 1237,
          "name": "新手活动kyc邀请测试2222",
          "score": 656
        }
      ]
    },
    {
      "name": "create_task_package",
      "ok": true,
      "taskPackageId": "100"
    },
    {
      "name": "create_routine_task_package",
      "ok": true,
      "routineTaskPackageId": "101"
    },
    {
      "name": "create_newbie_activity",
      "ok": false,
      "response": {
        "code": 500,
        "msg": "新手活动的新手任务包和常规活动任务包中的任务不可以重复！重复的任务id：1237,1238,1239"
      },
      "alias": "nbreg94801430",
      "title": "新手通用回归801430"
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
        "activity": null,
        "taskPackage": {
          "ok": true,
          "id": "100"
        },
        "routineTaskPackage": {
          "ok": true,
          "id": "101"
        },
        "resourceCards": [
          {
            "id": "156",
            "ok": true,
            "error": null
          },
          {
            "id": "157",
            "ok": true,
            "error": null
          },
          {
            "id": "158",
            "ok": true,
            "error": null
          }
        ],
        "multilanguageTemplate": {
          "ok": true,
          "id": "107"
        },
        "registerTemplate": {
          "ok": false,
          "status": 200,
          "body": {
            "code": 401,
            "msg": "请求访问：/activity/apply/3371，认证失败，无法访问系统资源"
          }
        }
      }
    }
  ],
  "cleanup": {
    "activity": null,
    "taskPackage": {
      "ok": true,
      "id": "100"
    },
    "routineTaskPackage": {
      "ok": true,
      "id": "101"
    },
    "resourceCards": [
      {
        "id": "156",
        "ok": true,
        "error": null
      },
      {
        "id": "157",
        "ok": true,
        "error": null
      },
      {
        "id": "158",
        "ok": true,
        "error": null
      }
    ],
    "multilanguageTemplate": {
      "ok": true,
      "id": "107"
    },
    "registerTemplate": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 401,
        "msg": "请求访问：/activity/apply/3371，认证失败，无法访问系统资源"
      }
    }
  }
}
```
