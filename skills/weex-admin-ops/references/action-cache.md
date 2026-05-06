# Action Cache

The action cache is the first execution layer for workflows that have already been proven and scripted.

## Execution Policy

1. Before manual browser exploration, check `scripts/action-cache.json`.
2. If the user request matches a cached action and required parameters can be inferred or safely defaulted, run `scripts/run-cached-action.mjs`.
3. If the cached script succeeds, report the result and verification evidence.
4. If the cached script fails, preserve the failure output, then fall back to the normal workflow:
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
