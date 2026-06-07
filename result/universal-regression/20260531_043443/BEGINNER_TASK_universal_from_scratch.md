# 新手活动(BEGINNER_TASK) 通用回归（从零配置）

- caseId: `BEGINNER_TASK_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:34:43.273Z`

## Summary
- activityAlias: `nbreg94859509`
- activityId: `9816`
- cleanup: `true`
- endTime: `2026-06-30 10:35:52`
- ok: `true`
- startTime: `2026-05-31 10:35:52`
- uploadedBannerUrl: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

## Links
- 后台新手活动列表: https://stg-activity.weex.tech/activities/newbie

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3372`

### ✅ create_multilanguage_template
- multilanguageTemplateId: `108`
- ok: `true`

### ✅ create_resource_cards
- ok: `true`
- resourceCardIds: ```json
[
  "159",
  "160",
  "161"
]
```

### ✅ pick_task_ids
- mainPicked: ```json
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
  },
  {
    "id": 1193,
    "name": "new15-邀请任务-需要kyc-币种ETH奖励",
    "score": 656
  },
  {
    "id": 1192,
    "name": "new14-邀请任务-需要kyc-体验金奖励",
    "score": 656
  },
  {
    "id": 1191,
    "name": "new13-邀请任务-需要kyc-仓位空投奖励",
    "score": 656
  }
]
```
- routinePicked: ```json
[
  {
    "id": 1193,
    "name": "new15-邀请任务-需要kyc-币种ETH奖励",
    "score": 656
  },
  {
    "id": 1192,
    "name": "new14-邀请任务-需要kyc-体验金奖励",
    "score": 656
  },
  {
    "id": 1191,
    "name": "new13-邀请任务-需要kyc-仓位空投奖励",
    "score": 656
  }
]
```

### ✅ create_task_package
- ok: `true`
- taskPackageId: `102`

### ✅ create_routine_task_package
- ok: `true`
- routineTaskPackageId: `103`

### ✅ create_newbie_activity
- alias: `nbreg94859509`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `新手通用回归859509`

### ✅ draft_checks
- fullConfigChecks: ```json
{
  "hasMultiLanguageTemplateId": true,
  "hasApplyConfigId": true,
  "hasTasks": true,
  "hasResourceCards": true,
  "hasI18n": true,
  "hasFaq": true
}
```
- ok: `true`

### ✅ online
- ok: `true`
- status: `ONLINE`

### ✅ offline
- ok: `true`
- status: `OFFLINE`

### ❌ cleanup
- cleanup: ```json
{
  "activity": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "taskPackage": {
    "ok": false,
    "id": "102"
  },
  "routineTaskPackage": {
    "ok": false,
    "id": "103"
  },
  "resourceCards": [
    {
      "id": "159",
      "ok": true,
      "error": null
    },
    {
      "id": "160",
      "ok": true,
      "error": null
    },
    {
      "id": "161",
      "ok": true,
      "error": null
    }
  ],
  "multilanguageTemplate": {
    "ok": false,
    "id": "108"
  },
  "registerTemplate": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 401,
      "msg": "请求访问：/activity/apply/3372，认证失败，无法访问系统资源"
    }
  }
}
```
- ok: `false`

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "BEGINNER_TASK",
    "window": {
      "start": "2026-05-31 10:35:52",
      "end": "2026-06-30 10:35:52"
    },
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "多语言模板(从零)",
      "资源卡(从零)",
      "任务包(从零, 任务使用现有 all 列表)"
    ]
  },
  "created": {
    "registerTemplateId": "3372",
    "multilanguageTemplateId": "108",
    "resourceCardIds": [
      "159",
      "160",
      "161"
    ],
    "taskPackageId": "102",
    "routineTaskPackageId": "103",
    "activityId": "9816",
    "activityAlias": "nbreg94859509",
    "activityTitle": "新手通用回归859509"
  },
  "cleanup": {
    "activity": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "taskPackage": {
      "ok": false,
      "id": "102"
    },
    "routineTaskPackage": {
      "ok": false,
      "id": "103"
    },
    "resourceCards": [
      {
        "id": "159",
        "ok": true,
        "error": null
      },
      {
        "id": "160",
        "ok": true,
        "error": null
      },
      {
        "id": "161",
        "ok": true,
        "error": null
      }
    ],
    "multilanguageTemplate": {
      "ok": false,
      "id": "108"
    },
    "registerTemplate": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 401,
        "msg": "请求访问：/activity/apply/3372，认证失败，无法访问系统资源"
      }
    }
  }
}
```
