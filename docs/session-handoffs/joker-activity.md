# 小丑牌活动归档

## 2026-05-06 小丑牌活动多语言自动翻译与回填链路

- 当前目标：将小丑牌活动编辑页的多语言自动翻译、组件级回填、保存后独立重载校验能力沉淀到项目内 `weex-admin-ops` skill。
- 沉淀范围：
  - `skills/weex-admin-ops/references/components.md`
  - `skills/weex-admin-ops/references/operations/joker-activity.md`
  - `skills/weex-admin-ops/references/operations/index.md`
  - `skills/weex-admin-ops/references/relationships.md`
  - `docs/session-handoff.md`
- 新增能力摘要：
  - 小丑牌活动编辑页的多语言字段不能只按普通表单处理，至少分为三类：
    - 顶部表单 `MultiLangInput`，例如 `活动标题`、`活动副标题`、`活动分享文案`、`代理分享文案`、`我的分享文案`、`模块介绍`、`Tab名称`。
    - 表格单元格内嵌 `MultiLangInput`，例如 `牌型说明`、`奖池类型`。
    - Vue `Editor` + Quill 富文本，例如 `活动内容规则`、`游戏玩法内容`。
  - 自动翻译稳定路径：
    - 先读取当前中文和英语源文案。
    - 先构造目标语言 map，再批量写入组件真实模型。
    - 文字型富文本如 `活动内容规则` 走翻译；iframe/video 型 `游戏玩法内容` 走跨语言 HTML 同步，不做自然语言翻译。
  - 保存稳定路径：
    - 不能只改可见 `input` / `textarea` / `.ql-editor` DOM。
    - `MultiLangInput` 需要更新 `defaultLangValue`、`langsForm`，必要时同步嵌套 `LangInput.formData`。
    - Quill 富文本需要通过 Vue `Editor` 实例的 `currentValue` 和 Quill clipboard API 写入，并触发 `input` / `change`。
  - 校验稳定路径：
    - 保存后不能只信当前 tab；必须新开 tab 重载同一编辑页，再抽查顶部表单、表格单元格、富文本三类字段的代表值。
    - Joker 编辑页保存后当前 tab 可能跳到其他活动壳页，因此重开校验页比依赖当前页更稳。
- 已验证页面结构特征：
  - `牌型说明`、`奖池类型` 在表格列里，不属于普通 `el-form-item`。
  - 印尼语在不同组件里可能表现为 `in_ID` 或 `id_ID`，回填时应同时兼容。
  - 两个 `模块介绍` 是独立字段，按页面顺序分别处理，不能合并。
- 本次沉淀的是可复用能力和稳定路径，不记录具体活动 ID、别名、翻译结果或浏览器 target id。
- 当前未新增动作缓存：
  - 原因：这次沉淀的是页面结构识别、翻译与回填规则，尚未抽象成稳定的参数化脚本入口；先作为 reference 能力沉淀，后续若重复出现再评估脚本化。
