# Prize Management Basic Create Operations

Business domain:
活动通用模块管理 / 奖品管理。

Use this file for basic prize creation workflows: 赠金、币种、实物。

## Create Bonus Prize

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Create a `赠金 / 赠金` prize with default name, English name, alias, validity fields, unit, display precision, discount ratio, and prize image.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Prize image exists under `assets/default-prize-images/`.

Test data pattern:
- Prize name: `自动化赠金奖品<timestamp>`.
- English name: `Auto Bonus Prize <timestamp>`.
- Prize alias: `auto_bonus_<timestamp>`.
- Receive-after validity days: `1`.
- Issue-after validity days: `1`.
- Prize unit: `1`.
- Display precision: `2`.
- Discount ratio: `1`.
- Prize image: use the selected image from `assets/default-prize-images/`. If exactly one image exists, use that image by default.

Steps:
1. Click `新增`.
2. Select `奖品分类` as `赠金`.
3. Select `奖品子类型` as `赠金`.
4. Fill `奖品名称`.
5. Enable `多语言设置`.
6. Fill `英语` under `奖品名称多语言设置：`.
7. Fill `奖品别名`.
8. Fill `领取后有效期（天）`.
9. Fill `发放有效期（天）`.
10. Fill `奖品单位`.
11. Fill `奖品展示精度`.
12. Fill `抵扣比例(%)`.
13. Upload the default prize image.
14. Click `确认`.
15. Search by the unique prize alias.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Success assertions:
- Submit request to `/prod-api/activity/prize` returns HTTP 200.
- Page displays `新增成功`.
- Add dialog closes.
- Searching by the unique prize alias returns one row.
- Returned row has:
  - `奖品分类`: `赠金`
  - `奖品子分类`: `赠金`
  - `奖品名称`: the created default prize name
  - `奖品别名`: the created alias
  - `奖品单位`: `1`
  - `奖品展示精度`: `2`

Observed successful result:
- Created prize ID: `430`.
- Created prize name: `自动化赠金奖品20260504033445`.
- Created prize alias: `auto_bonus_20260504033445`.
- Upload endpoint used: `/prod-api/common/uploadImgReplace`.
- Submit endpoint used: `/prod-api/activity/prize`.

Risk and cleanup:
- This is a staging write operation.
- The created record can likely be removed with row action `删除`, but deletion was not attempted in this flow.

## Create Coin Prize

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Create a `币种 / BTC` prize with default name, English name, alias, valid days, unit, display precision, and prize image.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Prize image exists under `assets/default-prize-images/`.

Test data pattern:
- Prize name: `自动化币种奖品<timestamp>`.
- English name: `Auto Coin Prize <timestamp>`.
- Prize alias: `auto_coin_<timestamp>`.
- Valid days: `1`.
- Prize unit: `1`.
- Display precision: `2`.
- Prize image: use the selected image from `assets/default-prize-images/`. If exactly one image exists, use that image by default.

Steps:
1. Click `新增`.
2. Select `奖品分类` as `币种`.
3. Select `奖品子类型` as a visible coin ticker; validated with `BTC`.
4. Fill `奖品名称`.
5. Enable `多语言设置`.
6. Fill `英语` under `奖品名称多语言设置：`.
7. Fill `奖品别名`.
8. Fill `有效时间（天）`.
9. Fill `奖品单位`.
10. Fill `奖品展示精度`.
11. Upload the default prize image.
12. Click `确认`.
13. Search by the unique prize alias.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Success assertions:
- Submit request to `/prod-api/activity/prize` returns HTTP 200.
- Page displays `新增成功`.
- Add dialog closes.
- Searching by the unique prize alias returns one row.
- Returned row has:
  - `奖品分类`: `币种`
  - `奖品子分类`: selected coin ticker, validated with `BTC`
  - `奖品名称`: the created default prize name
  - `奖品别名`: the created alias
  - `奖品单位`: `1`
  - `奖品展示精度`: `2`

Observed successful result:
- Created prize ID: `431`.
- Created prize category/subcategory: `币种 / BTC`.
- Created prize name: `自动化币种奖品20260504034022`.
- Created prize alias: `auto_coin_20260504034022`.
- Upload endpoint used: `/prod-api/common/uploadImgReplace`.
- Submit endpoint used: `/prod-api/activity/prize`.

Risk and cleanup:
- This is a staging write operation.
- The created record can likely be removed with row action `删除`, but deletion was not attempted in this flow.

## Create Physical Prize

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Create a `实物 / 实物` prize with default name, English name, alias, valid days, unit, display precision, and prize image.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Prize image exists under `assets/default-prize-images/`.

Test data pattern:
- Prize name: `自动化实物奖品<timestamp>`.
- English name: `Auto Physical Prize <timestamp>`.
- Prize alias: `auto_physical_<timestamp>`.
- Valid days: `1`.
- Prize unit: `1`.
- Display precision: `2`.
- Prize image: use the selected image from `assets/default-prize-images/`. If exactly one image exists, use that image by default.

Steps:
1. Click `新增`.
2. Select `奖品分类` as `实物`.
3. Select `奖品子类型` as `实物`.
4. Fill `奖品名称`.
5. Enable `多语言设置`.
6. Fill `英语` under `奖品名称多语言设置：`.
7. Fill `奖品别名`.
8. Fill `有效时间（天）`.
9. Fill `奖品单位`.
10. Fill `奖品展示精度`.
11. Upload the selected prize image.
12. Click `确认`.
13. Search by the unique prize alias.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Success assertions:
- Submit request to `/prod-api/activity/prize` returns HTTP 200.
- Page displays `新增成功`.
- Add dialog closes.
- Searching by the unique prize alias returns one row.
- Returned row has:
  - `奖品分类`: `实物`
  - `奖品子分类`: `实物`
  - `奖品名称`: the created default prize name
  - `奖品别名`: the created alias
  - `奖品单位`: `1`
  - `奖品展示精度`: `2`

Observed successful result:
- Created prize ID: `432`.
- Created prize category/subcategory: `实物 / 实物`.
- Created prize name: `自动化实物奖品20260504034431`.
- Created prize alias: `auto_physical_20260504034431`.
- Upload endpoint used: `/prod-api/common/uploadImgReplace`.
- Submit endpoint used: `/prod-api/activity/prize`.

Risk and cleanup:
- This is a staging write operation.
- The created record can likely be removed with row action `删除`, but deletion was not attempted in this flow.
