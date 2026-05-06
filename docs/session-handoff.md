# 会话交接记录

## 当前状态
- 当前目标：建立并维护 WEEX 活动后台管理页面的可接力操作规范、自动化操作 skill、动作缓存和会话交接机制。
- 目标环境：staging，`https://stg-activity.weex.tech`。
- 权威 skill：项目内 `skills/weex-admin-ops/`。
- 最近更新时间：2026-05-06。
- 历史交接已按业务域归档到 `docs/session-handoffs/`；当前文件只保留接力摘要和入口索引。

## 必读入口
- 项目规范：`AGENTS.md`。
- 后管操作 skill：`skills/weex-admin-ops/SKILL.md`。
- 操作索引：`skills/weex-admin-ops/references/operations/index.md`。
- 动作缓存说明：`skills/weex-admin-ops/references/action-cache.md`。
- 组件复用说明：`skills/weex-admin-ops/references/components.md`。
- 业务关联关系：`skills/weex-admin-ops/references/relationships.md`。
- 历史交接索引：`docs/session-handoffs/README.md`。

## 最近完成
- 已创建 `非活跃用户` 报名模板：ID `2772`，名称 `非活跃用户报名模板_注册时间_20260506104509`。
- 该模板的可参与注册时间范围为 `2026-05-06 00:00:00` 到 `2026-05-07 23:59:59`。
- 创建验证：`POST /prod-api/activity/apply` HTTP 200，响应 `code=200`；按模板名称搜索返回 ID `2772`。
- 用户未要求截图，因此未保存截图。
- 已沉淀报名模板注册时间范围能力：新增 `scripts/lib/element-ui-datetime.mjs`，扩展 `create-register-templates.mjs` 的 `--register-start` / `--register-end`，并更新动作缓存自然语言解析。
- 已拆分报名模板 operation 文档：新增 `activity-register-management-date-range.md` 和 `activity-register-management-platform-scopes.md`。
- 已拆分公共 Element UI helper：`scripts/lib/element-ui.mjs` 作为兼容导出入口，具体实现拆到 `scripts/lib/element-ui/` 子模块。
- 已将历史交接从本文件拆分到 `docs/session-handoffs/`，避免单文件过长。
- 已将 docs 增长管理写入 `AGENTS.md` 和 `skills/weex-admin-ops/SKILL.md`：`docs/session-handoff.md` 只保留当前摘要，历史归档到 `docs/session-handoffs/`，任意 `docs/**/*.md` 接近 250 行必须先拆分。
- 已新增 `scripts/validate-docs-structure.mjs`，用于检查交接索引和 docs 文件长度。
- 已新增失败复盘体系：根目录 `FAILURES.md` 作为入口，`failure-reviews/` 按业务线保存失败场景、原因、解决方式和验证结果。
- 已将失败复盘强制规则写入 `AGENTS.md` 和 `skills/weex-admin-ops/SKILL.md`：遇到失败必须主动更新复盘；重试前先查复盘；同类失败重复出现时必须反写原流程并验证。
- 已补强仓库入口 README，明确根目录 `scripts/` 是项目治理脚本、`skills/weex-admin-ops/scripts/` 是后管业务动作脚本。
- 已修正 `AGENTS.md` 中动作缓存路径歧义，并调整 `temp/` 启动规则：仅在当前任务相关或用户明确要求时汇总暂存流程。

## 当前 Git 状态
- 当前分支：`dev`。
- 最近远端同步提交：`9c493e0 feat: 完善后管自动化流程沉淀与复盘规范`。
- 最近一次推送后，本地 `dev` 与 `origin/dev` 已确认一致。
- 本轮 README、AGENTS、handoff 和 gitignore 规范调整尚未提交。

## 后续接力建议
- 继续探索“新手活动”创建流程时，先读取相关 operation index、defaults、components 和 relationships。
- 后台写操作前必须说明动作并处理必要确认；高风险业务参数不能猜测。
- 新跑通链路若当前 skill 尚未覆盖，按规则询问或按已授权范围沉淀到 `skills/weex-admin-ops/`，并评估动作缓存。
- 更新交接时只在本文件记录当前摘要；历史细节写入 `docs/session-handoffs/` 对应业务域。

## 安全说明
- 不保存真实密码、验证码、token、cookie、API key 或完整账号凭证。
- staging 默认用户名可以记录为 `auto`；密码和 Google 验证码必须来自环境变量或未提交的本机文件。
