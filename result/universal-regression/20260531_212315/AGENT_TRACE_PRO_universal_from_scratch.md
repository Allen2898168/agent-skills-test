# 代理小活动(AGENT_TRACE_PRO) 通用回归（从零配置）

- caseId: `AGENT_TRACE_PRO_universal_from_scratch`
- suite: `universal-regression`
- generatedAt: `2026-05-31T19:23:15.761Z`

## 用例信息
- 用例编号: UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch
- 用例名称: 代理小活动(AGENT_TRACE_PRO) 通用回归（从零配置）
- 用例描述: 验证代理小活动(AGENT_TRACE_PRO)在 staging 环境从零创建依赖与活动（含任务/资源卡与奖品），完成草稿检查、上线/下线，并按需清理创建物。
- 标签: admin, universal-regression, from-scratch, AGENT_TRACE_PRO

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
- activityAlias: `atpr55389072`
- activityId: `9876`
- cleanup: `true`
- endTime: `2026-07-01 03:24:52`
- ok: `true`
- requiredVolume: `1`
- resourceCards: `3`
- startTime: `2026-06-01 03:24:52`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-01 | upload_banner | 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-02 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-03 | create_gift_cash_prize_from_scratch | 从零创建赠金类奖品（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-04 | create_agent_tracepro_order_volume_task_from_scratch | 从零创建代理小活动(AGENT_TRACE_PRO)依赖：订单量任务。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-05 | create_resource_cards_from_scratch | 从零创建资源卡/道具卡类依赖。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-06 | refresh_api_session_before_activity_create | 刷新后管 API 会话，确保后续创建接口具备有效登录态。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-07 | create_agent_trace_pro_activity | 从零创建代理小活动(AGENT_TRACE_PRO)草稿。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-08 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-09 | online | 将活动上线（发布），用于验证上线状态与前端可用性。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-10 | offline | 将活动下线（撤销发布），用于验证下线链路与清理前置。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-11 | cleanup | 清理本次创建的依赖与活动（可选），避免污染环境。 | PASS |

## 子用例明细

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-01 upload_banner
- 结果: PASS
- 子用例描述: 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。
- 预期结果: 上传成功并返回可访问的资源 URL。
- 实际结果/证据:
  - ok: `true`
  - url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-02 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3484`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-03 create_gift_cash_prize_from_scratch
- 结果: PASS
- 子用例描述: 从零创建赠金类奖品（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得奖品 ID；活动创建时可配置该奖品。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1302`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-04 create_agent_tracepro_order_volume_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建代理小活动(AGENT_TRACE_PRO)依赖：订单量任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `6436`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-05 create_resource_cards_from_scratch
- 结果: PASS
- 子用例描述: 从零创建资源卡/道具卡类依赖。
- 预期结果: 创建成功并获得资源卡 ID；活动创建时可绑定/引用。
- 实际结果/证据:
  - count: `3`
  - ok: `true`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-06 refresh_api_session_before_activity_create
- 结果: PASS
- 子用例描述: 刷新后管 API 会话，确保后续创建接口具备有效登录态。
- 预期结果: 会话刷新成功，后续创建接口不再出现登录态/权限错误。
- 实际结果/证据:
  - ok: `true`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-07 create_agent_trace_pro_activity
- 结果: PASS
- 子用例描述: 从零创建代理小活动(AGENT_TRACE_PRO)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `atpr55389072`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `代理小活动通用回归192309`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-08 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - ok: `true`
  - verify: ```json
{
  "ok": true,
  "checks": {
    "type": "TRACE_PRO",
    "channelCategory": "AGENT",
    "applyConfigId": 3484,
    "firstMiniTaskId": 6436,
    "resourceCount": 3
  }
}
```

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-09 online
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

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-10 offline
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

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-11 cleanup
- 结果: PASS
- 子用例描述: 清理本次创建的依赖与活动（可选），避免污染环境。
- 预期结果: 尽力删除/解绑创建物；核心对象不再出现在列表回查中。
- 实际结果/证据:
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
  },
  "deleteResourceCards": [
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    }
  ]
}
```
  - ok: `true`

## Links
- 后台代理小活动列表: https://stg-activity.weex.tech/activities/copyTrading

## Raw

```json
{
  "plan": {
    "mode": "headless_api",
    "activityType": "AGENT_TRACE_PRO",
    "window": {
      "start": "2026-06-01 03:24:52",
      "end": "2026-07-01 03:24:52"
    },
    "requiredVolume": 1,
    "resourceCards": 3,
    "writes": {
      "create": true,
      "online": true,
      "offline": true,
      "cleanup": true
    },
    "dependencies": [
      "报名模板(从零)",
      "赠金奖品(从零)",
      "ORDER_VOLUME任务(从零)",
      "资源卡(从零)",
      "图片上传(uploadImgReplace)"
    ]
  },
  "created": {
    "registerTemplateId": "3484",
    "prizeId": "1302",
    "taskId": "6436",
    "resourceCardIds": [
      "186",
      "187",
      "188"
    ],
    "activityId": "9876",
    "activityAlias": "atpr55389072",
    "activityTitle": "代理小活动通用回归192309"
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
    },
    "deleteResourceCards": [
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      },
      {
        "ok": true,
        "status": 200,
        "body": {
          "code": 200,
          "msg": "操作成功"
        }
      }
    ]
  }
}
```
