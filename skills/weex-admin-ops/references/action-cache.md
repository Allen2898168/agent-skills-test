# Action Cache

The action cache is the first execution layer for workflows that have already been proven and scripted.

## Execution Policy

1. Before manual browser exploration, check `scripts/action-cache.json`.
2. If the user request matches a cached action and required parameters can be inferred or safely defaulted, run `scripts/run-cached-action.mjs`.
3. If the user explicitly requests browser/visible mode for a state-changing operation, the cached script must perform the write through page UI actions. A headed browser plus direct API write is not sufficient.
4. Invisible/background cached scripts may use API-assisted execution for proven workflows when they still verify the business response and resulting record.
5. If the cached script succeeds, report the result and verification evidence.
6. If the cached script fails, preserve the failure output, then fall back to the normal workflow:
   - use project Playwright browser automation by default;
   - use optional `web-access`/CDP only when Chrome login-state reuse or live browser context is required;
   - inspect the current page;
   - execute manually with browser automation;
   - update the cache if the fix is reusable.

## Cached Actions

| Action ID | Script | Status | Purpose |
| --- | --- | --- | --- |
| `create_prizes` | `scripts/create-prizes.mjs` | candidate | Create one or more prize records with known prize-management defaults. |
| `copy_prize_by_id` | `scripts/copy-prize.mjs` | candidate | Copy one prize by `奖品ID` and verify the copied row appears. |
| `create_roulette_participant_scope_tasks` | `scripts/create-roulette-participant-scope-tasks.mjs` | candidate | Create `转盘抽奖` single-reward tasks by `任务参与范围`; visible and invisible modes verified on 2026-05-05. |
| `create_register_templates` | `scripts/create-register-templates.mjs` | candidate | Create activity user registration templates by signup mode and selected platform/restriction scopes; visible and invisible modes verified on 2026-05-06. |
| `verify_register_template_row_actions` | `scripts/register-template-row-actions.mjs` | candidate | Create a temporary registration template, verify `查看` / `修改` / `删除`, and delete the temporary record; visible and invisible modes verified on 2026-05-06. |
| `delete_register_templates_by_operator` | `scripts/delete-register-templates-by-operator.mjs` | candidate | Dry-run and delete activity registration templates by exact `最近编辑人`; destructive execution requires `--confirm-delete`; invisible deletion and visible/invisible dry-run verified on 2026-05-06. |
| `create_guide_templates` | `scripts/create-guide-templates.mjs` | candidate | Create activity guide-flow templates for verified activity-type/frequency/step combinations; visible and invisible modes verified on 2026-05-06. |
| `verify_guide_template_row_actions` | `scripts/guide-template-row-actions.mjs` | candidate | Create a temporary activity guide template, verify `查看` / `修改` / `复制` / `删除`, and delete the temporary records; visible and invisible modes verified on 2026-05-06. |
| `lottery_admin_main_regression` | `scripts/lottery-admin-main-regression.mjs` | candidate | Run the lottery admin regression orchestration. Headless mode uses API fast paths for backend fixture creation, activity status flow, and row-action equivalents; visible mode keeps real UI writes. |
| `create_lottery_activity_draft` | `scripts/create-lottery-activity-draft.mjs` | candidate | Create a draft `活动列表 / 转盘抽奖` activity through the verified real-UI workflow, with configurable time and lottery style. |
| `online_lottery_activity` | `scripts/online-lottery-activity.mjs` | candidate | Put a draft `活动列表 / 转盘抽奖` activity online through the verified list-row confirmation flow. |

## Natural-Language Matching

For prize creation and roulette participant-scope requests, cached execution can be used when the request includes:
- an intent such as `创建`, `新增`, `生成`;
- an object such as `奖励`, `奖品`;
- enough type information, or a safe default pattern.

Examples:
- `创建3个ETH币种奖励`
- `浏览器模式创建2个BTC币种奖品`
- `创建一个赠金奖励`
- `创建3个虚拟积分或资格/积分奖品`
- `复制奖品id为462的奖品`
- `浏览器模式复制奖品ID 462`
- `浏览器模式创建转盘抽奖不同参与范围任务，uid用9881271952，国家用中国`

