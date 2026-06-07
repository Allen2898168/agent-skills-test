import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repoRoot } from './env.mjs';

const require = createRequire(import.meta.url);

export function requireProjectDependency(packageName) {
  try {
    return require(packageName);
  } catch (firstError) {
    if (process.env.WEEX_AUTO_INSTALL_DEPS === 'false') {
      throw firstError;
    }
    const root = repoRoot();
    const packageJson = path.join(root, 'package.json');
    if (!fs.existsSync(packageJson)) throw firstError;
    const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`Failed to auto-install project dependencies with npm install: ${result.stderr || result.stdout || firstError.message}`);
    }
    return require(packageName);
  }
}
