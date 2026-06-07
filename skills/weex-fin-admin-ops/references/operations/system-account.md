# FIN 系统/API 账号创建

## STG 系统账户管理创建 API 账号

Status: verified
Last verified: 2026-05-12

Use when the tester asks to create FIN Admin system accounts with Open API credentials.

Page:

`https://stg-admin-web-fin.weex.tech/zh-CN/userInfoManagement/SystemAccountManagement/`

## API Chain

1. Read FIN auth from the persistent CDP profile.
2. Create accounts:
   - `POST /api/admin/fin/asset/system/account/add`
   - Required payload fields:
     - `number`
     - `remark`
     - `userType`
     - `tagId`
     - `clientId`
     - `isSystem`
     - `isGray`
     - `isInternal`
     - `isSpotPro`
     - `isFirstTime`
     - `site`
     - `authorities`
3. Poll generation:
   - `POST /api/admin/fin/asset/system/account/add_progress`
   - payload: `clientId`
4. Fetch generated results:
   - `POST /api/admin/fin/asset/system/account/temporary/list`
   - payload: `clientId`
5. Verify output count and, when needed, validate one generated API key against the frontend contract Open API private balance endpoint.

Captured default values:

- `tagId=9`
- `site=GLOBAL`
- `isSystem=0`
- `isGray=0`
- `isInternal=0`
- `isSpotPro=0` for contract accounts
- `isFirstTime=0`
- `authorities=1,2,3,4,5,6`

## Script

- `scripts/system-account-create.mjs`
- Cached action: `fin_system_account_create`

Dry-run:

```bash
node skills/weex-fin-admin-ops/scripts/system-account-create.mjs --dry-run --count 1 --user-type <TYPE> --remark <REMARK>
```

Create and save generated credentials locally:

```bash
node skills/weex-fin-admin-ops/scripts/system-account-create.mjs --confirm-create --save-secrets --count 1 --user-type <TYPE> --remark <REMARK>
```

## Output Rules

- Stdout prints only UID, email, account id, and authorities.
- Password, Google code, API key, secret, and passphrase are written only when `--save-secrets` is present.
- Local secret output defaults to ignored `generated/fin-system-accounts/`.
- Do not commit generated JSON/CSV files.
