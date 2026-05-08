# 通用失败复盘

## 2026-05-07 一次性脚本未加载 skill-local `.env.local`
- 业务线：通用脚本运行。
- 场景：可见浏览器模式探测 `活动列表 / 转盘抽奖` 时，在 inline Node 脚本中调用 `pathsFrom('./skills/weex-admin-ops/scripts/lib/runtime.mjs')` 后再执行登录配置检查。
- 失败表现：脚本未进入浏览器，抛出 `WEEX_ADMIN_PASSWORD is required`。
- 失败原因：inline 脚本传入相对路径时，`pathsFrom()` 以当前执行上下文推导出的根目录不等于项目根或 skill 根，导致 `loadLocalEnv()` 没有读取到 `skills/weex-admin-ops/.env.local`。
- 解决方式：一次性脚本中改用 `process.cwd()` 作为项目根显式调用 `loadLocalEnv(repoRoot)` 和 `adminConfig(repoRoot)`；当前规范要求活动后台本机密钥只放在 `skills/weex-admin-ops/.env.local`。
- 验证结果：重跑后成功登录 staging，进入 `/activity/prize`，再通过左侧菜单进入 `/activities/lottery`。
- 关联文件：`scripts/lib/runtime.mjs`。
- 后续处理：inline 探测脚本优先使用当前工作目录加载本机环境；可复用脚本仍使用 `import.meta.url` 推导根目录。

## 2026-05-07 DOM 提取脚本把元素对象当字符串处理
- 业务线：通用浏览器探测。
- 场景：可见浏览器模式打开 `活动列表 / 转盘抽奖 / 新增` 后，提取页面模块、label、按钮和表格头。
- 失败表现：页面已打开到 `/activities/lottery/add`，但 `page.evaluate()` 中执行 `clean(element)` 抛出 `(s || "").trim is not a function`，浏览器会话中断。
- 失败原因：提取脚本把 DOM 元素对象直接传给字符串清洗函数，没有先读取 `innerText`、`textContent` 或 `placeholder`。
- 解决方式：补充 `txt(element)` 包装函数，先取元素文本再调用 `clean()`。
- 验证结果：重跑后成功提取新增页模块、可见字段、按钮、表格列，并确认依赖接口均返回 HTTP 200、业务 `code=200`。
- 关联流程：活动列表转盘抽奖新增页只读探测。
- 后续处理：后续 inline DOM 探测统一区分元素对象和字符串，避免只读探测阶段中断。

## 2026-05-07 维护脚本执行目录和路径前缀重复
- 业务线：通用维护验证。
- 场景：更新交接记录和失败复盘后运行知识结构校验。
- 失败表现：在 `skills/weex-admin-ops` 目录下执行 `node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs`，路径被解析为 `skills/weex-admin-ops/skills/weex-admin-ops/...`，提示找不到模块。
- 失败原因：命令同时使用了 skill 目录作为工作目录和仓库相对路径前缀。
- 解决方式：从仓库根目录执行 `node skills/weex-admin-ops/scripts/maintenance/validate-knowledge-structure.mjs`，或在 skill 目录下执行 `node scripts/maintenance/validate-knowledge-structure.mjs`。
- 验证结果：从仓库根目录重跑后输出 `WEEX admin skill knowledge structure is valid.`。
- 关联文件：`scripts/maintenance/validate-knowledge-structure.mjs`。
- 后续处理：后续维护校验先确认当前工作目录，再选择对应路径。

## 2026-05-06 可见浏览器模式误用接口写入
- 业务线：通用浏览器模式。
- 场景：用户要求“浏览器模式”创建活动流程引导配置。
- 失败表现：脚本虽然打开了可见浏览器，但实际写入通过登录后复用 `Authorization` 调用创建接口完成，没有在页面上点击新增、填写弹窗和点击确认。
- 失败原因：脚本把“可见浏览器模式”只作为浏览器是否有界面的执行参数，没有区分 UI 点击写入和接口写入。
- 解决方式：已修正 `scripts/create-guide-templates.mjs`：`--visible` 时改走 UI 控件路径，实际执行点击新增、选择下拉、点击新增步骤、填写字段、上传图片/动图并点击确认；接口只用于提交后的只读验证。
- 验证结果：真实 UI 可见浏览器路径创建 ID `72`，名称 `浏览器UI_转盘抽奖_每次访问_3步_01_20260506130117`，提交接口返回 `code=200`，详情回查三步配置均存在。
- 关联文件：`scripts/create-guide-templates.mjs`、`scripts/business/activity-common-module/guide-template-create.mjs`。
- 后续处理：后续凡用户明确要求浏览器模式或可见操作，写操作必须走页面 UI 行为；不可见自动化可继续使用已说明的接口型缓存路径。

