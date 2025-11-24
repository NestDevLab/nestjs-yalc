import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const rootPkgPath = path.join(cwd, 'package.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

const distRoot = path.join(cwd, 'var', 'dist');

const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];

const normalizeRelPath = (value) => {
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('./') || normalized.startsWith('../')) return normalized;
  return `./${normalized}`;
};

const toJsPath = (value) => {
  if (value.endsWith('.d.ts')) return normalizeRelPath(value);
  return normalizeRelPath(value.replace(/\.ts$/i, '.js'));
};

const toDtsPath = (value) => {
  if (value.endsWith('.d.ts')) return normalizeRelPath(value);
  return normalizeRelPath(value.replace(/\.ts$/i, '.d.ts'));
};

const normalizeExportTargets = (target, mapPath) => {
  if (typeof target === 'string') {
    let value = normalizeRelPath(target);
    if (value.endsWith('.d.ts')) {
      // keep .d.ts as-is
    } else if (value.endsWith('.ts')) {
      value = toJsPath(value);
    }
    return mapPath ? mapPath(value) : value;
  }

  if (Array.isArray(target)) {
    return target.map((value) => normalizeExportTargets(value, mapPath));
  }

  if (target && typeof target === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(target)) {
      normalized[key] = normalizeExportTargets(value, mapPath);
    }
    return normalized;
  }

  return target;
};

const packages = ['.'].concat(workspaces);

for (const workspace of packages) {
  const pkgDir = path.resolve(cwd, workspace);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const pkgName = pkg.name;
  if (!pkgName) continue;

  const pkgFolder = pkgName.split('/').pop();
  const relativeDir =
    workspace === '.' ? pkgFolder : path.relative(cwd, pkgDir);
  const distDir = path.join(distRoot, relativeDir);
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const compiledIndex = path.join(distDir, 'src', 'index.js');
  const main =
    pkg.main && pkg.main !== ''
      ? toJsPath(pkg.main)
      : fs.existsSync(compiledIndex)
        ? './src/index.js'
        : undefined;
  const types = pkg.types
    ? toDtsPath(pkg.types)
    : pkg.typings
      ? toDtsPath(pkg.typings)
      : fs.existsSync(path.join(distDir, 'src', 'index.d.ts'))
        ? './src/index.d.ts'
        : undefined;

  const exportsField =
    pkg.exports !== undefined
      ? normalizeExportTargets(pkg.exports)
      : {
          '.': main,
          './*': './src/*',
        };

  const distPkg = {
    ...pkg,
    name: pkgName,
    version: pkg.version ?? rootPkg.version ?? '0.0.0',
    main,
    module: undefined,
    types,
    typings: undefined,
    exports: exportsField,
    files: Array.from(new Set([...(pkg.files ?? []), 'src'])),
  };

  const tslibVersion =
    (pkg.dependencies && pkg.dependencies.tslib) ||
    (rootPkg.dependencies && rootPkg.dependencies.tslib) ||
    '^2.6.3';

  distPkg.dependencies = {
    ...(pkg.dependencies ?? {}),
    tslib: tslibVersion,
  };

  const distPkgPath = path.join(distDir, 'package.json');
  fs.writeFileSync(distPkgPath, `${JSON.stringify(distPkg, null, 2)}\n`, 'utf8');
}
