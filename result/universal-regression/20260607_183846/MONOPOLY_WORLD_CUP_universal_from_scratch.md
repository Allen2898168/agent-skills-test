# 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（从零配置）

- caseId: `MONOPOLY_WORLD_CUP_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-06-07T16:38:46.406Z`

## 用例信息
- 用例编号: UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch
- 用例名称: 大富翁世界杯(MONOPOLY_WORLD_CUP) 通用回归（从零配置）
- 用例描述: 验证大富翁世界杯(MONOPOLY_WORLD_CUP)在 staging 环境从零创建依赖与活动，完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, MONOPOLY_WORLD_CUP

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 执行汇总
- 总体结果: PASS
- 子用例总数: 8
- 通过: 8
- 失败: 0

## 关键输出
- activityAlias: `mwcr50320332`
- activityId: `10023`
- cleanup: `true`
- endTime: `2026-07-08 00:40:26`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-06-08 00:40:26`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-02 | create_virtual_prizes | 创建虚拟奖品配置（用于展示/奖池占位）。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-03 | create_daily_dice_task_from_scratch | 从零创建大富翁世界杯(MONOPOLY_WORLD_CUP)依赖：每日骰子任务。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-04 | create_monopoly_activity | 从零创建大富翁世界杯(MONOPOLY_WORLD_CUP)草稿。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-05 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-06 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-07 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-08 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-01 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3536`

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-02 create_virtual_prizes
- 结果: PASS
- 子用例描述: 创建虚拟奖品配置（用于展示/奖池占位）。
- 预期结果: 创建成功并可用于活动奖池/奖品配置。
- 实际结果/证据:
  - created: ```json
[
  {
    "id": "1422",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-骰子_20260607163833",
    "alias": "mwc_v_DICE_mq40ao7jy1tq",
    "prizeSubType": "DICE"
  },
  {
    "id": "1423",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-积分_20260607163833",
    "alias": "mwc_v_INTEGRAL_mq40ao7jy1tq",
    "prizeSubType": "INTEGRAL"
  },
  {
    "id": "1424",
    "name": "大富翁-虚拟奖品_虚拟积分或资格-无奖励_20260607163833",
    "alias": "mwc_v_NO_REWARD_mq40ao7jy1tq",
    "prizeSubType": "NO_REWARD"
  }
]
```
  - ok: `true`

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-03 create_daily_dice_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建大富翁世界杯(MONOPOLY_WORLD_CUP)依赖：每日骰子任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7003`

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-04 create_monopoly_activity
- 结果: PASS
- 子用例描述: 从零创建大富翁世界杯(MONOPOLY_WORLD_CUP)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `mwcr50320332`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `大富翁通用回归163840`

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-05 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - ok: `true`
  - verify: ```json
{
  "ok": true,
  "checks": {
    "type": "MONOPOLY_WORLD_CUP",
    "applyConfigId": 3536,
    "monopolyListCount": 1,
    "dailyTaskIdFromDetail": 7003
  }
}
```

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-06 online
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

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-07 offline
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

### UR-ADMIN-MONOPOLY_WORLD_CUP_universal_from_scratch-TC-08 cleanup
- 结果: PASS
- 子用例描述: 清理本次创建的依赖与活动（可选），避免污染环境。
- 预期结果: 尽力删除/解绑创建物；核心对象不再出现在列表回查中。
- 实际结果/证据:
  - cleanup: ```json
{
  "offline": {
    "ok": true,
    "skipped": true,
    "reason": "activity_already_offline"
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
      "id": "1422",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1423",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "1424",
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
- 后台大富翁列表: https://stg-activity.weex.tech/activities/monopoly

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "MONOPOLY_WORLD_CUP",
    "window": {
      "start": "2026-06-08 00:40:26",
      "end": "2026-07-08 00:40:26"
    },
    "requiredVolume": 1,
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "虚拟奖品(从零)",
      "每日合约交易任务(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3536",
    "dicePrizeId": "1422",
    "integralPrizeId": "1423",
    "noRewardPrizeId": "1424",
    "dailyDiceTaskId": "7003",
    "activityId": "10023",
    "activityAlias": "mwcr50320332",
    "activityTitle": "大富翁通用回归163840"
  },
  "cleanup": {
    "offline": {
      "ok": true,
      "skipped": true,
      "reason": "activity_already_offline"
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
        "id": "1422",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1423",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "1424",
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
