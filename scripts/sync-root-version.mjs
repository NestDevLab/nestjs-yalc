import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const rootPackagePath = path.join(repoRoot, 'package.json');
const rootPackage = readJson(rootPackagePath);

const workspacePackages = (rootPackage.workspaces ?? [])
  .map((workspace) => {
    const packagePath = path.join(repoRoot, workspace, 'package.json');
    if (!fs.existsSync(packagePath)) return undefined;

    return {
      workspace,
      packagePath,
      packageJson: readJson(packagePath),
    };
  })
  .filter(Boolean)
  .filter(({ packageJson }) => packageJson.name?.startsWith('@nestjs-yalc/'));

const releaseVersions = new Set(
  workspacePackages.map(({ packageJson }) => packageJson.version),
);

if (releaseVersions.size === 0) {
  throw new Error('No @nestjs-yalc workspace package versions were found.');
}

if (releaseVersions.size > 1) {
  throw new Error(
    `Expected one fixed release version, found: ${Array.from(releaseVersions).join(', ')}`,
  );
}

const [releaseVersion] = Array.from(releaseVersions);

if (rootPackage.version !== releaseVersion) {
  rootPackage.version = releaseVersion;
  writeJson(rootPackagePath, rootPackage);
  console.log(`Synchronized ${rootPackage.name} to ${releaseVersion}.`);
} else {
  console.log(`${rootPackage.name} is already at ${releaseVersion}.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