## 2026-05-06 活动流程引导 UI 创建图片字段遗漏
- 业务线：通用组件。
- 场景：真实 UI 创建三步骤活动流程引导配置时，仅填写标题、内容和按钮文案后点击确认。
- 失败表现：提交接口返回 HTTP 200 但业务 `code=500`，提示 `步骤1/2/3: en_US配置不完整`，未创建记录。
- 失败原因：每个步骤的 `en_US` 配置还要求 `H5配图（静图）`、`H5配图（动图）`、`Web配图（静图）`、`Web配图（动图）` 四个媒体字段。
- 解决方式：通过页面上传控件为每个步骤上传静图和动图后再提交；静图复用 skill 默认 webp，动图使用运行时生成的 1x1 gif 临时文件。
- 验证结果：补齐 3 个步骤共 12 次上传后，ID `72` 创建成功且详情回查三步配置均存在。
- 关联文件：`scripts/business/activity-common-module/guide-template-create.mjs`。
- 后续处理：活动流程引导配置 UI 创建脚本必须在每个步骤补齐 7 个字段后再确认。

## 2026-05-06 活动流程引导配置缓存误匹配
- 业务线：动作缓存。
- 场景：自然语言请求 `活动通用模块管理 活动引导流程配置 搜索 新增 创建模板` 先执行动作缓存 dry-run。
- 失败表现：未命中活动流程引导配置动作，反而误匹配到 `create_prizes`，并提示奖品创建缺少 `category` 和 `subtype`。
- 失败原因：当前动作缓存没有活动流程引导配置动作，现有自然语言 matcher 对 `新增`、`创建模板` 等词评分过宽。
- 解决方式：本轮回退到常规 Playwright 探索；未在用户确认前修改缓存。
- 验证结果：后续页面探测、搜索验证和创建验证均通过常规浏览器上下文完成。
- 关联文件：`scripts/run-cached-action.mjs`、`scripts/cache/matcher.mjs`。
- 后续处理：如果用户确认沉淀该流程，应新增专用 action 或收紧 prize matcher 对业务域词的判断。

## 2026-05-06 inline DOM 脚本误用 Playwright :visible
- 业务线：通用浏览器探测。
- 场景：活动流程引导配置新增弹窗探测时，在 `page.evaluate()` 内部执行原生 DOM 查询。
- 失败表现：脚本抛出 `querySelectorAll` 语法错误，提示 `.el-dialog:visible button` 不是有效选择器。
- 失败原因：`:visible` 是 Playwright selector 扩展，不是浏览器原生 `querySelectorAll()` 支持的 CSS 选择器。
- 解决方式：在 `page.evaluate()` 内改用 `getBoundingClientRect()` 判断可见元素；保留 Playwright selector 只在 locator API 中使用。
- 验证结果：重跑后成功提取新增弹窗字段、活动类型/频率下拉选项、步骤新增和删除按钮状态。
- 关联文件：本轮 inline 探测脚本。
- 后续处理：沉淀脚本时把可见性判断抽到公共 helper，避免在业务脚本内混用两类 selector 语法。

## 2026-05-06 手动调用后管 API 缺少 Authorization
- 业务线：通用接口调用。
- 场景：活动流程引导配置创建试跑时，在已登录页面里直接使用 `fetch('/prod-api/activity/guideTemplate')`。
- 失败表现：接口 HTTP 200，但业务响应 `code=401`，提示认证失败；未创建数据。
- 失败原因：前端 axios 请求会携带 `Authorization` 头，普通 `fetch` 只带 cookie 不足以通过后管接口认证。
- 解决方式：从页面实际列表请求中复用 `Authorization` 请求头，再调用创建、查询和删除接口。
- 验证结果：复用认证头后创建试跑成功，随后批量创建和临时记录清理均通过业务 `code=200` 验证。
- 关联文件：本轮 inline 创建脚本。
- 后续处理：如果沉淀 API 辅助脚本，应封装认证头捕获或统一复用页面网络层，不打印或保存 token。

