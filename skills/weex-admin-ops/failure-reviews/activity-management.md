# 活动列表与活动配置失败复盘

## 2026-05-07 转盘抽奖新增奖品池 ID 被误填
- 业务线：活动列表 / 转盘抽奖。
- 场景：可见浏览器模式新增转盘抽奖草稿活动，填写 `抽奖奖品配置` 8 行奖品表格。
- 失败表现：页面没有发出 `POST /prod-api/activity/config`；调用页面模块 `prizeConfigForm.submit()` 返回 `false`。
- 失败原因：通用数值填充函数把每行第一列 `奖品池ID` 也按 `1/100/12.5` 循环改写，导致奖品池 ID 不再是默认 `1`-`8`，前端奖品配置校验失败。
- 解决方式：改为按行精确填充，保留 `奖品池ID=1..8`，只填 `有效期/奖金金额/总库存/权重` 等业务列；8 行奖品名称选择不同奖品，奖品标记按 `大奖/中奖/小奖` 轮换。
- 验证结果：重跑后 `prizeConfigForm.submit()` 返回 `array:8`，最终页面点击 `新增` 触发 `POST /prod-api/activity/config`，HTTP 200、业务 `code=200`，新增活动 ID `9004`，状态 `DRAFT`。
- 关联流程：`活动列表 / 转盘抽奖 / 新增`。
- 后续处理：沉淀脚本时奖品表格必须使用表格行/列级 helper，不能用模块内所有 input 的循环填充。

## 2026-05-07 转盘抽奖新增活动任务添加按钮未命中
- 业务线：活动列表 / 转盘抽奖。
- 场景：新增转盘抽奖活动的 `活动任务信息` 模块，选择任务后添加配置行并填写排序系数。
- 失败表现：首次尝试中 `activityTaskForm.submit()` 返回 `false`，没有触发创建接口。
- 失败原因：任务选择后未命中模块右侧 `+` 按钮，表格未生成任务配置行；通用填充函数也没有可填写的排序系数输入。
- 解决方式：在 `活动任务信息` 模块内按 `.el-icon-plus` 或 `+` 按钮定位并点击，再按模块内可见输入填排序系数 `1`。
- 验证结果：重跑后 `activityTaskForm.submit()` 返回包含 `taskConfig` 和 `showBeginnerTaskConfig` 的对象，最终活动创建成功。
- 关联流程：`活动列表 / 转盘抽奖 / 新增`。
- 后续处理：沉淀时任务模块应先断言已出现配置行，再填写排序系数。

## 2026-05-07 转盘抽奖新增多语言选择未按模块落值
- 业务线：活动列表 / 转盘抽奖。
- 场景：新增转盘抽奖活动的 `多语言` 模块，选择显示语言并填写语言页签内容。
- 失败表现：首次尝试中 `i18nConfigForm.submit()` 返回 `array:0`。
- 失败原因：页面有多个语言复选组和多语言字段，通用 checkbox 点击可能命中 FAQ 或其他区域，未更新 `多语言` 模块的显示语言状态。
- 解决方式：先定位标题为 `多语言` 的模块容器，在该容器内选择 `英语`，再填写该模块下第二组活动标题、图片和文案字段。
- 验证结果：重跑后 `i18nConfigForm.submit()` 返回 `array:1`，最终活动创建成功。
- 关联流程：`活动列表 / 转盘抽奖 / 新增`。
- 后续处理：沉淀时多语言与 FAQ 必须分别按模块容器定位，不使用全局语言复选框选择器。

