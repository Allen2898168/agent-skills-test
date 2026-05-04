# Action Cache

The action cache is the first execution layer for workflows that have already been proven and scripted.

## Execution Policy

1. Before manual browser exploration, check `scripts/action-cache.json`.
2. If the user request matches a cached action and required parameters can be inferred or safely defaulted, run `scripts/run-cached-action.mjs`.
3. If the cached script succeeds, report the result and verification evidence.
4. If the cached script fails, preserve the failure output, then fall back to the normal workflow:
   - use or follow `web-access`;
   - inspect the current page;
   - execute manually with browser automation;
   - update the cache if the fix is reusable.

## Cached Actions

| Action ID | Script | Status | Purpose |
| --- | --- | --- | --- |
| `create_prizes` | `scripts/create-prizes.mjs` | candidate | Create one or more prize records with known prize-management defaults. |
| `copy_prize_by_id` | `scripts/copy-prize.mjs` | candidate | Copy one prize by `奖品ID` and verify the copied row appears. |

## Natural-Language Matching

For prize creation requests, cached execution can be used when the request includes:
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
