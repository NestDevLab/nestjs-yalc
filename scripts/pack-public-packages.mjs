import { spawnSync } from 'node:child_process';
import {
  getPublishOrderedDistPackageDirs,
  validateDistPackage,
} from './public-package-manifest.mjs';

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

  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: pkgDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    hasErrors = true;
    console.error(`\n${pkg.name}`);
    console.error(result.stderr || result.stdout);
    continue;
  }

  const [packResult] = JSON.parse(result.stdout);
  console.log(
    `${pkg.name}@${pkg.version} ${packResult.filename} ${packResult.files.length} files`,
  );
}

if (hasErrors) process.exit(1);