## 2026-05-07 转盘抽奖活动日历多语言图片未填全
- 业务线：活动列表 / 转盘抽奖。
- 场景：可见浏览器模式新增最复杂转盘抽奖草稿，活动日历选择 `同步`，并开启配图和小图标多语言配置。
- 失败表现：提交前 `activityCalendarConfig.validate()` 抛错：配图开启了多语言，但还有 21 种语言未上传，未触发 `POST /prod-api/activity/config`。
- 失败原因：活动日历图片多语言开关一旦开启，前端要求全部语言都有图片；只配置 `zh_CN` 和 `en_US` 不满足校验。
- 解决方式：为活动日历配图和小图标补齐全部 23 个语言 key 的图片 URL，再执行日历校验和新增提交。
- 验证结果：重跑后 `activityCalendarConfig.validate()` 返回 `true`，创建活动 ID `9006` 成功；详情回查 `syncCalendarFlag=1`，`syncCalendarDto` 包含 `imageUrlI18n` 和 `iconUrlI18n`。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 活动日历同步`。
- 后续处理：后续沉淀复杂日历同步分支时，若开启图片多语言，必须填全所有语言；否则关闭图片多语言开关。

## 2026-05-07 转盘抽奖复杂多语言行不存在时脚本中断
- 业务线：活动列表 / 转盘抽奖。
- 场景：可见浏览器模式新增最复杂转盘抽奖草稿，配置活动多语言 `en_US` 和 `zh_TW`。
- 失败表现：配置阶段脚本执行 `Object.assign(row, ...)` 时因为语言行对象未取到而中断，未触发新增接口。
- 失败原因：复杂页面存在多套旧/新语言 code，脚本直接假设语言行一定存在，未做存在性保护。
- 解决方式：按语言 code 查找行后仅在对象存在时填充，并记录实际填充语言；FAQ 继续使用旧 code `en`、`tw`。
- 验证结果：重跑后实际填充 `en_US`、`zh_TW`，`i18nConfigForm.submit()` 返回 2 条，最终创建活动 ID `9006` 成功。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 多语言与 FAQ`。
- 后续处理：沉淀复杂脚本时需要显式区分活动多语言新 code 和 FAQ 旧 code。

## 2026-05-07 转盘抽奖复杂配置误用页面状态注入
- 业务线：活动列表 / 转盘抽奖。
- 场景：用户要求“浏览器模式”并希望看到前端逐项配置最复杂转盘抽奖草稿。
- 失败表现：活动 ID `9006` 虽然创建成功并通过详情回查，但配置过程使用了页面内部状态批量赋值后提交，用户没有看到前端控件逐项配置。
- 失败原因：把“可见浏览器会话中运行”误当成“浏览器模式写操作合规”；浏览器模式下写操作必须通过页面控件点击、填写、选择、上传和提交完成。
- 解决方式：`9006` 只能作为后端字段和复杂 payload 参考，不能作为可见 UI 逐项配置验证结果；后续严格 UI 重跑禁止 Vue 状态注入，接口只做只读验证。
- 验证结果：用户指出问题后已停止把 `9006` 计为严格浏览器模式成功，重新开始真实 UI 路径验证。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 最复杂配置`。
- 后续处理：复杂流程沉淀前必须补跑一条新的严格 UI 创建记录，并在结果中明确创建 ID、POST 响应和列表回查。

## 2026-05-07 转盘抽奖严格 UI 重跑控件定位问题
- 业务线：活动列表 / 转盘抽奖。
- 场景：严格浏览器模式重新创建最复杂转盘抽奖草稿，逐项使用页面控件配置。
- 失败表现：首次严格 UI 脚本卡在已默认选中且禁用的 `活动时间选择 / 活动开始结束时间` 单选；第二次卡在奖品表第二行 `奖品名称` 下拉未稳定展开；第三次已完成基础配置、8 行奖品选择、颜色签和分享信息，进入 `奖品每日限制配置` 时被人工停止，未触发 `POST /prod-api/activity/config`。
- 失败原因：单选 helper 没有判断已选中禁用态；奖品表下拉受横向滚动和行定位影响，单次坐标点击不稳定；人工误判分享信息上传阶段卡住，实际进程仍在继续。
- 解决方式：单选已选中时跳过点击；奖品名称改为按 `奖品池ID` 表格内可见行定位，再点击该行第二个 `.el-select`，并带 3 次重试；后续分享信息上传应限定到当前奖品页签容器，避免全局 `input[type=file].last()` 命中隐藏控件。
- 验证结果：单独探测已验证前 4 行奖品名称可以连续展开并选择不同奖品；完整严格 UI 创建仍未成功，当前没有新活动 ID。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 抽奖奖品配置 / 配置分享信息`。
- 后续处理：下一次继续时应从严格 UI 脚本重跑，保留行内 locator 方案，并先修正分享信息页签内上传定位。

