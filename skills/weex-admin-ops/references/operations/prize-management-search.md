# Prize Management Search Operations

Business domain:
活动通用模块管理 / 奖品管理。

Use this file for read-only prize-management search workflows.

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
