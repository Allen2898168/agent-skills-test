# Operations Index

Use this file as the table of contents for operation playbooks. Keep full workflows in business-domain files.

## Business Domains

- Activity management: `activity-management.md`
- Activity common module: `activity-common-module.md`
- Prize management: `prize-management.md`
- Offline user manage / fake money account: `offline-user-manage.md`
- Reward issue: `reward-issue.md`
- Risk control: `risk-control.md`
- Import/export: `import-export.md`

## Known Operation Playbooks

| Operation | Domain file | Status | Last verified | Notes |
| --- | --- | --- | --- | --- |
| Login and open offline user manage | `offline-user-manage.md` | candidate | 2026-05-04 | Opens `/activities/offline/userManage` after login. |
| Open prize management | `activity-common-module.md` | candidate | 2026-05-04 | Opens `/activity/prize` from `活动通用模块管理 / 奖品管理`. |
| Prize management search | `activity-common-module.md` | candidate | 2026-05-04 | Validates prize ID, category, name, and alias search. |
| Create bonus prize | `activity-common-module.md` | candidate | 2026-05-04 | Creates `赠金 / 赠金` prize with default and English names, validity fields, unit, precision, discount ratio, and image. |
| Create coin prize | `activity-common-module.md` | candidate | 2026-05-04 | Creates `币种 / BTC` prize with default and English names, alias, valid days, unit, precision, and image. |
| Create physical prize | `activity-common-module.md` | candidate | 2026-05-04 | Creates `实物 / 实物` prize with default and English names, alias, valid days, unit, precision, and image. |
| Virtual qualification field discovery | `prize-management.md` | candidate | 2026-05-04 | Captures add-dialog fields for every `虚拟积分或资格` subtype. |
| Create virtual qualification prize by subtype | `prize-management.md` | candidate | 2026-05-04 | Creates all 12 virtual qualification subtype prizes with safe defaults; `仓位空投` requires multi-select trade-pair blur handling. |
| Prize row actions | `prize-management.md` | candidate | 2026-05-04 | Validates row `查看`, `修改`, `复制`, and `删除`; use a dedicated test prize and delete the copied row. |