## 2026-05-07 转盘抽奖严格 UI 新增后验证方式误判
- 业务线：活动列表 / 转盘抽奖。
- 场景：严格浏览器模式新增活动后，页面仍停留在新增页签，列表页在原页签。
- 失败表现：脚本等待新增页跳转或使用 `alias` 参数查询，误判活动没有创建；实际列表页按 `活动别名` 搜索请求参数是 `showUrl`，记录 ID `9009` 已创建成功。
- 失败原因：把新增页 URL 当成成功/失败依据；只读验证使用了错误查询参数。
- 解决方式：提交后切回 `/activities/lottery` 列表页，通过页面搜索框填写 `活动别名`，或只读请求 `/prod-api/activity/config/list?...&showUrl=<活动别名>&type=LOTTERY` 验证。
- 验证结果：按 `showUrl=strict-ui-lottery-20260507050503` 命中活动 ID `9009`，状态 `DRAFT`。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 提交后验证`。
- 后续处理：脚本验证逻辑已改为回列表页按 `showUrl` 搜索，不再依赖新增页跳转。

## 2026-05-07 转盘抽奖严格 UI 选择和输入未真实绑定
- 业务线：活动列表 / 转盘抽奖。
- 场景：严格浏览器模式新增转盘抽奖活动，配置奖品表和 FAQ。
- 失败表现：活动 ID `9010` 创建成功，但详情显示最后一个奖品 `linkPrizeId` 和 `prizeName` 为空；FAQ 的 `title/content` 为空。
- 失败原因：奖品下拉用鼠标坐标点击第 8 个选项时没有触发 Element UI 选中绑定；FAQ 的内容字段是 Quill 富文本 `.ql-editor`，不是普通 textarea；另外通用输入 helper 在焦点未落到输入框时可能触发全页面全选。
- 解决方式：奖品下拉改为点击可见下拉项 locator，并在每行选择后读取第二个 `.el-select input` 断言非空；FAQ 标题填 `请输入标题` 输入框，内容填 `.ql-editor`；普通输入改用 `locator.fill()`，避免全局 `Meta+A/Control+A`。
- 验证结果：重跑创建活动 ID `9011`，详情回查 `prizeCount=8`，最后奖品 `linkPrizeId=510`、`prizeName=migration_physical_visible_20260506120226`，FAQ 保存为 `FAQ title` 和 `<p>FAQ content</p>`。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 抽奖奖品配置 / 常见问题`。
- 后续处理：后续沉淀到稳定 helper 时，所有下拉选择后必须读控件显示值或详情回查，富文本字段必须按 Quill 处理。

## 2026-05-07 转盘抽奖严格 UI 奖品表和预报名定位二次修正
- 业务线：活动列表 / 转盘抽奖。
- 场景：严格浏览器模式继续创建转盘抽奖草稿，用户指出选择 `是否支持预报名=支持` 后停顿过久、奖品行选择后误触上一行金额、中途有无意义校验。
- 失败表现：脚本先查找不存在的 `预报名模板` label 导致默认等待 30 秒；奖品表误把禁用的 `有效期（天）` 当作可填列；奖品选择后点击页面左上角空白收起下拉导致页面跳到 `/index`；奖品标记按最后一个 `.el-select` 可能展开错误下拉；累计次数再权重配置误填到 `用户UID` radio，详情中权重保存为 `0`。
- 失败原因：多个 Element UI 表格存在禁用列、横向滚动和下拉重复结构，不能依赖全局 input 序号、最后一个 select 或页面空白点击；预报名派生字段真实 label 为 `预报名模版`，不是 `预报名模板`。
- 解决方式：普通输入统一使用具体 locator/element `fill()`，取消奖品选择后的逐行中间断言和无业务意义的抽奖权重配置探测；预报名选择支持后直接等待并填写 `预报名模版/开始时间/结束时间`；奖品表按真实列序填写 `奖金金额(USDT)`、`总库存数量`、`权重（%)`，跳过禁用有效期列；奖品标记按 placeholder `请选择奖品标记` 定位；累计次数权重明确填第 2 列权重 input。
- 验证结果：重跑严格 UI 创建活动 ID `9013`，别名 `strict-ui-lottery-20260507060925`，列表按 `showUrl` 回查 `total=1`；详情回查 `prizeCount=8`、最后奖品 `linkPrizeId=510`、FAQ `FAQ title/<p>FAQ content</p>`、`prizeColorTagWeightConfig=2`、`prizeLimited=1`、`prizeWeight=8` 且 8 个权重均为 `12.5`、`taskConfig=1`、`activityConfigI18n=2`、`isPreApply=1`。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 预报名 / 抽奖奖品配置 / 累计次数再权重配置`。
- 后续处理：正式沉淀脚本时应把表格列定位、placeholder 下拉定位和快速 label 失败逻辑抽到公共 Element UI helper，避免业务脚本继续硬编码。

## 2026-05-07 转盘抽奖严格 UI 提交响应提示别名重复但记录已落库
- 业务线：活动列表 / 转盘抽奖。
- 场景：通过 action cache 可见浏览器模式再次创建复杂转盘抽奖草稿。
- 失败表现：提交阶段捕获到 `POST /prod-api/activity/config` HTTP 200、业务 `code=500`、`msg=别名重复`，页面 message 也显示 `别名重复`；但回列表按本次 `showUrl` 查询已命中活动 ID `9019`。
- 失败原因：页面提交阶段可能出现重复提交或后端返回了后续重复别名响应；单看最后捕获的 POST 响应或 toast 会误判创建失败。
- 解决方式：提交后必须回 `/activities/lottery` 列表页按活动别名 `showUrl` 查询，并进一步详情回查关键配置；只有列表和详情都不存在时才判定创建失败。
- 验证结果：详情回查 ID `9019`，状态 `DRAFT`；`prizeCount=8`、最后奖品 `linkPrizeId=517`、累计次数权重 8 个均为 `12.5`、颜色签 2 组、每日限制 1 行、任务 1 条、多语言 2 条、FAQ 内容已保存。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 提交后验证`。
- 后续处理：如该提示重复出现，应检查提交按钮是否被重复触发，并把创建响应采集改为记录全部匹配 POST，而不是只取单个响应。

