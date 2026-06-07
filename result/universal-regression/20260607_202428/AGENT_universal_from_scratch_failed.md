# 人人代理(AGENT) 通用回归（失败）

- caseId: `AGENT_universal_from_scratch_failed`
- suite: `universal-regression`
- generatedAt: `2026-06-07T18:24:28.165Z`

## 用例信息
- 用例编号: UR-ADMIN-AGENT_universal_from_scratch
- 用例名称: 人人代理(AGENT) 通用回归（失败）
- 用例描述: 验证人人代理(AGENT)在 staging 环境从零创建依赖与活动（含邀请/被邀请任务与奖品），完成草稿检查、上线/下线，并按需清理创建物（失败场景输出）。
- 标签: admin, universal-regression, from-scratch, AGENT

## 前置条件
- 环境：staging 活动后台可访问（默认 https://stg-activity.weex.tech）
- 已配置并可登录：skills/weex-admin-ops/.env.local（WEEX_ADMIN_USERNAME/WEEX_ADMIN_PASSWORD/WEEX_ADMIN_GOOGLE_CODE）
- 账号具备活动/任务/奖品/资源等配置权限
- 如启用 --cleanup：账号具备删除/解绑权限

## 执行汇总
- 总体结果: FAIL
- 子用例总数: 9
- 通过: 8
- 失败: 1

## 关键输出
- cleanup: `true`
- created: ```json
{
  "registerTemplateId": "3641",
  "prizeId": "1531",
  "invitedTaskId": "7125",
  "inviteTaskId": "7126",
  "activityId": "10101",
  "activityAlias": "agr56661215",
  "activityTitle": "人人代理通用回归182421"
}
```
- error: `precondition failed: existing online AGENT activity 9978 (allming-6233470)`
- ok: `false`

## 子用例清单

| 编号 | 子用例名称 | 子用例描述 | 结果 |
| --- | --- | --- | --- |
| UR-ADMIN-AGENT_universal_from_scratch-TC-01 | upload_banner | 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-02 | create_register_template_from_scratch | 从零创建报名模板（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-03 | create_gift_cash_prize_from_scratch | 从零创建赠金类奖品（不 clone），作为活动依赖。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-04 | create_agent_invite_task_from_scratch | 从零创建人人代理(AGENT)依赖：邀请任务。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-05 | refresh_api_session_before_activity_create | 刷新后管 API 会话，确保后续创建接口具备有效登录态。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-06 | create_agent_activity | 从零创建人人代理(AGENT)草稿。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-07 | draft_checks | 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。 | PASS |
| UR-ADMIN-AGENT_universal_from_scratch-TC-08 | precheck_online_agent_conflict | 执行子步骤：precheck_online_agent_conflict | FAIL |
| UR-ADMIN-AGENT_universal_from_scratch-TC-09 | cleanup_on_failure | 失败场景下的补偿清理，降低环境污染。 | PASS |

## 子用例明细

### UR-ADMIN-AGENT_universal_from_scratch-TC-01 upload_banner
- 结果: PASS
- 子用例描述: 上传活动 Banner/资源图，获取可用于活动配置的图片 URL。
- 预期结果: 上传成功并返回可访问的资源 URL。
- 实际结果/证据:
  - ok: `true`
  - url: `https://stg-admin-oss.weex.tech/otc/images/banner/d297e9486586764f7796ccedc2f6a35066f00b33d69ed01e002cfddd2f22cda8.webp`

### UR-ADMIN-AGENT_universal_from_scratch-TC-02 create_register_template_from_scratch
- 结果: PASS
- 子用例描述: 从零创建报名模板（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得模板 ID；活动创建时可绑定该模板。
- 实际结果/证据:
  - ok: `true`
  - registerTemplateId: `3641`

### UR-ADMIN-AGENT_universal_from_scratch-TC-03 create_gift_cash_prize_from_scratch
- 结果: PASS
- 子用例描述: 从零创建赠金类奖品（不 clone），作为活动依赖。
- 预期结果: 创建成功并获得奖品 ID；活动创建时可配置该奖品。
- 实际结果/证据:
  - ok: `true`
  - prizeId: `1531`

### UR-ADMIN-AGENT_universal_from_scratch-TC-04 create_agent_invite_task_from_scratch
- 结果: PASS
- 子用例描述: 从零创建人人代理(AGENT)依赖：邀请任务。
- 预期结果: 创建成功并获得 taskId；可绑定到活动任务配置。
- 实际结果/证据:
  - inviteTaskId: `7126`
  - invitedTaskId: `7125`
  - ok: `true`

