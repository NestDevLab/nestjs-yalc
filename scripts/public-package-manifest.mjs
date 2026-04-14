import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const distRoot = path.join(repoRoot, 'var', 'dist');

export const readJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

export const getDistPackageDirs = () => {
  if (!fs.existsSync(distRoot)) return [];

  return fs
    .readdirSync(distRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(distRoot, entry.name))
    .filter((pkgDir) => fs.existsSync(path.join(pkgDir, 'package.json')))
    .sort();
};

export const getPublishOrderedDistPackageDirs = () => {
  const pkgDirs = getDistPackageDirs();
  const packageByName = new Map(
    pkgDirs.map((pkgDir) => {
      const pkg = readJson(path.join(pkgDir, 'package.json'));
      return [pkg.name, { pkg, pkgDir }];
    }),
  );
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  const visit = (pkgName) => {
    if (visited.has(pkgName)) return;
    if (visiting.has(pkgName)) {
      throw new Error(`Circular internal package dependency detected at ${pkgName}`);
    }

    const entry = packageByName.get(pkgName);
    if (!entry) return;

    visiting.add(pkgName);

    for (const dependencyName of getInternalDependencyNames(entry.pkg)) {
      visit(dependencyName);
    }

    visiting.delete(pkgName);
    visited.add(pkgName);
    ordered.push(entry.pkgDir);
  };

  for (const { pkg } of packageByName.values()) {
    visit(pkg.name);
  }

  return ordered;
};

const getInternalDependencyNames = (pkg) => {
  const dependencyNames = new Set();

  for (const dependencyBlock of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const dependencyName of Object.keys(pkg[dependencyBlock] ?? {})) {
      dependencyNames.add(dependencyName);
    }
  }

  return Array.from(dependencyNames).filter((dependencyName) =>
    dependencyName.startsWith('@nestjs-yalc/'),
  );
};

export const validateDistPackage = (pkgDir) => {
  const pkgPath = path.join(pkgDir, 'package.json');
  const pkg = readJson(pkgPath);
  const errors = [];

  if (!pkg.name?.startsWith('@nestjs-yalc/')) {
    errors.push(`Package name must use the @nestjs-yalc scope: ${pkg.name}`);
  }

  if (pkg.private) {
    errors.push('Published dist packages must not be private.');
  }

  if (pkg.publishConfig?.access !== 'public') {
    errors.push('Scoped packages must set publishConfig.access to public.');
  }

  for (const dependencyBlock of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, version] of Object.entries(pkg[dependencyBlock] ?? {})) {
      if (typeof version === 'string' && version.startsWith('file:')) {
        errors.push(`${dependencyBlock}.${name} still uses ${version}.`);
      }
    }
  }

  if (pkg.main && !fs.existsSync(path.join(pkgDir, pkg.main))) {
    errors.push(`main points to a missing file: ${pkg.main}`);
  }

  if (pkg.types && !fs.existsSync(path.join(pkgDir, pkg.types))) {
    errors.push(`types points to a missing file: ${pkg.types}`);
  }

  return { pkg, errors };
};
