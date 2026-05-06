#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const maxLines = 250;
const requiredFiles = [
  'docs/session-handoff.md',
  'docs/session-handoffs/README.md',
  'FAILURES.md',
  'failure-reviews/README.md',
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

const failures = [];

for (const required of requiredFiles) {
  const fullPath = join(root, required);
  try {
    if (!statSync(fullPath).isFile()) failures.push(`${required} is not a file`);
  } catch {
    failures.push(`${required} is missing`);
  }
}

const checkedDirs = ['docs', 'failure-reviews'];
const checkedFiles = [join(root, 'FAILURES.md')];

for (const dir of checkedDirs) {
  try {
    checkedFiles.push(...walk(join(root, dir)));
  } catch {
    failures.push(`${dir} is missing`);
  }
}

for (const filePath of checkedFiles) {
  const count = lineCount(filePath);
  if (count > maxLines) {
    failures.push(`${relative(root, filePath)} has ${count} lines; split before exceeding ${maxLines}`);
  }
}

if (failures.length) {
  console.error('Knowledge docs structure validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Knowledge docs structure is valid.');
