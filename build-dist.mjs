import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const rootPkgPath = path.join(cwd, 'package.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const publicRepository = rootPkg.repository ?? {
  type: 'git',
  url: 'git+https://github.com/NestDevLab/nestjs-yalc.git',
};
const publicBugs = rootPkg.bugs ?? {
  url: 'https://github.com/NestDevLab/nestjs-yalc/issues',
};
const publicHomepage =
  rootPkg.homepage ?? 'https://github.com/NestDevLab/nestjs-yalc#readme';

const distRoot = path.join(cwd, 'var', 'dist');

const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
const rootVersion = rootPkg.version ?? '0.0.0';

const readPackageJson = (pkgDir) => {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return undefined;
  return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
};

const workspacePackages = workspaces
  .map((workspace) => {
    const pkgDir = path.resolve(cwd, workspace);
    const pkg = readPackageJson(pkgDir);
    return pkg?.name ? { workspace, pkg, pkgDir } : undefined;
  })
  .filter(Boolean);

const workspacePackageVersions = new Map(
  workspacePackages.map(({ pkg }) => [pkg.name, pkg.version ?? rootVersion]),
);

const internalPackageNames = new Set([
  rootPkg.name,
  ...workspacePackages.map(({ pkg }) => pkg.name),
]);

const frameworkExcludedPackageNames = new Set([
  '@nestjs-yalc/jest',
  '@nestjs-yalc/jest-config',
]);

const frameworkRuntimeExports = workspacePackages.filter(({ pkg }) => {
  return (
    pkg.name.startsWith('@nestjs-yalc/') &&
    !pkg.name.includes('/types') &&
    !frameworkExcludedPackageNames.has(pkg.name)
  );
});

const frameworkTypeExports = workspacePackages.filter(({ pkg }) => {
  return (
    pkg.name.startsWith('@nestjs-yalc/') &&
    !frameworkExcludedPackageNames.has(pkg.name)
  );
});

const rewriteInternalDependencies = (dependencies) => {
  if (!dependencies) return dependencies;

  return Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => {
      if (!internalPackageNames.has(name)) return [name, version];
      return [name, `^${workspacePackageVersions.get(name) ?? rootVersion}`];
    }),
  );
};

