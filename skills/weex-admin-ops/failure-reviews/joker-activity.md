# 小丑牌活动失败复盘

## 2026-05-06 小丑牌多语言只改 DOM 不入模型
- 业务线：小丑牌活动。
- 场景：编辑小丑牌活动多语言字段、表格内嵌多语言字段和富文本字段。
- 失败表现：页面当前 tab 看似改动成功，但保存或重载后部分语言未持久化。
- 失败原因：只改可见 input、textarea 或 `.ql-editor` DOM，没有同步 Vue 组件模型。
- 解决方式：`MultiLangInput` 同步 `defaultLangValue`、`langsForm` 和嵌套 `LangInput.formData`；Quill 富文本通过 Editor 实例和 Quill clipboard API 写入，并触发 `input` / `change`。
- 验证结果：保存后新开 tab 重载同一编辑页，抽查顶部表单、表格单元格、富文本三类字段。
- 关联文件：`references/operations/joker-activity.md`、`references/components/joker-activity.md`。
- 后续处理：后续小丑牌多语言自动化应优先复用该模型回填策略。