## 2026-05-07 转盘抽奖严格 UI 新手活动合约任务开关定位
- 业务线：活动列表 / 转盘抽奖。
- 场景：可见浏览器模式创建差异化转盘抽奖草稿，要求开启 `新手活动合约任务`，同时配置不同奖品金额、库存、权重和红白签权重。
- 失败表现：首次重跑在 `活动任务信息` 模块报错 `beginner task switch missing`，未触发提交，未创建活动。
- 失败原因：开关实际是 `.el-switch ml20`，文本包含 `禁用新手活动合约任务 / 启用新手活动合约任务`；旧定位从标题反查容器，未稳定命中该开关。
- 解决方式：改为直接在可见 `.el-switch` 中按文本 `启用新手活动合约任务` 定位，点击后再填写任务表内排序系数。
- 验证结果：重跑创建活动 ID `9020` 成功；详情回查 `showBeginnerTaskConfig` 包含 1 条 `{ sorted: 2, taskType: "TRADING_VOLUME" }`，差异化奖品金额 `[1,2,3,4,5,6,7,8]`、库存 `[80,90,100,110,120,130,140,150]`、奖品权重 `[5,8,10,12,13,15,17,20]`、红签权重 `[4,6,8,10,12,14,18,28]`、白签权重 `[3,7,9,11,13,15,19,23]` 均保存。
- 关联流程：`活动列表 / 转盘抽奖 / 新增 / 活动任务信息 / 新手活动合约任务`。
- 后续处理：如果要长期复用差异化配置，应将 `LOTTERY_VARIANT=varied` 模式接入 action cache 参数，而不是仅通过环境变量触发。

## 2026-05-07 转盘抽奖活动自然语言缓存误命中任务链路
- 业务线：活动列表 / 转盘抽奖。
- 场景：用户要求“创建一个带权重配置的 转盘抽奖活动 全配置 浏览器模式”。
- 失败表现：自然语言 dry-run 命中 `create_roulette_participant_scope_tasks`，而不是 `create_lottery_activity_draft`；未执行写操作。
- 失败原因：转盘抽奖活动创建的缓存评分要求同时包含 `活动列表` 和 `转盘抽奖`，用户只说了 `转盘抽奖活动`；任务缓存因 `转盘抽奖` 和通用意图词得到低分但成为最高候选。
- 解决方式：真实执行改用显式 `--action create_lottery_activity_draft`；同时调整 matcher，当查询包含 `转盘抽奖活动` 或 `活动...转盘抽奖` 且有创建/配置/全配置/权重配置意图时，提高活动创建缓存评分，并放宽参数推断入口。
- 验证结果：显式 action 使用可见浏览器 UI 创建活动 ID `9022` 成功；详情回查 `prizeWeightConfig`、差异化奖品、红白签、累计次数再权重和新手合约任务均保存。
- 关联流程：`scripts/cache/matcher.mjs`、`scripts/run-cached-action.mjs`、`活动列表 / 转盘抽奖 / 新增`。
- 后续处理：后续自然语言回归必须覆盖“不带活动列表但带转盘抽奖活动”的创建请求。

