# Prize Management Selectors

Business domain:
活动通用模块管理 / 奖品管理。

## Navigation

- Sidebar parent menu text: `活动通用模块管理`
- Sidebar child menu text: `奖品管理`
- Direct path: `/activity/prize`

## Search Form

- Prize ID input placeholder: `请输入奖品ID`
- Prize category select placeholder: `请选择奖品分类`
- Prize subcategory select placeholder: `请选择奖品子类别`
- Prize name input placeholder: `请输入奖品名称`
- Prize alias input: form item labeled `奖品别名`
- Search button text: `搜索`
- Create button text: `新增`

## Add Dialog

- Dialog title: `新增`
- Prize category placeholder: `奖品分类`
- Prize sub-type placeholder: `奖品子类型`
- Prize name label: `奖品名称`
- Multilingual switch text: `多语言设置`
- Multilingual section label: `奖品名称多语言设置：`
- English name input placeholder: `英语`
- Prize alias label: `奖品别名`
- Coin prize valid days label: `有效时间（天）`
- Receive-after validity label: `领取后有效期（天）`
- Issue-after validity label: `发放有效期（天）`
- Prize unit label: `奖品单位`
- Display precision label: `奖品展示精度`
- Discount ratio label: `抵扣比例(%)`
- Discount ratio placeholder: `请输入抵扣比例`
- Prize image label: `奖品图片`
- Prize image file input accepts `.png,.jpg,.jpeg,.webp`
- Cancel button: `取消`
- Confirm button: `确认`

## Virtual Qualification Add Dialog

- Category option: `虚拟积分或资格`
- Subtype options observed: `抽奖次数`, `积分`, `合约抵扣金`, `仓位空投`, `无奖励`, `VIP体验卡`, `提升返还比例档位`, `小丑牌-抽牌次数`, `小丑牌-积分加成`, `虚拟盘合约体验金`, `理财加息券`, `每日固定收益券`
- `抽奖次数` dropdown field: `颜色签`
- `VIP体验卡` dropdown fields: `VIP类型`, `VIP等级`
- `仓位空投` dropdown fields: `币种`, `交易对`, `保证金模式`
- `仓位空投 / 交易对`: multi-select dropdown. After selecting trade pair option(s), click a blank area outside the dropdown to collapse it before filling later fields.
- `仓位空投` numeric/input fields: `开仓后有效期（天）`, `发放有效期（天）`, `杠杆倍数`, `数量`
- `奖品图片`: scope file upload to the `奖品图片` form item when possible; do not rely on the first generic `input[type=file]` on the page.
- `理财加息券` and `每日固定收益券` dropdown fields: `适用业务类型`, `币种`
- `理财加息券` and `每日固定收益券` numeric fields: `加息利率`, `加息金额`, `计息资产最小值`, `计息资产最大值`
- Known selector caveat: `仓位空投 / 交易对` requires selecting real dropdown option(s) and then blurring/collapsing the dropdown; typing into a visible input may not bind the selected value.

## Prize Category Options

- `赠金`
- `币种`
- `实物`
- `虚拟积分或资格`

## Prize Subcategory Behavior

The `奖品子类别` dropdown is populated only after selecting `奖品分类`.

Observed mappings:
- `赠金`: `赠金`
- `币种`: coin/ticker values; validated with `BTC`
- `实物`: `实物`
- `虚拟积分或资格`: `抽奖次数`, `积分`, `合约抵扣金`, `仓位空投`, `无奖励`, `VIP体验卡`, `提升返还比例档位`, `小丑牌-抽牌次数`, `小丑牌-积分加成`, `理财加息券`, `每日固定收益券`, `虚拟盘合约体验金`

## Table Headers

- `奖品ID`
- `奖品分类`
- `奖品子分类`
- `奖品名称`
- `奖品别名`
- `奖品单位`
- `奖品展示精度`
- `奖品图片`
- `操作`

## Row Actions

- `查看`
- `修改`
- `复制`
- `删除`
