# Prize Management Operations

Business domain:
活动通用模块管理 / 奖品管理。

Use this file for detailed prize-management workflows that would otherwise make `activity-common-module.md` too large.

## Virtual Qualification Field Discovery

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Inspect the add-prize form fields for every `虚拟积分或资格` subtype before creating records.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.

Subtypes:
- `抽奖次数`
- `积分`
- `合约抵扣金`
- `仓位空投`
- `无奖励`
- `VIP体验卡`
- `提升返还比例档位`
- `小丑牌-抽牌次数`
- `小丑牌-积分加成`
- `虚拟盘合约体验金`
- `理财加息券`
- `每日固定收益券`

Observed fields:
- `抽奖次数`: 颜色签、奖品名称、奖品别名、有效时间、奖品单位、奖品展示精度、奖品图片。
- `积分`: 奖品名称、奖品别名、有效时间、奖品单位、奖品展示精度、奖品图片。
- `合约抵扣金`: 奖品名称、奖品别名、领取后有效期、发放有效期、奖品单位、奖品展示精度、奖品图片。
- `仓位空投`: 奖品名称、奖品别名、开仓后有效期、发放有效期、币种、交易对、保证金模式、杠杆倍数、数量、奖品图片。
- `无奖励`: 奖品名称、奖品别名、有效时间、奖品单位、奖品展示精度、奖品图片。
- `VIP体验卡`: VIP类型、VIP等级、VIP有效天数、跳转链接、奖品名称、奖品别名、发放有效期、奖品单位、奖品展示精度、奖品图片。
- `提升返还比例档位`: 奖品名称、奖品别名、奖品单位、奖品展示精度、奖品图片。
- `小丑牌-抽牌次数`: 奖品名称、奖品别名、有效时间、奖品单位、奖品展示精度、奖品图片。
- `小丑牌-积分加成`: 奖品名称、奖品别名、有效时间、奖品单位、奖品展示精度、奖品图片。
- `虚拟盘合约体验金`: 奖品名称、奖品别名、奖品单位、奖品展示精度、奖品图片。
- `理财加息券`: 奖品名称、奖品别名、领取后有效期、发放有效期、奖品单位、奖品展示精度、奖品图片、适用业务类型、币种、加息利率、加息金额、计息资产最小值、计息资产最大值。
- `每日固定收益券`: 同 `理财加息券` 字段结构。

Optional screenshots:
- Directory: `artifacts/screenshots/活动通用模块管理/奖品管理/新增虚拟积分资格字段检查/`.
- Suggested file names per subtype: `01-顶部.png`, `02-底部.png`.

## Create Virtual Qualification Prize By Subtype

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Create `虚拟积分或资格` prizes for each subtype using low-risk default field values.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Prize image exists under `assets/default-prize-images/`.
- If a field is a dropdown, select the first available option unless the tester specifies another value.

Test data pattern:
- Prize category: `虚拟积分或资格`.
- Prize sub-type: target subtype.
- Prize name: `虚拟积分资格_<子类型名字>`.
- English name, when multilingual field is enabled: `Virtual Qualification <subtype>`.
- Prize alias: `auto_virtual_<sequence>_<timestamp>`.
- Validity/day fields: `1`.
- Prize unit: `1`.
- Display precision: `2`.
- Numeric configuration fields: `1` unless a min/max pair is required.
- Prize image: use the selected image from `assets/default-prize-images/`. If exactly one image exists, use that image by default.

General steps:
1. Click `新增`.
2. Select `奖品分类` as `虚拟积分或资格`.
3. Select the target `奖品子类型`.
4. Fill `奖品名称` as `虚拟积分资格_<子类型名字>`.
5. Enable `多语言设置` when the page exposes it for this field.
6. Fill `英语` under `奖品名称多语言设置：`.
7. Fill `奖品别名` with the unique alias.
8. Fill all visible validity, unit, precision, and numeric required fields using safe defaults.
9. For visible dropdowns, select the first available option unless the tester specified another option.
10. Upload the selected prize image.
11. Click `确认`.
12. Search by the unique prize alias.

Subtype-specific defaults:
- `抽奖次数`: select first `颜色签`; observed first option was `红色`.
- `积分`: no extra dropdown observed.
- `合约抵扣金`: use `领取后有效期=1`, `发放有效期=1`.
- `仓位空投`: `交易对` is a multi-select field. Select one or more trade pairs, then click a blank area outside the dropdown to collapse it before filling the remaining fields. Validated with `币种=USDT`, `交易对=合约Pro:ADA/USDT`, and `保证金模式=逐仓-合仓`.
- `无奖励`: use common defaults.
- `VIP体验卡`: select first available `VIP类型` and `VIP等级`; use `VIP有效天数=1`.
- `提升返还比例档位`: use common defaults.
- `小丑牌-抽牌次数`: use common defaults.
- `小丑牌-积分加成`: use common defaults.
- `虚拟盘合约体验金`: use common defaults.
- `理财加息券`: select first `适用业务类型` and first `币种`; observed `自动赚币` and `USDT`; use `加息利率=1`, `加息金额=1`, `计息资产最小值=1`, `计息资产最大值=10`.
- `每日固定收益券`: same finance defaults as `理财加息券`.

