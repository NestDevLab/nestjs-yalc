import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const compiledDistRoot = path.join(repoRoot, 'var', 'dist');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const hasDeclaredDistPath = (value) => {
  if (typeof value === 'string') return value.startsWith('./dist/');
  if (Array.isArray(value)) return value.some(hasDeclaredDistPath);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(hasDeclaredDistPath);
};

const hasLocalDistBoundary = (pkg) => {
  return [pkg.main, pkg.types, pkg.typings, pkg.exports].some(
    hasDeclaredDistPath,
  );
};

const getEntryTargets = (pkg) => {
  const targets = new Set([pkg.main, pkg.types, pkg.typings].filter(Boolean));

  const collectExportTargets = (value) => {
    if (typeof value === 'string') {
      targets.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectExportTargets);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(collectExportTargets);
    }
  };

  collectExportTargets(pkg.exports);
  return Array.from(targets)
    .filter((target) => typeof target === 'string')
    .filter((target) => target.startsWith('./dist/'))
    .filter((target) => !target.includes('*'))
    .sort();
};

export const getLocalPackageDistEntries = () => {
  const rootPkg = readJson(path.join(repoRoot, 'package.json'));

  return rootPkg.workspaces
    .map((workspace) => {
      const packageDir = path.join(repoRoot, workspace);
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return undefined;

      const pkg = readJson(packageJsonPath);
      if (pkg.private === true || !hasLocalDistBoundary(pkg)) return undefined;

      return {
        name: pkg.name,
        packageDir,
        pkg,
        compiledSourceDir: path.join(
          compiledDistRoot,
          pkg.name.split('/').pop(),
          'src',
        ),
        localDistDir: path.join(packageDir, 'dist'),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
};

const assertLocalDistDirectory = (packageDir, localDistDir) => {
  const relative = path.relative(packageDir, localDistDir);
  if (relative !== 'dist') {
    throw new Error(
      `Refusing to manage a non-standard local dist path: ${localDistDir}`,
    );
  }
};

export const assertLocalPackageDist = (packageDir) => {
  const pkgPath = path.join(packageDir, 'package.json');
  const pkg = readJson(pkgPath);
  const errors = [];

  for (const target of getEntryTargets(pkg)) {
    const entryPath = path.resolve(packageDir, target);
    const relative = path.relative(packageDir, entryPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      errors.push(`entrypoint escapes the package: ${target}`);
      continue;
    }
    if (!fs.existsSync(entryPath)) {
      errors.push(`missing declared entrypoint: ${target}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `${pkg.name} local package boundary is not build-ready:\n- ${errors.join(
        '\n- ',
      )}\nRun npm run build from the repository root before packing this package.`,
    );
  }
};

export const cleanLocalPackageDists = () => {
  for (const entry of getLocalPackageDistEntries()) {
    assertLocalDistDirectory(entry.packageDir, entry.localDistDir);
    fs.rmSync(entry.localDistDir, { recursive: true, force: true });
  }
};

export const materializeLocalPackageDists = () => {
  const materialized = [];

  for (const entry of getLocalPackageDistEntries()) {
    assertLocalDistDirectory(entry.packageDir, entry.localDistDir);
    fs.rmSync(entry.localDistDir, { recursive: true, force: true });

    if (!fs.existsSync(entry.compiledSourceDir)) {
      throw new Error(
        `${entry.name} has no compiled source at ${path.relative(
          repoRoot,
          entry.compiledSourceDir,
        )}. Run the canonical TypeScript build before materializing local package boundaries.`,
      );
    }

    fs.cpSync(entry.compiledSourceDir, path.join(entry.localDistDir, 'src'), {
      recursive: true,
    });
    assertLocalPackageDist(entry.packageDir);
    materialized.push(entry.name);
  }

  return materialized;
};
