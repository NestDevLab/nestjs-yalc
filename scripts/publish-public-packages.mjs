import { spawnSync } from 'node:child_process';
import {
  getPublishOrderedDistPackageDirs,
  validateDistPackage,
} from './public-package-manifest.mjs';

const dryRun = process.argv.includes('--dry-run');
const packageDirs = getPublishOrderedDistPackageDirs();

if (packageDirs.length === 0) {
  console.error('No dist packages found. Run npm run build first.');
  process.exit(1);
}

let hasErrors = false;

for (const pkgDir of packageDirs) {
  const { pkg, errors } = validateDistPackage(pkgDir);

  if (errors.length > 0) {
    hasErrors = true;
    console.error(`\n${pkg.name}`);
    for (const error of errors) console.error(`- ${error}`);
    continue;
  }

  const args = ['publish', '--access', 'public'];
  if (dryRun) args.push('--dry-run');

  console.log(`${dryRun ? 'Dry-run publishing' : 'Publishing'} ${pkg.name}`);

  const result = spawnSync('npm', args, {
    cwd: pkgDir,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    hasErrors = true;
    break;
  }
}

if (hasErrors) process.exit(1);
