# 新手活动(BEGINNER_TASK) 通用回归（失败）

- caseId: `BEGINNER_TASK_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-05-31T02:31:55.499Z`

## Summary
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3370",
  "multilanguageTemplateId": "106",
  "resourceCardIds": [
    "153",
    "154",
    "155"
  ],
  "taskPackageId": "98",
  "routineTaskPackageId": "99",
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `Create newbie activity failed: {"code":401,"msg":"请求访问：/activity/config，认证失败，无法访问系统资源"}`
- ok: `false`
- uploadedBannerUrl: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

## Links
- 后台新手活动列表: https://stg-activity.weex.tech/activities/newbie

## Steps
### ✅ create_register_template_from_scratch
- ok: `true`
- registerTemplateId: `3370`

### ✅ create_multilanguage_template
- multilanguageTemplateId: `106`
- ok: `true`

### ✅ create_resource_cards
- ok: `true`
- resourceCardIds: ```json
[
  "153",
  "154",
  "155"
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
- taskPackageId: `98`

### ✅ create_routine_task_package
- ok: `true`
- routineTaskPackageId: `99`

### ❌ create_newbie_activity
- alias: `nbreg94714417`
- ok: `false`
- response: ```json
{
  "code": 401,
  "msg": "请求访问：/activity/config，认证失败，无法访问系统资源"
}
```
- title: `新手通用回归714417`

## Raw

```json
{
  "error": "Create newbie activity failed: {\"code\":401,\"msg\":\"请求访问：/activity/config，认证失败，无法访问系统资源\"}",
  "created": {
    "registerTemplateId": "3370",
    "multilanguageTemplateId": "106",
    "resourceCardIds": [
      "153",
      "154",
      "155"
    ],
    "taskPackageId": "98",
    "routineTaskPackageId": "99",
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3370"
    },
    {
      "name": "create_multilanguage_template",
      "ok": true,
      "multilanguageTemplateId": "106"
    },
    {
      "name": "create_resource_cards",
      "ok": true,
      "resourceCardIds": [
        "153",
        "154",
        "155"
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
      "taskPackageId": "98"
    },
    {
      "name": "create_routine_task_package",
      "ok": true,
      "routineTaskPackageId": "99"
    },
    {
      "name": "create_newbie_activity",
      "ok": false,
      "response": {
        "code": 401,
        "msg": "请求访问：/activity/config，认证失败，无法访问系统资源"
      },
      "alias": "nbreg94714417",
      "title": "新手通用回归714417"
    }
  ]
}
```