const normalizeRelPath = (value) => {
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('./') || normalized.startsWith('../'))
    return normalized;
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
  const relativeDir = pkgFolder;
  const distDir = path.join(distRoot, relativeDir);
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  const srcDir = path.join(pkgDir, 'src');
  const hasSrcDir = fs.existsSync(srcDir);
  const sourceOutputDir = hasSrcDir
    ? path.join(distRoot, path.relative(cwd, pkgDir), 'src')
    : path.join(distRoot, path.relative(cwd, pkgDir));

  if (workspace === '.') {
    const frameworkSrcDir = path.join(distDir, 'src');
    fs.mkdirSync(frameworkSrcDir, { recursive: true });

    const jsExports = frameworkRuntimeExports
      .map(({ pkg: workspacePkg }) => `export * from '${workspacePkg.name}';`)
      .join('\n');
    const dtsExports = frameworkTypeExports
      .map(({ pkg: workspacePkg }) => `export * from '${workspacePkg.name}';`)
      .join('\n');

    fs.writeFileSync(
      path.join(frameworkSrcDir, 'index.js'),
      `${jsExports}\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(frameworkSrcDir, 'index.d.ts'),
      `${dtsExports}\n`,
      'utf8',
    );
  }

  if (
    workspace !== '.' &&
    sourceOutputDir !== path.join(distDir, 'src') &&
    fs.existsSync(sourceOutputDir)
  ) {
    fs.cpSync(sourceOutputDir, path.join(distDir, 'src'), {
      recursive: true,
    });
  }

  const compiledIndex = path.join(distDir, 'src', 'index.js');
  const compiledDts = path.join(distDir, 'src', 'index.d.ts');
  let compiledIndexExists = fs.existsSync(compiledIndex);
  let compiledDtsExists = fs.existsSync(compiledDts);

  // Ensure source output exists for packages that only ship declaration files.
  if (!compiledIndexExists && !compiledDtsExists && fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, path.join(distDir, 'src'), { recursive: true });
    compiledIndexExists = fs.existsSync(compiledIndex);
    compiledDtsExists = fs.existsSync(compiledDts);
  }
  const main = compiledIndexExists
    ? './src/index.js'
    : pkg.main && pkg.main !== '' && !compiledDtsExists
    ? toJsPath(pkg.main)
    : undefined;
  const types = compiledDtsExists
    ? './src/index.d.ts'
    : pkg.types
    ? toDtsPath(pkg.types)
    : pkg.typings
    ? toDtsPath(pkg.typings)
    : undefined;

  const exportsField =
    workspace === '.'
      ? {
          '.': {
            types: './src/index.d.ts',
            import: './src/index.js',
            default: './src/index.js',
          },
        }
      : pkg.exports !== undefined
      ? normalizeExportTargets(pkg.exports, (value) => {
          if (!compiledIndexExists && !compiledDtsExists) return value;
          if (value.startsWith('./dist/src/'))
            return value.replace('./dist/src/', './src/');
          if (value.startsWith('./dist/'))
            return value.replace('./dist/', './src/');
          if (
            !hasSrcDir &&
            value.startsWith('./') &&
            !value.startsWith('./src/')
          ) {
            return value.replace('./', './src/');
          }
          return value;
        })
      : {
          '.': main,
          './*': './src/*',
        };

  const distPkg = {
    ...pkg,
    name: pkgName,
    version: workspace === '.' ? rootVersion : pkg.version ?? rootVersion,
    main,
    module: undefined,
    types,
    typings: undefined,
    exports: exportsField,
    files: Array.from(new Set([...(pkg.files ?? []), 'src'])),
    repository: pkg.repository ?? publicRepository,
    bugs: pkg.bugs ?? publicBugs,
    homepage: pkg.homepage ?? publicHomepage,
    publishConfig: {
      ...(pkg.publishConfig ?? {}),
      access: 'public',
    },
  };

  const tslibVersion =
    (pkg.dependencies && pkg.dependencies.tslib) ||
    (rootPkg.dependencies && rootPkg.dependencies.tslib) ||
    '^2.6.3';

  const frameworkDependencies =
    workspace === '.'
      ? Object.fromEntries(
          frameworkTypeExports.map(({ pkg: workspacePkg }) => [
            workspacePkg.name,
            `^${workspacePkg.version ?? rootVersion}`,
          ]),
        )
      : {};

  distPkg.dependencies = {
    ...rewriteInternalDependencies(pkg.dependencies ?? {}),
    ...frameworkDependencies,
    tslib: tslibVersion,
  };

  if (pkg.peerDependencies) {
    distPkg.peerDependencies = rewriteInternalDependencies(
      pkg.peerDependencies,
    );
  }

  if (pkg.optionalDependencies) {
    distPkg.optionalDependencies = rewriteInternalDependencies(
      pkg.optionalDependencies,
    );
  }

  // Avoid shipping dev-time scripts (postinstall, etc.) in built artefacts.
  delete distPkg.scripts;
  delete distPkg.devDependencies;
  delete distPkg.workspaces;
  delete distPkg.overrides;
  delete distPkg.private;

  const distPkgPath = path.join(distDir, 'package.json');
  fs.writeFileSync(
    distPkgPath,
    `${JSON.stringify(distPkg, null, 2)}\n`,
    'utf8',
  );

  const licensePath = path.join(cwd, 'LICENSE');
  if (fs.existsSync(licensePath)) {
    fs.copyFileSync(licensePath, path.join(distDir, 'LICENSE'));
  }

  const readmePath = fs.existsSync(path.join(pkgDir, 'README.md'))
    ? path.join(pkgDir, 'README.md')
    : path.join(cwd, 'docs', 'README.md');
  if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, path.join(distDir, 'README.md'));
  }
}