### UR-ADMIN-AGENT_universal_from_scratch-TC-05 refresh_api_session_before_activity_create
- 结果: PASS
- 子用例描述: 刷新后管 API 会话，确保后续创建接口具备有效登录态。
- 预期结果: 会话刷新成功，后续创建接口不再出现登录态/权限错误。
- 实际结果/证据:
  - ok: `true`

### UR-ADMIN-AGENT_universal_from_scratch-TC-06 create_agent_activity
- 结果: PASS
- 子用例描述: 从零创建人人代理(AGENT)草稿。
- 预期结果: 创建成功并获得 activityId/activityAlias；可进入草稿检查/上下线流程。
- 实际结果/证据:
  - alias: `agr56661215`
  - ok: `true`
  - response: ```json
{
  "code": 200,
  "msg": "操作成功"
}
```
  - title: `人人代理通用回归182421`

### UR-ADMIN-AGENT_universal_from_scratch-TC-07 draft_checks
- 结果: PASS
- 子用例描述: 执行草稿态检查（draft-checks），校验活动配置完整性与必填项。
- 预期结果: 检查通过；fullConfigChecks 无阻塞项。
- 实际结果/证据:
  - ok: `true`
  - verify: ```json
{
  "ok": true,
  "checks": {
    "type": "AGENT",
    "applyConfigId": 3641,
    "inviteTaskId": 7126
  }
}
```

### UR-ADMIN-AGENT_universal_from_scratch-TC-08 precheck_online_agent_conflict
- 结果: FAIL
- 子用例描述: 执行子步骤：precheck_online_agent_conflict
- 预期结果: 接口返回成功并通过回查验证。
- 实际结果/证据:
  - existingOnline: ```json
{
  "id": "9978",
  "alias": "allming-6233470",
  "status": "ONLINE"
}
```
  - ok: `false`

### UR-ADMIN-AGENT_universal_from_scratch-TC-09 cleanup_on_failure
- 结果: PASS
- 子用例描述: 失败场景下的补偿清理，降低环境污染。
- 预期结果: 在可执行范围内完成清理或记录清理失败原因。
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
  "deleteInviteTask": {
    "ok": true,
    "status": 200,
    "body": {
      "code": 200,
      "msg": "操作成功"
    }
  },
  "deleteInvitedTask": {
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
- 后台人人代理列表: https://stg-activity.weex.tech/activities/agency

## Raw

```json
{
  "error": "precondition failed: existing online AGENT activity 9978 (allming-6233470)",
  "created": {
    "registerTemplateId": "3641",
    "prizeId": "1531",
    "invitedTaskId": "7125",
    "inviteTaskId": "7126",
    "activityId": "10101",
    "activityAlias": "agr56661215",
    "activityTitle": "人人代理通用回归182421"
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
      "registerTemplateId": "3641"
    },
    {
      "name": "create_gift_cash_prize_from_scratch",
      "ok": true,
      "prizeId": "1531"
    },
    {
      "name": "create_agent_invite_task_from_scratch",
      "ok": true,
      "inviteTaskId": "7126",
      "invitedTaskId": "7125"
    },
    {
      "name": "refresh_api_session_before_activity_create",
      "ok": true
    },
    {
      "name": "create_agent_activity",
      "ok": true,
      "response": {
        "code": 200,
        "msg": "操作成功"
      },
      "alias": "agr56661215",
      "title": "人人代理通用回归182421"
    },
    {
      "name": "draft_checks",
      "ok": true,
      "verify": {
        "ok": true,
        "checks": {
          "type": "AGENT",
          "applyConfigId": 3641,
          "inviteTaskId": 7126
        }
      }
    },
    {
      "name": "precheck_online_agent_conflict",
      "ok": false,
      "existingOnline": {
        "id": "9978",
        "alias": "allming-6233470",
        "status": "ONLINE"
      }
    },
    {
      "name": "cleanup_on_failure",
      "ok": true,
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
        "deleteInviteTask": {
          "ok": true,
          "status": 200,
          "body": {
            "code": 200,
            "msg": "操作成功"
          }
        },
        "deleteInvitedTask": {
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
    "deleteInviteTask": {
      "ok": true,
      "status": 200,
      "body": {
        "code": 200,
        "msg": "操作成功"
      }
    },
    "deleteInvitedTask": {
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