Observed batch result:
- Batch timestamp: `20260504035640`.
- Prize image: `assets/default-prize-images/default-bonus-prize.webp`.
- Created `抽奖次数`: ID `433`, alias `auto_virtual_01_20260504035640`.
- Created `积分`: ID `434`, alias `auto_virtual_02_20260504035640`.
- Created `合约抵扣金`: ID `435`, alias `auto_virtual_03_20260504035640`.
- First failed `仓位空投`: alias `auto_virtual_04_20260504035640`; failure message `请选择交易对`.
- Created `仓位空投`: ID `444`, alias `auto_virtual_position_20260504041023`; selected `USDT`, `合约Pro:ADA/USDT`, `逐仓-合仓`.
- Created `无奖励`: ID `436`, alias `auto_virtual_05_20260504035640`.
- Created `VIP体验卡`: ID `437`, alias `auto_virtual_06_20260504035640`.
- Created `提升返还比例档位`: ID `438`, alias `auto_virtual_07_20260504035640`.
- Created `小丑牌-抽牌次数`: ID `439`, alias `auto_virtual_08_20260504035640`.
- Created `小丑牌-积分加成`: ID `440`, alias `auto_virtual_09_20260504035640`.
- Created `虚拟盘合约体验金`: ID `441`, alias `auto_virtual_10_20260504035640`.
- Created `理财加息券`: ID `442`, alias `auto_virtual_11_20260504035640`.
- Created `每日固定收益券`: ID `443`, alias `auto_virtual_12_20260504035640`.

Success assertions:
- Submit request to `/prod-api/activity/prize` returns HTTP 200.
- Page displays `新增成功`.
- Add dialog closes.
- Searching by the unique alias returns the created row.
- Returned row has `奖品分类` equal to `虚拟积分或资格`.
- Returned row has `奖品子分类` equal to the selected subtype.
- Returned row has the expected prize name and alias.

Known issue:
- `仓位空投` has a multi-select `交易对` selector. Do not assume that typing into the visible input binds the select value. Select actual dropdown option(s), then click a blank area outside the dropdown so it collapses before continuing and submitting.
- For `仓位空投`, upload the prize image through the file input inside the `奖品图片` form item. A generic first file input may not bind to the active upload component.

Risk and cleanup:
- This is a staging write operation.
- Created records can likely be removed with row action `删除`, but deletion was not attempted in this flow.

## Prize Row Actions

Status: candidate
Last verified: 2026-05-04
Environment: staging

Purpose:
Validate the `奖品管理` table row action buttons: `查看`, `修改`, `复制`, and `删除`.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Use a dedicated test prize where possible, instead of mutating existing business records.
- If the flow needs to test `删除`, prefer deleting the copied row created in the same test run.

Validated test data:
- Original test prize ID: `473`.
- Original category/subtype: `币种 / BTC`.
- Original alias: `auto_action_btc_20260504161432`.
- Modified prize name: `操作按钮测试_BTC_20260504161432_已修改`.
- Copied row ID: `474`.
- Copied alias observed: `复制从 auto_action_btc_20260504161432`.
- Copied row was deleted during validation.

Steps:
1. Search by the dedicated test prize alias.
2. Click row action `查看`.
3. Verify the detail dialog opens and its input values contain the expected prize name and alias.
4. Close the detail dialog.
5. Search by the test prize alias again.
6. Click row action `修改`.
7. Verify the edit dialog opens and pre-fills the current prize values.
8. Modify `奖品名称` to a unique test value and click `确认`.
9. Search by the same alias and verify the table row shows the modified name.
10. Click row action `复制`.
11. Verify the confirmation message box opens, then click `确定` or `确认`.
12. Search by the original alias and verify the copied row appears at the top or in the returned result set.
13. Verify copied row name starts with `复制从 ` and contains the modified original name.
14. Click `删除` on the copied row.
15. Verify the delete confirmation message box opens, then click `确定` or `确认`.
16. Search by the copied row ID and verify the copied row no longer appears.

Validated backend signals:
- Detail/edit row load: `GET /prod-api/activity/prize/<id>` returns HTTP 200.
- Edit submit: `PUT /prod-api/activity/prize` returns HTTP 200.
- Copy submit: `POST /prod-api/activity/prize/copy` returns HTTP 200.
- Delete submit: `DELETE /prod-api/activity/prize/<copiedId>` returns HTTP 200.
- Search validation: `GET /prod-api/activity/prize/list?...` returns HTTP 200.

Cached script:
- `scripts/copy-prize.mjs --prize-id <id>` copies a single prize by `奖品ID`.
- Natural-language cache examples: `复制奖品id为462的奖品`, `浏览器模式复制奖品ID 462`.
- Dry-run validates intent and parsed `prizeId` without opening a browser.

Optional screenshots:
- Directory: `artifacts/screenshots/活动通用模块管理/奖品管理/操作按钮功能/`.
- Suggested file names:
  - `00-测试奖品创建后列表.png`
  - `01-查看详情弹窗.png`
  - `02-修改弹窗-已回填.png`
  - `03-修改后列表验证.png`
  - `04-复制确认弹窗.png`
  - `05-复制后列表最上方.png`
  - `06-删除确认弹窗.png`
  - `07-删除后搜索无结果.png`

Known issue:
- In the view dialog, some field values are held in `input.value`; dialog `innerText` may show only labels. Do not assert detail content by `innerText` alone.

Risk and cleanup:
- This is a staging write operation.
- The copied row was deleted as part of the validation.
- The original dedicated test prize remained after the test and can be cleaned up later by row `删除` if needed.
- Additional cache validation copied source prize ID `462` to new prize ID `475`; this copied row remained after validation.
