import fs from 'node:fs';
import path from 'node:path';
import { isPlaceholder, skillRoot } from './env.mjs';

const ACCOUNT_PREFIX = 'WEEX_FRONTEND_ACCOUNT_';

export function normalizeAlias(alias) {
  return String(alias || '').trim().replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

function accountEnvKey(alias, field) {
  return `${ACCOUNT_PREFIX}${normalizeAlias(alias)}_${field}`;
}

export function ensureFrontendEnvExample() {
  const examplePath = path.join(skillRoot(), '.env.example');
  if (!fs.existsSync(examplePath)) {
    throw new Error('Missing .env.example. Restore skills/weex-frontend-ops/.env.example before configuring frontend auth.');
  }
  return {
    examplePath,
    localEnvPath: path.join(skillRoot(), '.env.local')
  };
}

function configuredAliases() {
  const raw = process.env.WEEX_FRONTEND_ACCOUNTS || process.env.WEEX_FRONTEND_DEFAULT_ACCOUNT || 'DEFAULT';
  const aliases = raw.split(',').map((item) => normalizeAlias(item)).filter(Boolean);
  return [...new Set(aliases)];
}

export function listFrontendAccounts() {
  const accounts = configuredAliases().map((alias) => ({
    alias,
    username: process.env[accountEnvKey(alias, 'USERNAME')] || '',
    password: process.env[accountEnvKey(alias, 'PASSWORD')] || '',
    description: process.env[accountEnvKey(alias, 'DESCRIPTION')] || ''
  })).filter((account) => account.username && !isPlaceholder(account.username));

  if (accounts.length === 0 && process.env.WEEX_FRONTEND_USERNAME) {
    accounts.push({
      alias: 'RUNTIME',
      username: process.env.WEEX_FRONTEND_USERNAME,
      password: process.env.WEEX_FRONTEND_PASSWORD || '',
      description: 'runtime account from WEEX_FRONTEND_USERNAME'
    });
  }

  return accounts;
}

export function resolveFrontendAccount(selectedAlias = process.env.WEEX_FRONTEND_ACCOUNT) {
  ensureFrontendEnvExample();
  const accounts = listFrontendAccounts();
  const commonPassword = process.env.WEEX_FRONTEND_COMMON_PASSWORD || process.env.WEEX_FRONTEND_PASSWORD || '';

  if (process.env.WEEX_FRONTEND_USERNAME) {
    const runtimePassword = isPlaceholder(process.env.WEEX_FRONTEND_PASSWORD) ? '' : process.env.WEEX_FRONTEND_PASSWORD || '';
    const fallbackPassword = isPlaceholder(commonPassword) ? '' : commonPassword;
    const password = runtimePassword || fallbackPassword;
    if (!password) {
      throw new Error('No password configured for runtime frontend account. Set WEEX_FRONTEND_PASSWORD or WEEX_FRONTEND_COMMON_PASSWORD.');
    }
    return {
      alias: 'RUNTIME',
      username: process.env.WEEX_FRONTEND_USERNAME,
      password,
      description: 'runtime account from WEEX_FRONTEND_USERNAME',
      passwordSource: runtimePassword ? 'account' : 'common',
      accountCount: accounts.length || 1
    };
  }

  if (accounts.length > 1 && !selectedAlias) {
    const available = accounts.map((item) => `${item.alias}: ${item.username}${item.description ? ` (${item.description})` : ''}`).join('; ');
    throw new Error(`Multiple frontend accounts configured. Ask the user which account to use, then set WEEX_FRONTEND_ACCOUNT. Available accounts: ${available}`);
  }

  const defaultAlias = normalizeAlias(process.env.WEEX_FRONTEND_DEFAULT_ACCOUNT || accounts[0]?.alias || 'DEFAULT');
  const alias = normalizeAlias(selectedAlias || defaultAlias);
  const account = accounts.find((item) => item.alias === alias);

  if (!account) {
    const available = accounts.map((item) => `${item.alias}=${item.username}`).join(', ') || 'none';
    throw new Error(`No frontend account configured for ${alias}. Available accounts: ${available}`);
  }

  const accountPassword = isPlaceholder(account.password) ? '' : account.password;
  const fallbackPassword = isPlaceholder(commonPassword) ? '' : commonPassword;
  const password = accountPassword || fallbackPassword;
  if (!password) {
    throw new Error(`No password configured for frontend account ${account.alias}. Set ${accountEnvKey(account.alias, 'PASSWORD')} or WEEX_FRONTEND_COMMON_PASSWORD.`);
  }

  return {
    ...account,
    password,
    passwordSource: accountPassword ? 'account' : 'common',
    accountCount: accounts.length
  };
}
