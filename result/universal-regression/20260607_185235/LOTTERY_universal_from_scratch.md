# 转盘抽奖(LOTTERY) 通用回归（从零配置）

- caseId: `LOTTERY_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-06-07T16:52:35.638Z`

## 用例信息
- 用例编号: UR-ADMIN-LOTTERY_universal_from_scratch
- 用例名称: 转盘抽奖(LOTTERY) 通用回归（从零配置）
- 用例描述: 验证转盘抽奖(LOTTERY)在 staging 环境从零创建依赖与活动（含合约/现货任务与奖品配置），完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, LOTTERY

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
- activityAlias: `lr51146755`
- activityId: `10042`
- cleanup: `true`
- contractRequiredVolume: `1`
- endTime: `2026-07-08 00:54:08`
- ok: `true`
- raffleStyle: `EASTER_EGG`
- spotRequiredVolume: `1`
- startTime: `2026-06-08 00:54:08`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-01 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-02 | create_position_airdrop_prize | 创建仓位空投奖品（position airdrop）。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-03 | create_lottery_count_prize_from_scratch | 从零创建转盘抽奖(LOTTERY)依赖：抽奖次数奖品/补次数配置。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-04 | create_contract_volume_task_from_scratch | 从零创建合约交易量任务（合约 volume）。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-05 | create_spot_volume_task_from_scratch | 从零创建现货交易量任务（现货 volume）。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-06 | create_lottery_activity | 从零创建转盘抽奖(LOTTERY)草稿。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-07 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-08 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-09 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-LOTTERY_universal_from_scratch-TC-10 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-01 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3561`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-02 create_position_airdrop_prize
- 结果: PASS
- 子用例描述: 创建仓位空投奖品（position airdrop）。
- 预期结果: 创建成功并获得奖品/奖池配置；可被活动引用发放。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1449`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-03 create_lottery_count_prize_from_scratch
- 结果: PASS
- 子用例描述: 从零创建转盘抽奖(LOTTERY)依赖：抽奖次数奖品/补次数配置。
- 预期结果: 创建成功并获得奖品 ID；可用于活动配置抽奖次数奖励。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1450`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-04 create_contract_volume_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建合约交易量任务（合约 volume）。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7040`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-05 create_spot_volume_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建现货交易量任务（现货 volume）。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7041`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-06 create_lottery_activity
- 结果: PASS
- 子用例描述: 从零创建转盘抽奖(LOTTERY)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `lr51146755`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `转盘通用回归146755`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-07 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - checks: ```json
{
  "byId": {
    "ok": true,
    "activityId": "10042"
  },
  "byTitle": {
    "ok": true,
    "title": "转盘通用回归146755",
    "activityId": "10042"
  },
  "byAlias": {
    "ok": true,
    "alias": "lr51146755",
    "activityId": "10042"
  },
  "byType": {
    "ok": true,
    "type": "转盘抽奖",
    "activityId": "10042"
  },
  "byDate": {
    "ok": true,
    "start": "2026-06-08 00:54:26",
    "end": "2026-07-08 00:54:26",
    "activityId": "10042"
  }
}
```
  - ok: `true`

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-08 online
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

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-09 offline
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

### UR-ADMIN-LOTTERY_universal_from_scratch-TC-10 cleanup
- 结果: PASS
- 子用例描述: 清理本次创建的依赖与活动（可选），避免污染环境。
- 预期结果: 尽力删除/解绑创建物；核心对象不再出现在列表回查中。
- 实际结果/证据:
  - cleanup: ```json
{
  "unbindActivity": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "offline": {
    "ok": false,
    "status": 200,
    "body": {
      "code": 500,
      "msg": "任务不是上线状态不可下线"
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
      "id": "7040",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "id": "7041",
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ],
  "deletePrize": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteLotteryCountPrize": {
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
- 后台转盘抽奖列表: https://stg-activity.weex.tech/activities/lottery
- 前台转盘抽奖页: https://stg-www.weex.tech/zh-CN/events/draw/lr51146755

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "LOTTERY",
    "raffleStyle": "EASTER_EGG",
    "window": {
      "start": "2026-06-08 00:54:08",
      "end": "2026-07-08 00:54:08"
    },
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "奖品(仓位空投, 从零)",
      "奖品(抽奖次数, 从零)",
      "任务(合约/现货, 从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3561",
    "prizeId": "1449",
    "lotteryCountPrizeId": "1450",
    "taskIds": [
      "7040",
      "7041"
    ],
    "activityId": "10042",
    "activityAlias": "lr51146755",
    "activityTitle": "转盘通用回归146755"
  },
  "cleanup": {
    "unbindActivity": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "offline": {
      "ok": false,
      "status": 200,
      "body": {
        "code": 500,
        "msg": "任务不是上线状态不可下线"
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
        "id": "7040",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "id": "7041",
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ],
    "deletePrize": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteLotteryCountPrize": {
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
