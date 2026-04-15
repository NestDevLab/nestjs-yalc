import { spawnSync } from 'node:child_process';
import {
  getPublishOrderedDistPackageDirs,
  validateDistPackage,
} from './public-package-manifest.mjs';

const dryRun = process.argv.includes('--dry-run');
const provenance = process.argv.includes('--provenance');
const skipExisting = process.argv.includes('--skip-existing');
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

  if (skipExisting && packageVersionExists(pkg.name, pkg.version)) {
    console.log(`Skipping ${pkg.name}@${pkg.version}; version already exists.`);
    continue;
  }

  const args = ['publish', '--access', 'public'];
  if (dryRun) args.push('--dry-run');
  if (provenance) args.push('--provenance');

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

function packageVersionExists(pkgName, version) {
  const result = spawnSync(
    'npm',
    ['view', `${pkgName}@${version}`, 'version'],
    {
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  if (result.status === 0) return result.stdout.trim() === version;

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes('E404') || output.includes('404 Not Found')) return false;

  throw new Error(
    `Unable to check whether ${pkgName}@${version} exists:\n${output}`,
  );
}
