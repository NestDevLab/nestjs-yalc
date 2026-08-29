import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanLocalPackageDists } from './local-package-dist.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

fs.rmSync(path.join(repoRoot, 'var', 'dist'), {
  recursive: true,
  force: true,
});

cleanLocalPackageDists();
