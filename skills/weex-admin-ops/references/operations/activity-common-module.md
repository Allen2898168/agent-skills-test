# Activity Common Module Operations

## Open Prize Management

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Expand the left sidebar item `活动通用模块管理` and open `奖品管理`.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Sidebar menu is visible.

Steps:
1. In the left sidebar, click `活动通用模块管理` to expand it.
2. Click `奖品管理`.
3. Wait for navigation and prize list loading.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Success assertions:
- Final URL path is `/activity/prize`.
- Breadcrumb/page text includes `活动通用模块管理 / 奖品管理`.
- Page contains filters `奖品ID`, `奖品分类`, `奖品子类别`, `奖品名称`, and `奖品别名`.
- Table contains headers `奖品ID`, `奖品分类`, `奖品子分类`, `奖品名称`, `奖品别名`, and `操作`.

Optional screenshot:
- Directory: `artifacts/screenshots/活动通用模块管理/奖品管理/`.
- Suggested file name: `activity-common-prize-management.png`.

## Prize Management Search

Status: candidate
Last verified: 2026-05-04
Environment: staging

Business domain:
活动通用模块管理 / 奖品管理。

Purpose:
Validate read-only search behavior on the prize management page.

Entry:
`https://stg-activity.weex.tech/activity/prize`

Preconditions:
- Logged in to the staging admin.
- Prize management page is loaded.
- Test each condition independently; clear all other search fields before each search.

Fields:
- Prize ID: placeholder `请输入奖品ID`.
- Prize category: placeholder `请选择奖品分类`.
- Prize subcategory: placeholder `请选择奖品子类别`. It is populated after selecting a prize category.
- Prize name: placeholder `请输入奖品名称`.
- Prize alias: input under form item `奖品别名`.
- Search button: `搜索`.

Category options:
- `赠金`
- `币种`
- `实物`
- `虚拟积分或资格`

Observed subcategory behavior:
- Select `赠金`, then subcategory options include `赠金`.
- Select `币种`, then subcategory options are coin/ticker values; `BTC` was used for validation.
- Select `实物`, then subcategory options include `实物`.
- Select `虚拟积分或资格`, then subcategory options include `抽奖次数`, `积分`, `合约抵扣金`, `仓位空投`, `无奖励`, `VIP体验卡`, `提升返还比例档位`, `小丑牌-抽牌次数`, `小丑牌-积分加成`, `理财加息券`, `每日固定收益券`, `虚拟盘合约体验金`.

Validated cases:
1. Prize ID exact search:
   - Use a visible ID from the current table, for example `429`.
   - Click `搜索`.
   - Assert all returned rows have `奖品ID` equal to the searched ID.
2. Empty prize ID:
   - Clear the prize ID field.
   - Click `搜索`.
   - Assert the list returns to the normal first page view with multiple rows.
3. Prize category:
   - Select each category option independently.
   - Click `搜索`.
   - Assert every returned row has `奖品分类` equal to the selected category.
4. Prize subcategory:
   - Select a prize category first.
   - Open `奖品子类别`, select one available subcategory for that category.
   - Click `搜索`.
   - Assert every returned row has `奖品分类` equal to the selected category and `奖品子分类` equal to the selected subcategory.
5. Prize name fuzzy search:
   - Use a substring from a visible prize name, for example `合约`.
   - Click `搜索`.
   - Assert every returned row's `奖品名称` contains the search text.
6. Prize alias fuzzy search:
   - Use a substring from a visible prize alias, for example `合约`.
   - Click `搜索`.
   - Assert every returned row's `奖品别名` contains the search text.

References:
- Route: `../routes.md`
- Page selectors: `../selectors/prize-management.md`
- Assertions: `../assertions/prize-management.md`

Observed successful result:
- Tested sample prize ID: `429`.
- Tested name keyword: `合约`.
- Tested alias keyword: `合约`.
- Tested subcategories:
  - `赠金 / 赠金`
  - `币种 / BTC`
  - `实物 / 实物`
  - `虚拟积分或资格 / 抽奖次数`
- All listed search cases passed on 2026-05-04.

Optional screenshots:
- Directory: `artifacts/screenshots/活动通用模块管理/奖品管理/搜索功能/`.
- Suggested file names:
  - `01-奖品ID搜索.png`
  - `02-奖品ID置空展示全部.png`
  - `03-奖品分类-赠金.png`
  - `03-奖品分类-币种.png`
  - `03-奖品分类-实物.png`
  - `03-奖品分类-虚拟积分或资格.png`
  - `04-奖品名称模糊搜索.png`
  - `05-奖品别名模糊搜索.png`
  - `奖品子类别/奖品子类别-赠金-赠金.png`
  - `奖品子类别/奖品子类别-币种-BTC.png`
  - `奖品子类别/奖品子类别-实物-实物.png`
  - `奖品子类别/奖品子类别-虚拟积分或资格-抽奖次数.png`

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