## 2026-05-05 staging 登录页普通验证码误判
- 业务线：通用登录。
- 场景：脚本登录 staging 后台时，页面短暂出现 `placeholder="验证码"`。
- 失败表现：脚本误认为需要普通图形验证码，登录流程中止或可能把 Google 验证码填错字段。
- 失败原因：页面未稳定时普通验证码 DOM 短暂存在；staging 实际接口 `/prod-api/captchaImage` 返回 `captchaEnabled=false`。
- 解决方式：登录逻辑以 `/prod-api/captchaImage` 的 `captchaEnabled` 为准；`false` 时等待普通验证码输入隐藏，短暂残留不再中止；只填写账号、密码、Google 验证码。
- 验证结果：可见模式登录 `/activity/register` 和 `/activity/task` 均成功，最终 URL 离开 `/login`，登录接口返回 `code=200`。
- 关联文件：`scripts/lib/browser.mjs`、`references/login.md`。
- 后续处理：新登录脚本必须复用公共登录 helper。

## 2026-05-06 Element UI 下拉旧浮层干扰
- 业务线：通用组件。
- 场景：连续操作多个 Element UI 单选或多选下拉。
- 失败表现：点击选项后落值不稳定，旧 dropdown 干扰新字段，后续字段被遮挡或提交提示未选择。
- 失败原因：Element UI dropdown 以浮层形式挂在 body 下，旧浮层未关闭时选择器可能命中错误下拉。
- 解决方式：选择下拉项时取最后打开的可见 dropdown；选择后通过 Escape、点击弹窗空白或公共 helper 收起，并校验表单项内 tag/value。
- 验证结果：报名模板指定国家、活动任务指定国家、仓位空投交易对等多选链路重跑通过。
- 关联文件：`scripts/lib/element-ui/`、`references/components.md`。
- 后续处理：业务脚本不得直接复制下拉 DOM 逻辑，应复用公共 helper。

## 2026-05-05 多语言字段全局输入误填
- 业务线：通用组件。
- 场景：活动任务新增或编辑时填写 `任务名称`、`任务内容`、`任务标签` 的英语多语言。
- 失败表现：只填到了第一个英语输入，其他字段英语为空。
- 失败原因：页面存在多个独立多语言组件，且隐藏 input/textarea 会被全局选择器命中。
- 解决方式：必须按表单项分别打开多语言组件，并只定位该表单项内的可见英语输入。
- 验证结果：任务 `4800` 重新编辑后，`nameI18`、`contentI18`、`labelI18` 均包含 `lang: en`。
- 关联文件：`scripts/business/activity-task-management/roulette-participant-ui.mjs`、`references/components.md`。
- 后续处理：新多语言页面必须先判断组件归属，不使用全局第一个 `英语` 输入。

## 2026-05-06 本地 Node 缺少 Playwright
- 业务线：通用脚本运行。
- 场景：直接用系统 Node 执行 `scripts/create-register-templates.mjs`。
- 失败表现：脚本启动失败，提示找不到 `playwright` 模块，未打开浏览器，未创建后台数据。
- 失败原因：当前 shell 的系统 Node 没有安装 Playwright；Codex 桌面线程提供了 bundled runtime。
- 解决方式：使用 `load_workspace_dependencies` 返回的 Node 和 `NODE_PATH`，例如设置为当前机器 Codex bundled runtime 返回的 `node_modules` 路径。
- 验证结果：使用 bundled runtime 后成功创建临时报名模板 ID `2773`；本轮 one-off 可见浏览器脚本首次用系统 Node 复现同类错误，切换到 bundled runtime 后完成复杂报名模板 ID `2776`-`2779` 的创建、查看、修改和删除；2026-05-07 创建转盘抽奖活动 ID `9022` 前再次复现，切换 bundled runtime 后通过。
- 关联文件：`scripts/lib/runtime.mjs`。
- 后续处理：后续本地直接运行浏览器脚本前，优先确认 Node runtime 是否包含 Playwright；当前可用方案是使用 Codex bundled runtime 的 Node 和 `NODE_PATH`。