For roulette participant-scope tasks:
- use `--action create_roulette_participant_scope_tasks` for explicit execution;
- default browser mode is invisible, and `--visible` enables headed browser mode;
- pass `--uid` when scopes include `agent` or `user`;
- pass `--country` or `--country-first` when scopes include `country`;
- run `--dry-run` before any actual creation because the script writes activity-task records.

For activity user registration templates:
- use `--action create_register_templates` for explicit execution;
- default browser mode is invisible, and `--visible` enables headed browser mode;
- pass `--signup-modes auto,manual,team,auto_manual` to create all four signup-mode templates;
- pass `--platform-scope agent_user` for `指定参赛代理或用户`;
- pass `--platform-scopes extended` for `指定渠道码或邀请码`, `自然流量`, `非活跃用户`, `仅限渠道用户`, `混合条件`, `指定华语用户`, `指定海外用户`, and `假钱账户`;
- pass `--restrict-scopes all` to cover supported restriction branches, or a csv such as `vip,risk,balance`;
- for `agent_user`, pass `--uid <uid>`; default scripted UID is `9881271952`;
- for `channel_invite`, `--channel-code` and `--invite-code` can override generated defaults;
- `team` mode uses `--min-team 2` by default unless the tester specifies another value;
- pass `--permissions signup,view` to select `限制用户权限`; `signup` maps to `报名`, `view` maps to `看到和进入页面`;
- pass `--people-limit <n>` to fill `报名人数限制`;
- pass `--register-start "yyyy-MM-dd HH:mm:ss"` and `--register-end "yyyy-MM-dd HH:mm:ss"` to enable and bind `可参与注册时间范围`;
- run `--dry-run` before any actual creation because the script writes registration-template records.

For activity user registration row actions:
- use `--action verify_register_template_row_actions` for explicit execution;
- default browser mode is invisible, and `--visible` enables headed browser mode;
- the script creates a temporary all-platform template, verifies `查看`, modifies the template name, opens the delete confirmation, confirms deletion, and verifies the row is absent after search;
- run `--dry-run` before execution because the script creates, modifies, and deletes a registration-template record.

For activity user registration bulk delete:
- use `--action delete_register_templates_by_operator` for explicit execution;
- default browser mode is invisible, and `--visible` enables headed browser mode;
- pass `--operator <name>` to target a recent editor, defaulting to `auto`;
- run the script with `--dry-run` first to list exact candidates and fuzzy rows that will be skipped;
- actual deletion requires `--confirm-delete`;
- the script deletes only rows whose response field `operator` exactly equals the requested operator, then re-queries to verify remaining exact matches.

For activity guide templates:
- use `--action create_guide_templates` for explicit execution;
- default browser mode is invisible and uses the authenticated API write path;
- `--visible` enables headed browser mode and performs the write through page UI clicks, field fills, media uploads, and the dialog `确认` button;
- the default batch creates the 15 verified combinations: 12 supported activity types with `每次访问`, `交易大赛` with all three frequencies, and `交易大赛` with `每次访问` plus two steps;
- pass `--activity-types <csv>`, `--frequencies <csv>`, and `--steps <csv>` to create custom combinations, for example `--activity-types lottery --frequencies every_visit --steps 3 --visible`;
- run with `--dry-run` before actual creation because the script writes guide-template records;
- `暂无特殊配置 / NONE` is a known blocked branch and is excluded by default; pass `--include-none` only when intentionally retesting the backend failure.

For activity guide-template row actions:
- use `--action verify_guide_template_row_actions` for explicit execution;
- default browser mode is invisible; temporary setup may use the authenticated API write path, but row actions are clicked in the browser page;
- `--visible` enables headed browser mode and performs temporary setup plus all row actions through real UI clicks, field fills, uploads, and confirmation buttons;
- the script creates a temporary `转盘抽奖` guide template, verifies `查看`, modifies `活动类型` to `交易竞速赛`, verifies `复制` creates `复制从 <原模板名称>`, deletes the copied and original rows, and verifies exact-name searches are absent;
- run `--dry-run` before execution because the script creates, modifies, copies, and deletes guide-template records.

