#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prevent infinite recursion if the script itself triggers installs.
if (process.env.SKIP_LOCK_REFRESH === '1') {
  process.exit(0);
}

console.log('Refreshing lock files...');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync(
  'npm',
  [
    'install',
    '--package-lock-only',
    '--workspaces',
    '--include-workspace-root',
    '--ignore-scripts',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SKIP_LOCK_REFRESH: '1',
    },
  },
);

if (result.status !== 0) {
  console.error('Lock refresh failed');
  process.exit(result.status ?? 1);
}