## 2026-05-06 可执行入口不适合作为 import 校验对象
- 业务线：通用脚本运行。
- 场景：迁移 skill 资产目录后，用 `node -e "import('./scripts/create-prizes.mjs')"` 做语法导入校验。
- 失败表现：入口脚本在 import 时执行了主流程，因缺少 `--category` 和 `--subtype` 输出参数错误。
- 失败原因：当前业务入口脚本是可执行文件，包含顶层 `await run()`，不能当作纯模块导入。
- 解决方式：语法导入只检查 `scripts/lib/` 和 `scripts/business/` 下的模块；入口脚本用 `--dry-run` 或真实业务命令验证。
- 验证结果：后续 `create-prizes.mjs --dry-run`、不可见浏览器创建和可见浏览器创建均通过。
- 关联文件：`scripts/create-prizes.mjs`。
- 后续处理：新增入口脚本时，如需 import 校验，应把业务逻辑放在可导入模块中，入口只做参数解析和调用。

## 2026-05-06 skill 独立复制后默认路径失效
- 业务线：通用脚本运行。
- 场景：将 `` 单独复制到临时目录，验证默认图片路径和动作缓存 dry-run。
- 失败表现：原 `pathsFrom()` 默认认为 skill 外层还有仓库级 `skills/weex-admin-ops` 目录，独立复制后可能把默认图片解析到错误位置。
- 失败原因：运行时把仓库布局和 skill 独立布局耦合在一起。
- 解决方式：`pathsFrom()` 根据当前 skill 是否位于父级 `skills/` 下判断仓库模式或独立模式；`adminConfig()` 优先识别传入根目录本身是否为 skill 根；`run-cached-action.mjs` 的子进程工作目录同样兼容两种布局。
- 验证结果：复制 `` 到临时独立目录后，skill 内知识结构校验、`create-prizes.mjs --dry-run`、`run-cached-action.mjs --query "创建一个实物奖品" --dry-run` 均通过，默认图片解析到独立 skill 的 `assets/default-prize-images/`。
- 关联文件：`scripts/lib/runtime.mjs`、`scripts/run-cached-action.mjs`。
- 后续处理：新增脚本时不得假设外层仓库路径存在，路径应从当前 skill 根目录推导。

## 2026-05-06 runtime 路径 helper 校验传参误用
- 业务线：通用脚本运行。
- 场景：迁移验证时，用 `node -e` 直接调用 `pathsFrom("scripts/create-prizes.mjs")` 检查默认图片路径。
- 失败表现：`pathsFrom()` 把普通相对路径当作 URL 交给 `fileURLToPath()`，抛出 `ERR_INVALID_URL`。
- 失败原因：helper 只兼容 `import.meta.url`，维护校验时容易传入普通文件路径。
- 解决方式：`pathsFrom()` 已改为同时兼容 `file:` URL 和普通文件路径；普通路径会先转成绝对路径再推导 skill 根目录。
- 验证结果：普通路径校验、仓库内默认图片路径检查、独立复制目录中的结构校验、奖品 dry-run、动作缓存 dry-run 和默认图片路径检查均通过。
- 关联文件：`scripts/lib/runtime.mjs`。
- 后续处理：新增 runtime helper 时，维护场景输入应兼容脚本内调用和外部校验调用。

## 2026-05-06 独立复制验证使用相对源路径失败
- 业务线：通用维护验证。
- 场景：复制 `` 到临时独立目录做独立复用验证。
- 失败表现：命令在目标目录上下文执行时，`cp` 使用相对源路径 `skills/weex-admin-ops`，提示找不到源目录。
- 失败原因：复制源依赖当前工作目录，切换到临时目标目录后相对路径失效。
- 解决方式：独立复制验证必须使用仓库内 skill 的绝对路径作为源路径。
- 验证结果：使用绝对源路径重新复制后，独立目录中的结构校验、奖品 dry-run、动作缓存 dry-run 和默认图片路径检查均通过。
- 关联文件：``。
- 后续处理：后续 standalone 验证命令不要依赖调用时的当前目录。
