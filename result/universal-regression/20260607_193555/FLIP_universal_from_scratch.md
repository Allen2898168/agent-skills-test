# 小丑牌(FLIP) 通用回归（从零配置）

- caseId: `FLIP_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-06-07T17:35:55.730Z`

## 用例信息
- 用例编号: UR-ADMIN-FLIP_universal_from_scratch
- 用例名称: 小丑牌(FLIP) 通用回归（从零配置）
- 用例描述: 验证小丑牌(FLIP)在 staging 环境从零创建依赖与活动（含任务与虚拟奖品配置），完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, FLIP

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 执行汇总
- 总体结果: PASS
- 子用例总数: 10
- 通过: 10
- 失败: 0

## 关键输出
- activityAlias: `flipr53748960`
- activityId: `10059`
- cleanup: `true`
- endTime: `2026-07-08 01:37:30`
- ok: `true`
- startTime: `2026-06-08 01:37:30`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-FLIP_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-02 | create_gift_cash_prize_from_scratch | 从零创建赠金类奖品（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-03 | create_flip_virtual_prizes | 创建小丑牌(FLIP)虚拟奖品配置（展示/占位）。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-04 | create_flip_card_task_from_scratch | 从零创建小丑牌活动(FLIP)依赖：翻牌/卡牌任务。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-05 | create_flip_integral_task_from_scratch | 从零创建小丑牌活动(FLIP)依赖：积分/集卡任务。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-06 | create_flip_activity | 从零创建小丑牌活动(FLIP)草稿。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-07 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-08 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-09 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-FLIP_universal_from_scratch-TC-10 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-FLIP_universal_from_scratch-TC-01 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3583`

### UR-ADMIN-FLIP_universal_from_scratch-TC-02 create_gift_cash_prize_from_scratch
- 结果: PASS
- 子用例描述: 从零创建赠金类奖品（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得奖品 ID；活动创建时可配置该奖品。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1468`

### UR-ADMIN-FLIP_universal_from_scratch-TC-03 create_flip_virtual_prizes
- 结果: PASS
- 子用例描述: 创建小丑牌(FLIP)虚拟奖品配置（展示/占位）。
- 预期结果: 创建成功；活动奖池/奖品配置可引用并正确回显。
- 实际结果/证据:
  - created: ```json
[
  {
    "id": "1469",
    "alias": "VIRTUAL-FLIP_CARD-738998",
    "subtype": "FLIP_CARD",
    "name": "虚拟积分或资格-小丑牌-抽牌次数"
  },
  {
    "id": "1470",
    "alias": "VIRTUAL-FLIP_INTEGRAL-738998",
    "subtype": "FLIP_INTEGRAL",
    "name": "虚拟积分或资格-小丑牌-积分加成"
  }
]
```
  - ok: `true`

### UR-ADMIN-FLIP_universal_from_scratch-TC-04 create_flip_card_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建小丑牌活动(FLIP)依赖：翻牌/卡牌任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7066`

### UR-ADMIN-FLIP_universal_from_scratch-TC-05 create_flip_integral_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建小丑牌活动(FLIP)依赖：积分/集卡任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7067`

### UR-ADMIN-FLIP_universal_from_scratch-TC-06 create_flip_activity
- 结果: PASS
- 子用例描述: 从零创建小丑牌活动(FLIP)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `flipr53748960`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `小丑牌通用回归173548`

### UR-ADMIN-FLIP_universal_from_scratch-TC-07 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - ok: `true`
  - verify: ```json
{
  "ok": true,
  "checks": {
    "type": "FLIP",
    "applyConfigId": 3583,
    "flipsCount": 1,
    "cardTaskIdFromDetail": 7066,
    "integralTaskIdFromDetail": 7067,
    "prizeIdFromDetail": 1468
  }
}
```

### UR-ADMIN-FLIP_universal_from_scratch-TC-08 online
- 结果: PASS
- 子用例描述: 将活动上线（发布），用于验证上线状态与前端可用性。
- 预期结果: 上线成功；活动状态变为在线/进行中/待开始（取决于时间窗口）。
- 实际结果/证据:
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```

### UR-ADMIN-FLIP_universal_from_scratch-TC-09 offline
- 结果: PASS
- 子用例描述: 将活动下线（撤销发布），用于验证下线链路与清理前置。
- 预期结果: 下线成功；活动状态变为下线/已撤销。
- 实际结果/证据:
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```

### UR-ADMIN-FLIP_universal_from_scratch-TC-10 cleanup
- 结果: PASS
- 子用例描述: 清理本次创建的依赖与活动（可选），避免污染环境。
- 预期结果: 尽力删除/解绑创建物；核心对象不再出现在列表回查中。
- 实际结果/证据:
  - cleanup: ```json
{
  "offline": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 500,
      "msg": "任务不是上线状态不可下线"
    }
  },
  "unbindActivity": {
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
  "deleteTasks": [
    {
      "id": "7066",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "7067",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "deletePrizes": [
    {
      "id": "1468",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1469",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1470",
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

## Links
- 后台小丑牌列表: https://stg-activity.weex.tech/activities/jokerCard/index

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "FLIP",
    "window": {
      "start": "2026-06-08 01:37:30",
      "end": "2026-07-08 01:37:30"
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
      "小丑牌虚拟奖品(从零)",
      "小丑牌邀请任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3583",
    "applyConfigId": "3583",
    "giftCashPrizeId": "1468",
    "virtualFlipCardPrizeId": "1469",
    "virtualFlipIntegralPrizeId": "1470",
    "cardTaskId": "7066",
    "integralTaskId": "7067",
    "activityId": "10059",
    "activityAlias": "flipr53748960",
    "activityTitle": "小丑牌通用回归173548"
  },
  "cleanup": {
    "offline": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 500,
        "msg": "任务不是上线状态不可下线"
      }
    },
    "unbindActivity": {
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
    "deleteTasks": [
      {
        "id": "7066",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "7067",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "deletePrizes": [
      {
        "id": "1468",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1469",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1470",
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