## 2026-05-07 转盘抽奖 FAQ 定位随页面结构漂移
- 业务线：活动列表 / 转盘抽奖。
- 场景：为行操作删除验证临时创建转盘抽奖草稿时，严格 UI 脚本执行到 `常见问题` 模块。
- 失败表现：旧定位 `.el-card` + `input[placeholder="请输入标题"]` 超时，未触发创建提交。
- 失败原因：当前页面 FAQ 组件结构与旧 `.el-card` 假设不一致；英语 FAQ 勾选后应从 `常见问题` 标题往后定位标题输入和 Quill 富文本。
- 解决方式：脚本改为从模块标题后查找 `placeholder` 包含 `标题` 的输入；若没有默认问题行，先点击该模块后续的 `+` 图标，再填写标题和 `.ql-editor` 内容。
- 验证结果：重跑严格 UI 创建活动 ID `9024` 成功，列表按别名回查 `total=1`。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`活动列表 / 转盘抽奖 / 新增 / 常见问题`。
- 后续处理：后续抽公共 helper 时，FAQ 应按模块标题和富文本类型定位，不再依赖 `.el-card`。

## 2026-05-07 转盘抽奖复制接口返回系统繁忙
- 业务线：活动列表 / 转盘抽奖。
- 场景：可见浏览器模式在转盘抽奖列表点击操作列 `复制`。
- 失败表现：上线活动 `9023` 和草稿活动 `9022` 均触发 `POST /prod-api/activity/config/copy`，HTTP 200 但业务 `code=500`，提示 `system busy, please retry later`，未创建复制记录。
- 失败原因：后续确认根因是源活动别名过长；不是前端按钮未命中，也不是复制链路不可测。
- 解决方式：回归链路必须先新建或选取 `showUrl` 小于 10 字符的源活动；复制出的草稿继续使用小于 10 字符的新别名。删除用例直接删除草稿状态活动。
- 验证结果：当前 `lottery-activity-fast-api.mjs` 已固定生成短别名草稿并删除复制出的草稿；`docs/workflows/lottery-regression-manifest.json` 已移除 AC-15/ST-03 阻塞标记。
- 关联流程：`活动列表 / 转盘抽奖 / 操作列 / 复制`。
- 后续处理：已吸收到固定执行路径；后续不要再把 AC-15/ST-03 标为阻塞风险。

## 2026-05-11 转盘抽奖前端展示活动必须及时上线
- 业务线：活动列表 / 转盘抽奖 / 前端展示验证。
- 场景：批量创建 5 个不同 `抽奖样式` 的转盘抽奖活动，并访问前端 `/events/draw/<活动别名>` 验证展示。
- 失败表现：先连续创建多条活动再统一上线时，部分活动的开始时间已经早于当前时间，导致列表行 `上线` 不再可直接执行；草稿 URL 即使能打开，也不能作为前端展示成功。
- 失败原因：开始时间按创建前一次性计算，批量 UI 创建耗时较长；上线动作要求活动时间仍满足后台校验。前端活动页只应验证已上线活动。
- 解决方式：多活动前端展示链路应按“创建一个 -> 必要时更新开始/结束时间 -> 上线一个 -> 前端登录态验证一个”执行；如果已经创建完成但时间过期，先用 `PUT /prod-api/activity/config` 调整到未来时间，再通过列表行 `上线` 确认框填验证码上线。
- 验证结果：5 个活动均调整为未来开始时间后上线成功，列表回查状态 `ONLINE`、`stage=NOT_START`，前端登录态访问均命中活动标题且无失败响应。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`活动列表 / 转盘抽奖 / 上线`、前端 `events/draw`。
- 后续处理：已补充到转盘抽奖 operation 和 action-cache 文档；缓存脚本仍只负责创建草稿，上线和前端验证作为复合链路单独执行。

