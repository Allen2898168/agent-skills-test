# 新手活动(BEGINNER_TASK) 通用回归（从零配置）

- caseId: `BEGINNER_TASK_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:39:55.074Z`

## Summary
- activityAlias: `nbreg95182050`
- activityId: `9818`
- cleanup: `true`
- endTime: `2026-06-30 10:41:18`
- ok: `true`
- startTime: `2026-05-31 10:41:18`
- uploadedBannerUrl: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

## Links
- 后台新手活动列表: https://stg-activity.weex.tech/activities/newbie

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3373`

### ✅ create_multilanguage_template
- multilanguageTemplateId: `109`
- ok: `true`

### ✅ create_resource_cards
- ok: `true`
- resourceCardIds: ```json
[
  "162",
  "163",
  "164"
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
- taskPackageId: `104`

### ✅ create_routine_task_package
- ok: `true`
- routineTaskPackageId: `105`

### ✅ create_newbie_activity
- alias: `nbreg95182050`
- ok: `true`
- response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
- title: `新手通用回归182050`

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

### ✅ cleanup
- cleanup: ```json
{
  "activity": {
    "ok": true,
    "deletes": [
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ]
  },
  "unbindActivities": [
    {
      "id": "9818",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "taskPackage": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "routineTaskPackage": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "resourceCards": [
    {
      "id": "162",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "163",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "164",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "multilanguageTemplate": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "registerTemplate": {
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
    "activityType": "BEGINNER_TASK",
    "window": {
      "start": "2026-05-31 10:41:18",
      "end": "2026-06-30 10:41:18"
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
    "registerTemplateId": "3373",
    "multilanguageTemplateId": "109",
    "resourceCardIds": [
      "162",
      "163",
      "164"
    ],
    "taskPackageId": "104",
    "routineTaskPackageId": "105",
    "activityIds": [
      "9818"
    ],
    "activityId": "9818",
    "activityAlias": "nbreg95182050",
    "activityTitle": "新手通用回归182050"
  },
  "cleanup": {
    "activity": {
      "ok": true,
      "deletes": [
        {
          "ok": true,
          "status": 200,
          "body": {
            "code": 200,
            "msg": "操作成功"
          }
        }
      ]
    },
    "unbindActivities": [
      {
        "id": "9818",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "taskPackage": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "routineTaskPackage": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "resourceCards": [
      {
        "id": "162",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "163",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "164",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "multilanguageTemplate": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "registerTemplate": {
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
