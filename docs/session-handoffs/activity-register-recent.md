# 活动用户报名管理近期链路

## 2026-05-06 自然流量通用报名模板随机可见创建

- 用户要求：随机配置 3 个 `自然流量` 的通用报名模板，使用浏览器可见模式。
- 执行环境：staging，页面 `/activity/register`。
- 执行命令：`create-register-templates.mjs --platform-scopes natural --restrict-scopes none,kyc,vip --signup-modes auto --permissions view --name-prefix 自然流量随机可见 --visible`。
- 创建结果：
  - `2769`：`自然流量随机可见_自然流量_20260506103226`，限制用户参与范围 `无`。
  - `2770`：`自然流量随机可见_自然流量_KYC_20260506103226`，限制用户参与范围 `KYC`，默认 KYC 区域 `中国`。
  - `2771`：`自然流量随机可见_自然流量_VIP等级_20260506103226`，限制用户参与范围 `VIP等级`，默认 VIP 等级 `VIP0`，VIP 白名单限制 `同等级限制`。
- 共享配置：
  - `平台用户参与范围`：`自然流量`。
  - `用户报名方式`：`注册即报名`。
  - `限制用户权限`：勾选 `看到和进入页面`；页面默认 `报名` 为 disabled checked。
- 验证依据：
  - 三条均观察到 `POST /prod-api/activity/apply` HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 三条创建后均按模板名称搜索，列表返回对应模板 ID，`平台用户参与范围` 列为 `自然流量`，最近编辑人 `auto`。
- 截图：用户未要求截图，未保存。
- 本次是已沉淀链路的参数化复用；未新增脚本或 skill 逻辑。

## 2026-05-06 非活跃用户报名模板带注册时间范围可见创建

- 用户要求：创建 1 个 `非活跃用户` 的报名模板，`可参与注册时间范围` 为今天到明天，使用浏览器可见模式。
- 执行环境：staging，页面 `/activity/register`。
- 执行模式：可见浏览器模式。
- 操作类型：新增活动用户报名模板，改变后台状态。
- 创建结果：
  - 模板 ID：`2772`
  - 模板名称：`非活跃用户报名模板_注册时间_20260506104509`
  - `平台用户参与范围`：`非活跃用户`
  - `限制用户参与范围`：`无`
  - `用户报名方式`：`注册即报名`
  - `非活跃用户范围`：`5天非活跃合约用户`
  - `用户区域`：`海外用户`
  - `可参与注册时间范围`：`2026-05-06 00:00:00` 到 `2026-05-07 23:59:59`
- 验证依据：
  - 日期组件通过组件状态绑定，`value/displayValue` 均为目标时间。
  - `POST /prod-api/activity/apply` HTTP 200，响应 `code=200`、`msg=操作成功`。
  - 创建后按模板名称搜索，列表返回 ID `2772`，`平台用户参与范围` 为 `非活跃用户`，最近编辑人 `auto`。
- 截图：用户未要求截图，未保存。
- 当前沉淀状态：
  - 用户已确认沉淀。
  - 已新增 `scripts/lib/element-ui-datetime.mjs`，用于通过 Element UI datetime 组件状态绑定 `可参与注册时间范围`。
  - 已扩展 `create-register-templates.mjs` 支持 `--register-start` 和 `--register-end`。
  - 已扩展动作缓存自然语言解析：`非活跃用户`、`可参与注册时间范围今天到明天`、`浏览器模式` 可解析为 `--platform-scopes non_active --register-start <today 00:00:00> --register-end <tomorrow 23:59:59> --visible`。
  - 已拆分报名模板 operation 文档，避免 `activity-register-management.md` 超过 250 行阈值。
  - 已新增 `activity-register-management-date-range.md` 和 `activity-register-management-platform-scopes.md`，并更新 operations index、action-cache 和页面组件 reference。
  - 已按用户确认继续拆分公共组件 helper：`scripts/lib/element-ui.mjs` 现在是 6 行兼容导出入口，具体实现拆到 `scripts/lib/element-ui/common.mjs`、`form.mjs`、`select.mjs`、`choice.mjs`、`actions.mjs`、`table.mjs`；新增日期范围 helper 保持在 `scripts/lib/element-ui-datetime.mjs`。
  - 拆分后最大脚本文件为 `scripts/cache/matcher.mjs`，199 行；业务脚本 import 仍通过 `scripts/lib/element-ui.mjs` 兼容入口工作。

## 下一步建议
- 继续探索“新手活动”创建流程，记录页面路径、字段、默认值、风险参数和断言；只有用户明确要求时才保存截图。
- 每次跑通新后台操作后，按业务域更新 `skills/weex-admin-ops/references/operations/`，并同步更新本交接记录。
- 如果某个业务域文件接近 250 行，先拆分再继续沉淀。
- 后续截图统一放到 `artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- 后续页面操作默认使用不可见/后台自动化；如果测试人员要求观察过程，需要在指令中明确说明“可见操作”或类似表达。
- 如继续处理 `仓位空投`，先打开新增弹窗选择 `虚拟积分或资格 / 仓位空投`，在 `交易对` 多选下拉中选择真实选项，点击空白处收起下拉框后再填写后续字段；上传图片时定位 `奖品图片` 表单项内的 file input。

## 安全说明
- 不保存真实密码、验证码、token、cookie、API key 或其他敏感信息。
- 敏感信息统一使用占位符，例如 `<USERNAME>`、`<PASSWORD>`、`<GOOGLE_CODE>`。
- staging 默认用户名可以记录为 `auto`；密码和 Google 验证码必须通过 `WEEX_ADMIN_PASSWORD`、`WEEX_ADMIN_GOOGLE_CODE` 或本机未提交的 `.env.local` 提供。