## 2026-05-11 转盘抽奖五种样式配置差异
- 业务线：活动列表 / 转盘抽奖 / 抽奖样式。
- 场景：分别创建 `圆形转盘`、`飞镖转盘`、`彩蛋`、`环形跑马灯`、`足球射门` 活动。
- 失败表现：`彩蛋` 样式提交前 `prizeConfigForm.submit()` 返回 `false`；`足球射门` 样式 FAQ 标题定位可能不存在而导致非必要阻塞。
- 失败原因：`彩蛋` 奖品表额外要求每行选择 `彩蛋类型`；不同样式下页面结构有差异，FAQ 不是前端展示验证的核心必填项。
- 解决方式：脚本在 `LOTTERY_STYLE=彩蛋` 时为 8 行奖品填 `金蛋/银蛋/铜蛋`；FAQ 标题定位不到时跳过，不阻塞活动创建。
- 验证结果：5 种样式活动均创建并上线成功，前端页面分别展示对应活动标题。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`references/operations/activity-management-lottery.md`。
- 后续处理：已吸收到固定脚本和 operation 文档；后续如果 FAQ 被用户指定为验证目标，再单独补强样式差异下的 FAQ 定位。

## 2026-05-12 转盘抽奖近未来开始时间按本地时区误填
- 业务线：活动列表 / 转盘抽奖 / 新增并上线。
- 场景：用户要求重新配置上线一个 10 分钟后开始的转盘抽奖活动，首次按本地 CEST 当前时间 +10 分钟填写活动开始时间。
- 失败表现：关闭预报名后提交触发 `POST /prod-api/activity/config`，HTTP 200 但业务 `code=500`，提示 `开始时间不可小于现在时间`，列表按别名回查 `total=0`。
- 失败原因：staging 后台服务按 admin 业务时区（UTC+8）校验活动开始时间；本地 CEST 的近未来时间在服务端视角已经早于当前时间。首次尝试还使用默认预报名时间，与当前活动时间不匹配，导致 `baseForm=false` 且未触发创建接口。
- 解决方式：用户确认“不预报名，正常设置比赛开始结束时间”后，设置 `是否支持预报名=不支持`；近未来开始/结束时间改按 UTC+8 业务时区计算，活动开始时间为后台当前时间 +10 分钟，结束时间为开始后 7 天。
- 验证结果：重跑创建活动 ID `9049`，别名 `lottery-10min-20260512034826`；`POST /prod-api/activity/config` 业务 `code=200`，列表回查 `status=DRAFT`、`stage=NOT_START`；随后列表行 `上线` 确认触发 `POST /prod-api/activity/lottery/online` 业务 `code=200`，最终回查 `status=ONLINE`、`stage=NOT_START`。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`活动列表 / 转盘抽奖 / 新增 / 上线`。
- 后续处理：已补充到 `references/operations/activity-management-lottery.md`；后续自然语言出现“10 分钟后/近未来开始”时，创建前必须按后台业务时区刷新时间，并根据用户要求显式关闭预报名。

## 2026-05-12 转盘抽奖合约任务强制长任务名未落值
- 业务线：活动列表 / 转盘抽奖 / 新增并上线 / 活动任务信息。
- 场景：用户要求“创建一个转盘抽奖活动，所有用户都可以报名，且有合约交易的转盘抽奖任务，如果没有则创建，6 分钟以后开赛，完成后上线，浏览器模式”。
- 失败表现：首次可见 UI 创建时强制传入长任务名 `自动化测试-转盘-合约100-奖次1000-20260507`，提交前诊断 `activityTaskForm=false`，未触发 `POST /prod-api/activity/config`，别名 `lottery-6min-contract-20260512174047` 列表回查 `total=0`。
- 失败原因：活动任务下拉按长名称选择和模块 `+` 添加没有形成有效任务配置行；页面无表单错误但 `activityTaskForm.submit()` 返回 `false`，说明任务模块状态未绑定成功。
- 解决方式：重跑时不强制长名称过滤活动任务下拉，改为选择页面可用转盘任务，并显式开启 `新手活动合约任务` 开关；近未来活动时间重新按后台 UTC+8 当前时间 +6 分钟计算，且 `是否支持预报名=不支持`。
- 验证结果：重跑创建活动 ID `9087`，别名 `lottery-6min-contract-20260512174523`；`POST /prod-api/activity/config` 业务 `code=200`，详情回查 `showBeginnerTaskConfig` 包含 `{ taskType: "TRADING_VOLUME", sorted: 2 }`；列表行 `上线` 触发 `POST /prod-api/activity/lottery/online` 业务 `code=200`，最终回查 `status=ONLINE`、`stage=NOT_START`。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`活动列表 / 转盘抽奖 / 新增 / 活动任务信息 / 新手活动合约任务 / 上线`。
- 后续处理：2026-05-13 已按用户纠正补强指定转盘抽奖任务下拉选择、加号落行和排序系数填写逻辑，后续用户明确要求“转盘抽奖任务中的合约交易任务”时不得用 `新手活动合约任务` 开关替代。