For lottery activity drafts:
- use `--action create_lottery_activity_draft` for explicit execution;
- `--dry-run` prints the verified creation plan without writing data;
- actual creation supports `--visible` and `--headless-ui`; both modes run the same strict real-UI browser workflow;
- optional parameters include `--title-exact`, `--title-prefix`, `--subtitle`, `--alias-exact`, `--alias-prefix`, `--start`, `--end`, `--style`, `--activity-task-labels`, and `--no-preapply`; verified style labels are `圆形转盘`, `飞镖转盘`, `彩蛋`, `环形跑马灯`, and `足球射门`;
- use `--title-exact`, `--subtitle`, and `--alias-exact` for user-facing short values; prefix options append a timestamp and can violate the 15-character title/subtitle/alias hard rule.
- `--activity-task-labels` accepts one or more `活动任务信息` labels/ids separated by `|` or comma. The script selects each task, clicks the task-card `+`, fills row sort coefficients, and verifies the final row count.
- the verified write path is `活动列表 / 转盘抽奖`, path `/activities/lottery/add`, and uses real page clicks, dropdowns, uploads, table scrolling, and submit in browser mode;
- run `node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "活动列表 转盘抽奖 新增草稿 浏览器模式" --dry-run` to inspect the planned defaults and assertions;
- the script creates draft records only. For frontend display validation, put each activity online with the row `上线` action and verify `POST /prod-api/activity/lottery/online` business `code=200` before opening `https://stg-www.weex.tech/zh-CN/events/draw/<alias>`;
- natural language such as `创建一个带权重配置的 转盘抽奖活动 全配置 浏览器模式` should match this activity-create action, not the roulette task action; when in doubt, use explicit `--action create_lottery_activity_draft`;
- the latest cache-backed visible path was verified through direct script execution on 2026-05-11 for five lottery styles. On 2026-05-14, the same draft-create path was also verified in `--headless-ui` mode for activity `9107`, followed by a successful real-UI online action returning `POST /prod-api/activity/lottery/online` business `code=200`.

For lottery activity online:
- use `--action online_lottery_activity` for explicit execution;
- default mode is invisible/headless real UI, and `--visible` enables headed browser mode;
- pass `--activity-alias <showUrl>` or `--activity-id <id>`; alias is recommended because the row action is driven from the list result;
- the script searches the target row, clicks row action `上线`, fills the verification input in the confirmation dialog, clicks `确定`, and verifies `POST /prod-api/activity/lottery/online` business `code=200` plus final `status=ONLINE`;
- natural language such as `把活动ID 9107 的转盘抽奖活动上线` or `上线活动别名 jonathan-test-20260514051431` should match this action.

For lottery admin main regression orchestration:
- use `--action lottery_admin_main_regression` for explicit execution;
- `--dry-run` prints the staged plan, covered case IDs, and child commands without writing data;
- headless mode defaults to `headless_api`: prize creation/search, prize row actions, registration-template creation/search/row actions, roulette-task creation, lottery draft creation, list checks, online, copy/delete-equivalent, and offline use API calls with list/detail verification;
- visible mode still uses real UI writes for state-changing operations;
- optional parameters include `--title-prefix`, `--alias-prefix`, `--uid`, `--country`, and `--visible`;
- the script reports phase-level results and covered case IDs from `docs/workflows/lottery-regression-manifest.json`;
- latest headless API validation: 2026-05-25, `55 PASS / 0 FAIL / 0 SKIPPED`, report `orchestrations/lottery-regression/artifacts/reports/20260525_163530_api_opt/admin.json`;
- natural language such as `帮我跑一轮转盘抽奖后管主回归自动化` should match this action.

## Cache Graduation Rules

After a conventional browser workflow succeeds:
- If the operation is likely to repeat, turn the stable part into a script.
- Register the script in `scripts/action-cache.json`.
- Keep secrets out of scripts and manifests.
- Keep high-risk parameters out of defaults.
- Add a dry-run mode when possible.
- Add success assertions to the script output.
- Update this file only with short catalog entries; keep implementation details in scripts and operation references.

## Fallback Rules

Cached execution is an optimization, not the source of truth.

Fallback to normal browser operation when:
- matching confidence is low;
- required parameters are missing;
- the script reports a validation or selector failure;
- the page has changed;
- the user explicitly asks to explore manually;
- the requested operation is high-risk and needs confirmation.
