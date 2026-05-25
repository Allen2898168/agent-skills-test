# Activity Management Lottery - Row Actions And Cache

Status: verified
Last verified: 2026-05-25

## Row Actions

Visible-browser checks on 2026-05-07:
- Online activity `9023` (`strict-ui-lottery-20260507200430`) showed row actions `查看` / `修改` / `下线` / `复制`; no `删除` button was visible. This matches the rule that online activities cannot be deleted.
- `查看` opened `/activities/lottery/view?activityId=9023` and triggered `GET /prod-api/activity/config/9023` with business `code=200`.
- `修改` opened `/activities/lottery/edit?activityId=9023`; the original online activity was not saved during row-action validation.
- `复制` on both online `9023` and draft `9022` triggered `POST /prod-api/activity/config/copy`, but backend returned business `code=500`, `system busy, please retry later`; no copied row was created.
- The latest dev feedback attributes that failure to the source activity alias being too long, not to a newly generated copied alias.
- A temporary draft `9024` was created through the strict visible UI path to continue row-action checks. Its row actions included `查看` / `修改` / `上线` / `删除` / `复制`.
- `修改` on draft `9024` opened `/activities/lottery/edit?activityId=9024`; changing `活动副标题` and clicking the page `保存` button triggered `PUT /prod-api/activity/config` with business `code=200` and page message `编辑成功`.
- `删除` on draft `9024` opened a confirmation dialog `确认删除该活动吗`; the verification input auto-focused. Fill the fixed staging verification code, then click the bottom-right `确定`. The page triggered `POST /prod-api/activity/lottery/delete`, business `code=200`, and alias search returned `total=0`.
- `上线` follows the same confirmation pattern: click `上线`, fill the verification input in the confirmation dialog, then click `确定`. The verified endpoint is `POST /prod-api/activity/lottery/online`, business `code=200`.

Non-visible/headless checks on 2026-05-07:
- Temporary draft `9025` (`strict-ui-lottery-20260507212249`) was created in headless mode and used for row-action verification.
- `查看` opened `/activities/lottery/view?activityId=9025`; detail request returned business `code=200`.
- `修改` opened the edit page, changed `活动副标题`, clicked `保存`, triggered `PUT /prod-api/activity/config` with business `code=200`, and detail re-query matched the updated subtitle.
- `复制` again triggered `POST /prod-api/activity/config/copy` and returned business `code=500`, `system busy, please retry later`.
- `删除` filled the verification input in the confirmation dialog and clicked `确定`; `POST /prod-api/activity/lottery/delete` returned business `code=200`, and alias search returned `total=0`.

Headless real-UI checks on 2026-05-14:
- Activity `9107` (`jonathan-test-20260514051431`) was created through `create-lottery-activity-draft.mjs --headless-ui`.
- The stable path reused the real UI add page, completed prize rows, task rows, multilingual config, FAQ, calendar, and submit, then verified the draft by alias search `showUrl=jonathan-test-20260514051431`.
- The same activity was then put online from the list row action `上线`; the confirmation dialog required the verification input and triggered `POST /prod-api/activity/lottery/online` with business `code=200`.
- Detail re-query confirmed `status=ONLINE`, `stage=NOT_START`, `taskConfigIds=[4996,4997,4998]`, `taskConfig` count `3`, and `activityConfigI18n` count `2`.

## Known Failure Avoidance

- Load `skills/weex-admin-ops/.env.local` through `loadLocalEnv(process.cwd())` or a resolved skill root; relative `pathsFrom('./...')` can miss local login variables in inline scripts.
- Treat DOM nodes as nodes, not strings, when extracting labels or options.
- Do not fill all prize table inputs by index; the first column is the locked prize-pool ID.
- Do not fill the disabled `有效期（天）` prize column; current verified rows start editable data at `奖金金额(USDT)`.
- When selecting prize rows in the visible UI, do not assume a clicked dropdown option is already bound. Read back the row prize input value after selection and require all eight rows to be non-empty before submission.
- Activity task rows appear only after clicking the module-level `+`.
- Scope language checkboxes to the current `多语言` or `常见问题` container to avoid cross-module selection.
- `预报名模版` uses the character `模版` in the current page label. Looking first for `预报名模板` causes unnecessary timeout.
- Avoid clicking arbitrary blank page coordinates to close dropdowns; in the admin shell this can hit navigation and leave `/activities/lottery/add`.
- Edit pages use bottom button text `保存`, not `修改`; row-action scripts must click the real bottom `保存` button and require a `PUT /prod-api/activity/config` business `code=200`.
- For `删除` and `上线`, the confirmation dialog requires filling the verification input before clicking `确定`; opening the dialog or clicking confirm without the code is not sufficient.
- Do not mark lottery delete as passed unless `POST /prod-api/activity/lottery/delete` returns business `code=200` and alias search returns `total=0`.
- Direct API calls to `/prod-api/activity/lottery/online` with guessed fields such as `googleCode` or `code` returned `google验证码不得为空` on 2026-05-11. Until the real payload key is proven, use the UI confirmation dialog for online operations.
- When the user asks to create several frontend-display lottery activities, prefer create -> online -> frontend verify per activity. If batching is still used, refresh every activity's time immediately before online.
- For near-future activities, refresh time using the backend/admin business timezone before creation or before updating the draft. A start time that is future in the local machine timezone can still fail server validation.
- Before the 2026-05-25 fix, `活动结束时间` could appear filled while `baseForm.endTime` stayed empty; the create request was then never sent. Treat successful Vue model binding, not just visible text, as the real pass condition.
- Before the 2026-05-25 fix, clicking a generic visible `新增` target was unstable on the long add page. Use the bottom-most visible submit button.

## Cache

Action cache entry:
- `create_lottery_activity_draft`
- Script: `scripts/create-lottery-activity-draft.mjs`
- Current status: candidate.

Action cache entry:
- `online_lottery_activity`
- Script: `scripts/online-lottery-activity.mjs`
- Current status: candidate.

Use:

```bash
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "活动列表 转盘抽奖 新增草稿 浏览器模式" --dry-run
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "活动列表 转盘抽奖 新增草稿 浏览器模式"
node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_lottery_activity_draft --visible --style 彩蛋 --title-prefix 前端展示彩蛋 --alias-prefix frontend-draw-egg --start "2026-05-11 17:52:01" --end "2026-05-18 17:52:01"
node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_lottery_activity_draft --visible --no-preapply --title-exact 三任务转盘 --subtitle 5分后开赛 --alias-exact zp3t0d --activity-task-labels "4744-转盘抽奖_充值任务_20260504203222|4874-自动化测试-转盘-现货1000-奖次1000-20260507|4873-自动化测试-转盘-合约100-奖次1000-20260507"
node skills/weex-admin-ops/scripts/run-cached-action.mjs --action online_lottery_activity --activity-alias jonathan-test-20260514051431
node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "上线活动别名 jonathan-test-20260514051431"
```

Actual writes support both `--visible` and `--headless-ui`, and both modes use the same strict real-UI workflow. The cache entry still creates a draft only; online and frontend-display verification remain separate steps.
