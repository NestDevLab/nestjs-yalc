import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalPackageDist } from './local-package-dist.mjs';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'crud-gen',
);

assertLocalPackageDist(packageDir);
