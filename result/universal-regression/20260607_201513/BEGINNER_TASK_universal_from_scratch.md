# 新手活动(BEGINNER_TASK) 通用回归（从零配置）

- caseId: `BEGINNER_TASK_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-06-07T18:15:13.429Z`

## 用例信息
- 用例编号: UR-ADMIN-BEGINNER_TASK_universal_from_scratch
- 用例名称: 新手活动(BEGINNER_TASK) 通用回归（从零配置）
- 用例描述: 验证新手活动(BEGINNER_TASK)在 staging 环境从零创建依赖与活动，完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, BEGINNER_TASK

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 执行汇总
- 总体结果: PASS
- 子用例总数: 11
- 通过: 11
- 失败: 0

## 关键输出
- activityAlias: `nbreg56098931`
- activityId: `10096`
- cleanup: `true`
- endTime: `2026-07-08 02:16:32`
- ok: `true`
- startTime: `2026-06-08 02:16:32`
- uploadedBannerUrl: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-02 | create_multilanguage_template | 创建多语言模板（i18n），用于活动文案/FAQ 等多语言配置。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-03 | create_resource_cards | 创建资源卡/道具卡依赖（可能含多张）。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-04 | pick_task_ids | 从任务列表中挑选/定位需要绑定到活动的任务 ID。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-05 | create_task_package | 创建任务包（普通任务包）。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-06 | create_routine_task_package | 创建日常任务包（routine）。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-07 | create_newbie_activity | 从零创建新手活动(BEGINNER_TASK)草稿。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-08 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-09 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-10 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-11 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-01 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3635`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-02 create_multilanguage_template
- 结果: PASS
- 子用例描述: 创建多语言模板（i18n），用于活动文案/FAQ 等多语言配置。
- 预期结果: 创建成功并获得模板 ID；活动创建/编辑可引用。
- 实际结果/证据:
  - multilanguageTemplateId: `118`
  - ok: `true`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-03 create_resource_cards
- 结果: PASS
- 子用例描述: 创建资源卡/道具卡依赖（可能含多张）。
- 预期结果: 创建成功并获得资源卡 ID 列表；可用于活动配置绑定。
- 实际结果/证据:
  - ok: `true`
  - resourceCardIds: ```json
[
  "245",
  "246",
  "247"
]
```

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-04 pick_task_ids
- 结果: PASS
- 子用例描述: 从任务列表中挑选/定位需要绑定到活动的任务 ID。
- 预期结果: 获得有效 taskId 列表，后续可用于活动任务配置。
- 实际结果/证据:
  - mainPicked: ```json
[
  {
    "id": 1239,
    "name": "新手kyc邀请任务 1234",
    "score": 662
  },
  {
    "id": 1238,
    "name": "邀请kyc 33333",
    "score": 662
  },
  {
    "id": 1237,
    "name": "新手活动kyc邀请测试2222",
    "score": 662
  }
]
```
  - ok: `true`
  - picked: ```json
[
  {
    "id": 1239,
    "name": "新手kyc邀请任务 1234",
    "score": 662
  },
  {
    "id": 1238,
    "name": "邀请kyc 33333",
    "score": 662
  },
  {
    "id": 1237,
    "name": "新手活动kyc邀请测试2222",
    "score": 662
  },
  {
    "id": 1193,
    "name": "new15-邀请任务-需要kyc-币种ETH奖励",
    "score": 662
  },
  {
    "id": 1192,
    "name": "new14-邀请任务-需要kyc-体验金奖励",
    "score": 662
  },
  {
    "id": 1191,
    "name": "new13-邀请任务-需要kyc-仓位空投奖励",
    "score": 662
  }
]
```
  - routinePicked: ```json
[
  {
    "id": 1193,
    "name": "new15-邀请任务-需要kyc-币种ETH奖励",
    "score": 662
  },
  {
    "id": 1192,
    "name": "new14-邀请任务-需要kyc-体验金奖励",
    "score": 662
  },
  {
    "id": 1191,
    "name": "new13-邀请任务-需要kyc-仓位空投奖励",
    "score": 662
  }
]
```

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-05 create_task_package
- 结果: PASS
- 子用例描述: 创建任务包（普通任务包）。
- 预期结果: 创建成功并获得任务包 ID；活动创建时可绑定。
- 实际结果/证据:
  - ok: `true`
  - taskPackageId: `120`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-06 create_routine_task_package
- 结果: PASS
- 子用例描述: 创建日常任务包（routine）。
- 预期结果: 创建成功并获得任务包 ID；活动创建时可绑定。
- 实际结果/证据:
  - ok: `true`
  - routineTaskPackageId: `121`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-07 create_newbie_activity
- 结果: PASS
- 子用例描述: 从零创建新手活动(BEGINNER_TASK)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `nbreg56098931`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `新手通用回归098931`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-08 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
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

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-09 online
- 结果: PASS
- 子用例描述: 将活动上线（发布），用于验证上线状态与前端可用性。
- 预期结果: 上线成功；活动状态变为在线/进行中/待开始（取决于时间窗口）。
- 实际结果/证据:
  - ok: `true`
  - status: `ONLINE`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-10 offline
- 结果: PASS
- 子用例描述: 将活动下线（撤销发布），用于验证下线链路与清理前置。
- 预期结果: 下线成功；活动状态变为下线/已撤销。
- 实际结果/证据:
  - ok: `true`
  - status: `OFFLINE`

### UR-ADMIN-BEGINNER_TASK_universal_from_scratch-TC-11 cleanup
- 结果: PASS
- 子用例描述: 清理本次创建的依赖与活动（可选），避免污染环境。
- 预期结果: 尽力删除/解绑创建物；核心对象不再出现在列表回查中。
- 实际结果/证据:
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
      "id": "10096",
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
      "id": "245",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "246",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "247",
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

## Links
- 后台新手活动列表: https://stg-activity.weex.tech/activities/newbie

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "BEGINNER_TASK",
    "window": {
      "start": "2026-06-08 02:16:32",
      "end": "2026-07-08 02:16:32"
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
    "registerTemplateId": "3635",
    "multilanguageTemplateId": "118",
    "resourceCardIds": [
      "245",
      "246",
      "247"
    ],
    "taskPackageId": "120",
    "routineTaskPackageId": "121",
    "activityIds": [
      "10096"
    ],
    "activityId": "10096",
    "activityAlias": "nbreg56098931",
    "activityTitle": "新手通用回归098931"
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
        "id": "10096",
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
        "id": "245",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "246",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "247",
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