## 2026-05-13 转盘抽奖任务配置与编辑页时间模型不同步
- 业务线：活动列表 / 转盘抽奖 / 新增并上线 / 活动任务信息 / 修改时间。
- 场景：用户要求创建不同样式转盘抽奖活动，不预报名，比赛时间 4 分钟后开始，使用 `活动任务信息` 模块下 `转盘抽奖任务配置` 中的合约交易任务，并上线。
- 失败表现：首次用 `新手活动合约任务` 开关不符合用户目标；随后选择 `转盘抽奖_合约交易量_retry_20260504204324` 未落行，提交前 `activityTaskForm=false`。改选下拉可见任务 `4873-自动化测试-转盘-合约100-奖次1000-20260507` 后能落行，但未填 `排序系数` 时 `activityTaskForm.submit()` 仍为 `false`。创建成功后因耗时导致开始时间过期，编辑页只改可见日期输入并点击保存，`PUT /prod-api/activity/config` 返回 `code=200`，但详情回查 `startTime` 仍是旧值，后续上线返回 `发布上线时间已超过活动开始时间，请调整后再发布上线`。
- 失败原因：活动任务下拉数据源是 `GET /prod-api/activity/task/all?activityType=5`，需要选择后点击活动任务卡片内 `+` 并填写行内 `排序系数` 才会形成有效 `taskConfig`。编辑页日期输入值与 Vue 组件模型 `baseForm.form.startTime/endTime` 可能不同步，只改 DOM input 不会进入保存 payload。
- 解决方式：脚本 `strict-lottery-visible-attempt.mjs` 改为限定在 `活动任务信息` 卡片内选择 `4873` 或匹配 `转盘/合约` 的任务，点击卡片主按钮 `+`，确认表格行出现后填写 `排序系数=1`。修改已创建草稿时间时，同时更新可见输入和 `baseForm.form.startTime/endTime`，并校验 `PUT` payload 与详情回查时间一致后再点击列表行 `上线`。
- 验证结果：活动 ID `9093` 创建并上线成功；别名 `lottery-4min-dart-contract-20260513110241`，状态 `ONLINE`、阶段 `NOT_START`，时间 `2026-05-13 19:45:51` 至 `2026-05-20 19:15:51`，详情回查 `taskConfigIds=[4873]`，任务 `taskType=TRADING_VOLUME`、`requiredVolume=100`；上线接口 `POST /prod-api/activity/lottery/online` 返回 `code=200`。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`活动列表 / 转盘抽奖 / 新增 / 活动任务信息 / 修改 / 上线`。
- 后续处理：已把指定转盘合约任务落行逻辑吸收到创建脚本，并补充 operation 文档；后续近未来上线若创建耗时较长，应优先设置更大的未来窗口或在上线前用模型级时间更新确认详情回查。

## 2026-05-13 转盘抽奖多任务只落一行
- 业务线：活动列表 / 转盘抽奖 / 新增并上线 / 活动任务信息。
- 场景：用户要求配置一个无预报名、5 分钟后开赛并上线的转盘抽奖活动，同时包含充值任务、现货交易任务和合约交易任务。
- 失败表现：首次尝试别名 `lottery-3tasks-5min-20260513141436` 未创建，提交前 `activityTaskForm=false`。
- 失败原因：旧脚本只按单任务路径处理，未对每个任务执行“选择任务 -> 点击活动任务卡片 `+` -> 等待新增行 -> 填排序系数”，导致多任务配置未形成有效 `taskConfig`。
- 解决方式：`strict-lottery-visible-attempt.mjs` 增加 `LOTTERY_ACTIVITY_TASK_LABELS`，支持 `|` 或逗号分隔多个任务；每个任务独立选择并点击卡片 `+`，按新增行匹配任务 ID，逐行填写 `排序系数`，最后校验任务行数。
- 验证结果：重试创建并上线活动 ID `9098`，标题 `三任务转盘`，别名 `lottery-3tasks-5min-20260513141842`；详情回查 `status=ONLINE`、`stage=NOT_START`、`isPreApply=0`，任务包含充值 `4744`、现货 `4874`、合约 `4873`。
- 关联流程：`skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs`、`skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs`、`活动列表 / 转盘抽奖 / 新增 / 活动任务信息 / 上线`。
- 后续处理：已吸收到脚本参数和 operation/action-cache 文档；后续同类多任务活动必须走多任务逐个落行校验。

