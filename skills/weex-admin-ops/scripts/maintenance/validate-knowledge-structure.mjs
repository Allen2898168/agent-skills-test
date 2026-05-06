#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, '../..');
const maxLines = 250;
const requiredFiles = [
  'SKILL.md',
  'FAILURES.md',
  'failure-reviews/README.md',
  'references/operations/index.md',
  'references/action-cache.md',
  'references/components.md',
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

function lineCount(filePath) {
  const text = readFileSync(filePath, 'utf8');
  if (!text) return 0;
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

export function validateKnowledgeStructure() {
  const failures = [];

  for (const required of requiredFiles) {
    const fullPath = join(skillRoot, required);
    try {
      if (!statSync(fullPath).isFile()) failures.push(`${required} is not a file`);
    } catch {
      failures.push(`${required} is missing`);
    }
  }

  const checkedDirs = ['references', 'failure-reviews'];
  const checkedFiles = [join(skillRoot, 'SKILL.md'), join(skillRoot, 'FAILURES.md')];

  for (const dir of checkedDirs) {
    try {
      checkedFiles.push(...walk(join(skillRoot, dir)));
    } catch {
      failures.push(`${dir} is missing`);
    }
  }

  for (const filePath of checkedFiles) {
    const count = lineCount(filePath);
    if (count > maxLines) {
      failures.push(`${relative(skillRoot, filePath)} has ${count} lines; split before exceeding ${maxLines}`);
    }
  }

  return failures;
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const failures = validateKnowledgeStructure();
  if (failures.length) {
    console.error('WEEX admin skill knowledge structure validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('WEEX admin skill knowledge structure is valid.');
}
