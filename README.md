# WEEX 后管自动化知识库

本仓库用于沉淀 WEEX 活动后台管理页面的操作规范、自动化脚本、动作缓存、会话交接和失败复盘。

默认目标环境是 staging：`https://stg-activity.weex.tech`。

## 快速入口
- 项目级强制规范：`AGENTS.md`
- 当前接力摘要：`docs/session-handoff.md`
- 后管操作 skill：`skills/weex-admin-ops/SKILL.md`
- 操作流程索引：`skills/weex-admin-ops/references/operations/index.md`
- 用例库总览（统一口径）：`docs/test-cases/index.md`
- 动作缓存说明：`skills/weex-admin-ops/references/action-cache.md`
- 失败复盘入口：`skills/weex-admin-ops/FAILURES.md`
- 暂存流程说明：`temp/README.md`

## 目录职责
- `skills/weex-admin-ops/`：团队协作的权威后管自动化 skill。
- `skills/weex-admin-ops/references/`：页面路径、流程、选择器、断言、默认值、组件、业务关联关系。
- `skills/weex-admin-ops/scripts/`：后管业务动作脚本和动作缓存脚本。
- `skills/weex-admin-ops/assets/`：后管 skill 专用默认图片、导入模板和测试素材。
- `skills/weex-admin-ops/artifacts/`：用户明确要求保存的截图和证据。
- `docs/session-handoff.md`：当前接力摘要，只保留最新状态和入口索引。
- `docs/session-handoffs/`：历史交接归档，按业务域拆分。
- `skills/weex-admin-ops/FAILURES.md`：失败复盘索引。
- `skills/weex-admin-ops/failure-reviews/`：按业务线保存失败场景、原因、解决方式和验证结果。
- `temp/`：用户明确要求暂不沉淀到 skill 的已跑通流程。

## 常用命令
首次检查依赖、配置和登录态：

```bash
npm run first-run
```

只检查某个 skill：

```bash
node tools/first-run-check.mjs --skill frontend
node tools/first-run-check.mjs --skill fin
node tools/first-run-check.mjs --skill admin
```

对话式配置时，Codex 会把用户提供的缺失值写入对应 skill 的 `.env.local`，不回显真实值。也可以用 stdin 写入：

```bash
node tools/configure-skill-env.mjs --skill frontend --from-stdin
```

执行后粘贴 JSON，再按 `Ctrl-D` 结束输入。不要把密码、验证码、token、cookie 写在 shell 命令参数里。

安装项目运行依赖：

```bash
npm install
```

脚本会在发现缺少 `playwright` 等项目依赖时自动执行 `npm install --no-audit --no-fund`。如需禁用自动安装，设置：

```bash
WEEX_AUTO_INSTALL_DEPS=false
```

动作缓存 dry-run：

```bash
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "创建个 非活跃用户的报名模板 可参与注册时间范围今天到明天 浏览器模式" --dry-run
```

报名模板创建计划 dry-run：

```bash
node skills/weex-admin-ops/scripts/create-register-templates.mjs --platform-scopes non_active --signup-modes auto --register-start "2026-05-06 00:00:00" --register-end "2026-05-07 23:59:59" --visible --dry-run
```

项目知识结构校验：

```bash
node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs
```

动作缓存 JSON 校验：

```bash
node -e "JSON.parse(require('fs').readFileSync('skills/weex-admin-ops/scripts/action-cache.json','utf8')); console.log('action-cache json ok')"
```

生成通用回归（从零配置）自动化用例库文档：

```bash
npm run generate:test-cases
```

Git 空白检查：

```bash
git diff --check
```

## 操作原则
- 后台相关操作优先使用项目内 `skills/weex-admin-ops/`。
- 自然语言后台操作先查 `skills/weex-admin-ops/references/operations/index.md` 和 `skills/weex-admin-ops/scripts/action-cache.json`。
- 命中动作缓存时先 dry-run，再决定是否真实执行。
- 默认使用不可见浏览器自动化；用户明确要求“浏览器模式”或“可见操作”时才打开有界面浏览器。
- 截图默认不保存；只有用户明确要求截图或证据图时，才保存到 `skills/weex-admin-ops/artifacts/screenshots/<中文业务域>/<中文页面或操作>/`。
- 业务脚本只保留业务编排，组件级点击、输入、上传、选择、等待和断言逻辑应放到公共 helper。

## 失败复盘
- 每次失败、阻塞、误判、重试成功、脚本异常、缓存误命中或后端校验失败，都要更新 `skills/weex-admin-ops/FAILURES.md` 或 `skills/weex-admin-ops/failure-reviews/`。
- 重试失败流程前，先查 `skills/weex-admin-ops/FAILURES.md` 和对应业务线复盘。
- 同类失败多次出现时，必须修改原流程、skill reference、组件 helper 或缓存脚本，并验证修复后的路径。

## 文档增长
- `docs/session-handoff.md` 只保留当前摘要。
- 历史交接写入 `docs/session-handoffs/`。
- 任意 `docs/**/*.md` 或 `skills/weex-admin-ops/failure-reviews/**/*.md` 接近 250 行时，先拆分再追加。
- 更新 docs 或失败复盘后，运行 `node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs`。

## 敏感信息
- 不提交真实密码、Google 验证码、token、cookie、API key 或完整账号凭证。
- staging 默认用户名可以记录为 `auto`。
- 密码和 Google 验证码必须来自本机环境变量或未提交的 `.env.local`。
- 仓库保留 `.env.example` 模板；`.env.local` 可以在本机保存运行值，但真实密码、Google 验证码、token、cookie、API key 不进入提交。
