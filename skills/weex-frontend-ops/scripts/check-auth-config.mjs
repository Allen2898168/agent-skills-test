#!/usr/bin/env node
import { ensureFrontendEnvExample, listFrontendAccounts, normalizeAlias } from './lib/account-config.mjs';
import { isPlaceholder, loadFrontendEnv } from './lib/env.mjs';
import { resolveLoginToolDir } from './lib/login-tool-adapter.mjs';

loadFrontendEnv();

const paths = ensureFrontendEnvExample();
const accounts = listFrontendAccounts();
const commonPassword = process.env.WEEX_FRONTEND_COMMON_PASSWORD || '';
let loginTool = null;
let loginToolError = null;

try {
  loginTool = resolveLoginToolDir();
} catch (error) {
  loginToolError = error.message;
}

console.log(JSON.stringify({
  localEnvPath: paths.localEnvPath,
  examplePath: paths.examplePath,
  hasCommonPassword: !!commonPassword && !isPlaceholder(commonPassword),
  defaultAccount: normalizeAlias(process.env.WEEX_FRONTEND_DEFAULT_ACCOUNT || ''),
  hasDefaultAccount: accounts.some((account) => account.alias === normalizeAlias(process.env.WEEX_FRONTEND_DEFAULT_ACCOUNT || 'DEFAULT')),
  accounts: accounts.map((account) => ({
    alias: account.alias,
    username: account.username,
    hasAccountPassword: !!account.password && !isPlaceholder(account.password),
    description: account.description
  })),
  loginToolFound: !!loginTool,
  loginToolDir: loginTool?.dir || null,
  loginToolError
}, null, 2));
