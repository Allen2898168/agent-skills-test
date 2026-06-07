# 代理小活动(AGENT_TRACE_PRO) 通用回归（失败）

- caseId: `AGENT_TRACE_PRO_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-06-07T18:24:07.283Z`

## 用例信息
- 用例编号: UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch
- 用例名称: 代理小活动(AGENT_TRACE_PRO) 通用回归（失败）
- 用例描述: 验证代理小活动(AGENT_TRACE_PRO)在 staging 环境从零创建依赖与活动（含任务/资源卡与奖品），完成草稿检查、上线/下线，并按需清理创建物（失败场景输出）。
- 标签: admin, universal-regression, from-scratch, AGENT_TRACE_PRO

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 执行汇总
- 总体结果: FAIL
- 子用例总数: 6
- 通过: 5
- 失败: 1

## 关键输出
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3640",
  "prizeId": "1530",
  "taskId": "7123",
  "resourceCardIds": [],
  "activityId": "",
  "activityAlias": "",
  "activityTitle": ""
}
```
- error: `resource cards create failed: Created resource card not found in list: 资源卡_从零_20260607182403_2`
- ok: `false`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-01 | upload_banner | 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-02 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-03 | create_gift_cash_prize_from_scratch | 从零创建赠金类奖品（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-04 | create_agent_tracepro_order_volume_task_from_scratch | 从零创建代理小活动(AGENT_TRACE_PRO)依赖：订单量任务。 | PASS |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-05 | create_resource_cards_from_scratch | 从零创建资源卡/道具卡类依赖。 | FAIL |
| UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-06 | cleanup_on_failure | 失败场景下的补偿清理，降低环境污染。 | PASS |

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
  - registerTemplateId: `3640`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-03 create_gift_cash_prize_from_scratch
- 结果: PASS
- 子用例描述: 从零创建赠金类奖品（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得奖品 ID；活动创建时可配置该奖品。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1530`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-04 create_agent_tracepro_order_volume_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建代理小活动(AGENT_TRACE_PRO)依赖：订单量任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - ok: `true`
  - taskId: `7123`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-05 create_resource_cards_from_scratch
- 结果: FAIL
- 子用例描述: 从零创建资源卡/道具卡类依赖。
- 预期结果: 创建成功并获得资源卡 ID；活动创建时可绑定/引用。
- 实际结果/证据:
  - count: `null`
  - ok: `false`

### UR-ADMIN-AGENT_TRACE_PRO_universal_from_scratch-TC-06 cleanup_on_failure
- 结果: PASS
- 子用例描述: 失败场景下的补偿清理，降低环境污染。
- 预期结果: 在可执行范围内完成清理或记录清理失败原因。
- 实际结果/证据:
  - cleanup: ```json
{
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
- 后台代理小活动列表: https://stg-activity.weex.tech/activities/copyTrading

## Raw

```json
{
  "error": "resource cards create failed: Created resource card not found in list: 资源卡_从零_20260607182403_2",
  "created": {
    "registerTemplateId": "3640",
    "prizeId": "1530",
    "taskId": "7123",
    "resourceCardIds": [],
    "activityId": "",
    "activityAlias": "",
    "activityTitle": ""
  },
  "steps": [
    {
      "name": "upload_banner",
      "ok": true,
      "url": "https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp"
    },
    {
      "name": "create_register_template_from_scratch",
      "ok": true,
      "registerTemplateId": "3640"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1530"
    },
    {
      "name": "create_agent_tracepro_order_volume_task_from_scratch",
      "ok": true,
      "taskId": "7123"
    },
    {
      "name": "create_resource_cards_from_scratch",
      "ok": false,
      "count": null
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
      "cleanup": {
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
  ],
  "cleanup": {
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