## 2026-05-25 后管主回归创建活动开始时间被判定为“已过期”

- 业务线：活动列表 / 转盘抽奖 / 新增（headless UI）。
- 场景：执行 `lottery-admin-main-regression` 创建“后管主回归”草稿活动，传入 `--start/--end`。
- 失败表现：`POST /prod-api/activity/config` 返回 HTTP 200 但业务 `code=500`，`msg=开始时间不可小于现在时间`，导致后续列表验证/上下线阶段全部被跳过。
- 失败原因：回归调度里把“上海时区时间窗口”误按 UTC 字段格式化，导致传入的 `startTime` 在后端时区解释下落到过去。
- 解决方式：时间窗口改为“按真实当前时间戳 + offset 计算”，再用 `Asia/Shanghai` 直接格式化字符串；确保开始时间永远在未来（默认 +30 分钟）。
- 验证结果：修复后使用同链路创建活动不再命中该后端校验。

## 2026-06-07 人人代理(AGENT) 通用回归上线被现存在线活动拦截

- 业务线：活动列表 / 人人代理(AGENT) / 通用回归。
- 场景：执行 `node orchestrations/full-regression/scripts/run-full-regression.mjs --selection '后管回归' --confirm-run`，其中 `regression-agent-universal-from-scratch.mjs` 从零创建报名模板、赠金奖品、邀请/被邀请任务与草稿活动后尝试上线。
- 失败表现：活动 `10036 / agr50994164` 草稿创建与 `draft-checks` 均成功，但 `online` 返回 HTTP 200、业务 `code=500`、`msg=已有上线状态的人人代理活动`，导致整轮活动后管全量回归以 `FAIL 1` 结束。
- 失败原因：staging 环境同一时刻只允许存在已上线状态的人人代理活动；当前通用回归脚本在上线前未做“现存 AGENT 在线活动”只读前置检查，因此命中后端单活动限制。
- 解决方式：本次失败后脚本补偿清理成功，已删除活动、任务、奖品和报名模板；后续固定路径应在 `AGENT` 通用回归上线前先回查是否已有在线 `AGENT` 活动，若存在则直接按前置条件失败返回，并在汇总中标记为环境阻塞，而不是创建后再撞后端校验。
- 验证结果：失败产物 `result/universal-regression/20260607_185002/AGENT_universal_from_scratch_failed.md` 显示 `cleanup_on_failure=PASS`；清理接口 `deleteActivity/deleteInviteTask/deleteInvitedTask/deletePrize/deleteRegisterTemplate` 均返回 `code=200`。同日全量回归 `result/universal-regression/20260607_193419/AGENT_universal_from_scratch_failed.md` 再次复现相同 `code=500 / 已有上线状态的人人代理活动`，说明该前置检查尚未前移到固定路径。
- 关联流程：`skills/weex-admin-ops/scripts/regression-agent-universal-from-scratch.mjs`、`orchestrations/full-regression/scripts/run-full-regression.mjs`。
- 后续处理：待把“在线 AGENT 活动存在检查”前置到 `AGENT` 通用回归脚本；完成固定路径验证后，可删除本条失败复盘。
- 关联流程或脚本：`skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs`、`skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs`。

## 2026-05-29 交易竞速赛总入口未透传 draft-checks 的 activityId

- 业务线：活动列表 / 交易竞速赛 / 无头总入口。
- 场景：执行 `race-config-wizard-api.mjs` 的 `minimal_create_verify_delete`。
- 失败表现：`create-draft`、`update-modules` 已成功，但 `draft-checks` 报错 `--activity-alias or --activity-id is required`，导致 cleanup 未执行并残留草稿 `9700 / sr51743667`。
- 失败原因：总入口只把 `activityId` 传给 `update-modules`，没有继续传给后续 `draft-checks`。
- 解决方式：`create-draft` 成功后缓存 `activityId`，后续 `draft-checks` 自动补齐 `--activity-id <createdId>`；并删除残留草稿 `9700`。
- 验证结果：修复后 `minimal_create_verify_delete` 成功跑通，活动 `9701 / sw51783658` 创建、更新、回查、删除全通过；`full_create_verify_delete` 也通过，活动 `9702 / sx51798404` 无残留。
- 关联流程或脚本：`skills/weex-admin-ops/scripts/race-config-wizard-api.mjs`。
- 后续处理：已吸收到固定执行路径。
