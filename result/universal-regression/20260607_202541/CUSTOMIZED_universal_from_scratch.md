# 定制化活动(CUSTOMIZED) 通用回归（从零配置）

- caseId: `CUSTOMIZED_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-06-07T18:25:41.889Z`

## 用例信息
- 用例编号: UR-ADMIN-CUSTOMIZED_universal_from_scratch
- 用例名称: 定制化活动(CUSTOMIZED) 通用回归（从零配置）
- 用例描述: 验证定制化活动(CUSTOMIZED)在 staging 环境从零创建依赖与活动，完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, CUSTOMIZED

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
- activityAlias: `czr56736041`
- activityId: `10104`
- cleanup: `true`
- endTime: `2026-07-08 02:27:08`
- ok: `true`
- requiredVolume: `1`
- startTime: `2026-06-08 02:27:08`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-02 | create_position_airdrop_prize | 创建仓位空投奖品（position airdrop）。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-03 | create_customized_trading_volume_task_from_scratch | 从零创建定制化活动(CUSTOMIZED)依赖：交易量任务。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-04 | create_customized_activity | 从零创建定制化活动(CUSTOMIZED)草稿。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-05 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-06 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-07 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-08 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-01 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3644`

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-02 create_position_airdrop_prize
- 结果: PASS
- 子用例描述: 创建仓位空投奖品（position airdrop）。
- 预期结果: 创建成功并获得奖品/奖池配置；可被活动引用发放。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1535`

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-03 create_customized_trading_volume_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建定制化活动(CUSTOMIZED)依赖：交易量任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7129`

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-04 create_customized_activity
- 结果: PASS
- 子用例描述: 从零创建定制化活动(CUSTOMIZED)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `czr56736041`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `定制活动通用回归182536`

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-05 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - ok: `true`
  - verify: ```json
{
  "ok": true,
  "checks": {
    "type": "CUSTOMIZED",
    "applyConfigId": 3644,
    "taskIdFromDetail": 7129
  }
}
```

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-06 online
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

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-07 offline
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

### UR-ADMIN-CUSTOMIZED_universal_from_scratch-TC-08 cleanup
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
  }
}
```
  - ok: `true`

## Links
- 后台定制化列表: https://stg-activity.weex.tech/activities/commission

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "CUSTOMIZED",
    "window": {
      "start": "2026-06-08 02:27:08",
      "end": "2026-07-08 02:27:08"
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
      "奖品(仓位空投, 从零)",
      "任务(合约交易量, 从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3644",
    "prizeId": "1535",
    "taskId": "7129",
    "activityId": "10104",
    "activityAlias": "czr56736041",
    "activityTitle": "定制活动通用回归182536"
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
    }
  }
}
```
