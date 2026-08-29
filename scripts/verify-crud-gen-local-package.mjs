import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  getPublishOrderedDistPackageDirs,
  repoRoot,
  validateDistPackage,
} from './public-package-manifest.mjs';
import {
  assertLocalPackageDist,
  getLocalPackageDistEntries,
} from './local-package-dist.mjs';

const crudGenDir = path.join(repoRoot, 'crud-gen');
const omniKernelDir = path.join(repoRoot, 'examples', 'omnikernel', 'module');
const keepTemp = process.argv.includes('--keep-temp');
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'nestjs-yalc-local-package-'),
);
const tarballDir = path.join(tempRoot, 'tarballs');
const npmConsumerDir = path.join(tempRoot, 'npm-consumer');
const pnpmConsumerDir = path.join(tempRoot, 'pnpm-consumer');
const pinnedPnpmVersion = '11.20.0';
const pnpmInvocation = resolvePnpmInvocation();

fs.mkdirSync(tarballDir, { recursive: true });
fs.mkdirSync(npmConsumerDir, { recursive: true });
fs.mkdirSync(pnpmConsumerDir, { recursive: true });

try {
  assertLocalPackageDist(crudGenDir);
  assertLocalPackageDist(omniKernelDir);

  const sourceCounts = inspectCompiledPackage(crudGenDir);
  const crudGenTarball = packPackage(crudGenDir, tarballDir);
  const packedCounts = inspectPackedPackage(crudGenTarball);
  const publicTarballs = packPublicPackages(tarballDir);
  const omniKernelTarball = packPackage(omniKernelDir, tarballDir);
  const npmOverrides = Object.fromEntries(
    Array.from(publicTarballs.entries()).map(([packageName, tarball]) => [
      packageName,
      `file:${tarball}`,
    ]),
  );
  npmOverrides['@nestjs-yalc/omnikernel-module'] = {
    '@nestjs-yalc/crud-gen': '$@nestjs-yalc/crud-gen',
  };
  const pnpmOverrides = Object.fromEntries(
    getLocalPackageDistEntries().map(({ name, packageDir }) => [
      name,
      `file:${packageDir}`,
    ]),
  );

  const npmInstalledCounts = verifyConsumer({
    name: 'npm',
    packageManager: 'npm',
    targetDir: npmConsumerDir,
    dependencies: {
      '@nestjs-yalc/crud-gen': `file:${crudGenTarball}`,
      '@nestjs-yalc/omnikernel-module': `file:${omniKernelTarball}`,
    },
    overrides: npmOverrides,
  });
  const pnpmInstalledCounts = verifyConsumer({
    name: 'pnpm',
    packageManager: 'pnpm',
    targetDir: pnpmConsumerDir,
    dependencies: {
      '@nestjs-yalc/crud-gen': `file:${crudGenDir}`,
      '@nestjs-yalc/omnikernel-module': `file:${omniKernelDir}`,
    },
    overrides: pnpmOverrides,
  });

  console.log(
    `CrudGen source dist: js=${sourceCounts.js}, dts=${sourceCounts.dts}, sourceTs=${sourceCounts.sourceTs}, dtsTsSpecifiers=${sourceCounts.dtsTsSpecifiers}.`,
  );
  console.log(
    `CrudGen source tarball: files=${packedCounts.files}, js=${packedCounts.js}, dts=${packedCounts.dts}, sourceTs=${packedCounts.sourceTs}.`,
  );
  console.log(
    `npm installed CrudGen dist: js=${npmInstalledCounts.js}, dts=${npmInstalledCounts.dts}, sourceTs=${npmInstalledCounts.sourceTs}, dtsTsSpecifiers=${npmInstalledCounts.dtsTsSpecifiers}.`,
  );
  console.log(
    `pnpm installed CrudGen dist: js=${pnpmInstalledCounts.js}, dts=${pnpmInstalledCounts.dts}, sourceTs=${pnpmInstalledCounts.sourceTs}, dtsTsSpecifiers=${pnpmInstalledCounts.dtsTsSpecifiers}.`,
  );
  console.log(
    'Fresh npm and pnpm consumers typechecked defineProjectionResource and ProjectionResourceService; runtime imports and OmniKernel CrudGen identity passed.',
  );
} finally {
  if (keepTemp) {
    console.log(`Temporary local-package consumer kept at ${tempRoot}.`);
  } else {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log('Temporary local-package consumer and tarballs removed.');
  }
}

function packPublicPackages(destinationDir) {
  const tarballs = new Map();

  for (const packageDir of getPublishOrderedDistPackageDirs()) {
    const { pkg, errors } = validateDistPackage(packageDir);
    if (pkg.name === '@nestjs-yalc/crud-gen') continue;
    if (errors.length > 0) {
      throw new Error(`${pkg.name} is not packable:\n- ${errors.join('\n- ')}`);
    }
    tarballs.set(pkg.name, packPackage(packageDir, destinationDir));
  }

  return tarballs;
}

function packPackage(packageDir, destinationDir) {
  const result = run(
    'npm',
    ['pack', '--json', '--pack-destination', destinationDir],
    packageDir,
    { capture: true },
  );
  const [packed] = JSON.parse(result.stdout);
  return path.join(destinationDir, packed.filename);
}

function verifyConsumer({
  name,
  packageManager,
  targetDir,
  dependencies,
  overrides,
}) {
  writeConsumer({ targetDir, packageManager, dependencies, overrides });
  const install =
    packageManager === 'npm'
      ? {
          command: 'npm',
          args: [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--omit=optional',
          ],
        }
      : {
          command: pnpmInvocation.command,
          args: [
            ...pnpmInvocation.args,
            'install',
            '--ignore-scripts',
            '--no-frozen-lockfile',
          ],
        };
  run(install.command, install.args, targetDir);
  run(
    'node',
    [
      path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p',
      '.',
    ],
    targetDir,
  );
  run('node', ['runtime.mjs'], targetDir);

  const { directCrudGen } = JSON.parse(
    fs.readFileSync(path.join(targetDir, 'runtime-resolution.json'), 'utf8'),
  );
  const installedCrudGenDir = packageDirFromEntrypoint(
    directCrudGen,
    '@nestjs-yalc/crud-gen',
  );
  const installedCounts = inspectCompiledPackage(installedCrudGenDir);
  assertSameCompiledProjectionArtifact(
    path.join(
      crudGenDir,
      'dist',
      'src',
      'projection',
      'projection-resource.js',
    ),
    path.join(
      installedCrudGenDir,
      'dist',
      'src',
      'projection',
      'projection-resource.js',
    ),
  );
  console.log(
    `${name} consumer resolved direct CrudGen and OmniKernel to one local projection artifact.`,
  );

  return installedCounts;
}

function resolvePnpmInvocation() {
  if (process.env.NESTJS_YALC_FORCE_NPM_EXEC_PNPM !== '1') {
    const probe = spawnSync('pnpm', ['--version'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (probe.status === 0) {
      return { command: 'pnpm', args: [] };
    }
  }

  console.log(
    `pnpm is not directly available; using npm exec with pnpm@${pinnedPnpmVersion}.`,
  );
  return {
    command: 'npm',
    args: [
      'exec',
      '--yes',
      `--package=pnpm@${pinnedPnpmVersion}`,
      '--',
      'pnpm',
    ],
  };
}

function writeConsumer({ targetDir, packageManager, dependencies, overrides }) {
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies,
        ...(packageManager === 'npm' ? { overrides } : {}),
      },
      null,
      2,
    )}\n`,
  );
  if (packageManager === 'pnpm') {
    writePnpmWorkspace(targetDir, overrides);
  }
  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['consumer-types.ts'],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(targetDir, 'consumer-types.ts'),
    `import {
  defineProjectionResource,
  ProjectionResourceService,
  type ProjectionResourceDefinition,
} from '@nestjs-yalc/crud-gen';

const definition: ProjectionResourceDefinition = defineProjectionResource({
  id: 'local-package-smoke',
  tableName: 'resources',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scope_id', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: false },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
  ],
});

const serviceConstructor: typeof ProjectionResourceService = ProjectionResourceService;
void [definition, serviceConstructor];
`,
  );
  fs.writeFileSync(
    path.join(targetDir, 'runtime.mjs'),
    `import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  defineProjectionResource,
  ProjectionResourceService,
} from '@nestjs-yalc/crud-gen';

const require = createRequire(import.meta.url);
const directCrudGen = fs.realpathSync(require.resolve('@nestjs-yalc/crud-gen'));
const omniKernelEntry = require.resolve('@nestjs-yalc/omnikernel-module');
const omniKernelDir = path.resolve(path.dirname(omniKernelEntry), '../..');
const omniKernelRequire = createRequire(path.join(omniKernelDir, 'package.json'));
const omniKernelCrudGen = fs.realpathSync(
  omniKernelRequire.resolve('@nestjs-yalc/crud-gen'),
);

if (directCrudGen !== omniKernelCrudGen) {
  throw new Error(
    \`CrudGen identity mismatch: direct=\${directCrudGen}, OmniKernel=\${omniKernelCrudGen}\`,
  );
}

const definition = defineProjectionResource({
  id: 'local-package-smoke',
  tableName: 'resources',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scope_id', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: false },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
  ],
});

if (
  definition.id !== 'local-package-smoke' ||
  typeof ProjectionResourceService !== 'function'
) {
  throw new Error('CrudGen projection exports did not load from the local package.');
}

fs.writeFileSync(
  new URL('./runtime-resolution.json', import.meta.url),
  JSON.stringify({ directCrudGen, omniKernelCrudGen }) + '\\n',
);
`,
  );
}

function writePnpmWorkspace(targetDir, overrides) {
  const overrideLines = Object.entries(overrides).map(
    ([selector, specification]) => `  '${selector}': '${specification}'`,
  );
  fs.writeFileSync(
    path.join(targetDir, 'pnpm-workspace.yaml'),
    `packages:\n  - '.'\nnodeLinker: hoisted\noverrides:\n${overrideLines.join('\n')}\n`,
  );
}

function inspectCompiledPackage(packageDir) {
  const distDir = path.join(packageDir, 'dist');
  const files = listFiles(distDir);
  const dtsFiles = files.filter((filePath) => filePath.endsWith('.d.ts'));
  const sourceTs = files.filter(
    (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts'),
  );
  const dtsTsSpecifiers = dtsFiles.flatMap((filePath) => {
    const contents = fs.readFileSync(filePath, 'utf8');
    return contents.match(/['"][^'"\r\n]*\.ts['"]/g) ?? [];
  });

  if (sourceTs.length > 0 || dtsTsSpecifiers.length > 0) {
    throw new Error(
      `CrudGen package leaks source TypeScript: sourceTs=${sourceTs.length}, dtsTsSpecifiers=${dtsTsSpecifiers.length}.`,
    );
  }

  return {
    js: files.filter((filePath) => filePath.endsWith('.js')).length,
    dts: dtsFiles.length,
    sourceTs: sourceTs.length,
    dtsTsSpecifiers: dtsTsSpecifiers.length,
  };
}

function inspectPackedPackage(tarball) {
  const result = run('tar', ['-tzf', tarball], repoRoot, { capture: true });
  const files = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((filePath) => filePath.replace(/^package\//, ''));
  const required = [
    'dist/src/index.js',
    'dist/src/index.d.ts',
    'dist/src/projection/projection-resource.js',
    'dist/src/projection/projection-resource.d.ts',
    'dist/src/projection/projection.service.js',
    'dist/src/projection/projection.service.d.ts',
  ];
  const missing = required.filter((filePath) => !files.includes(filePath));
  const sourceTs = files.filter(
    (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts'),
  );

  if (missing.length > 0 || sourceTs.length > 0) {
    throw new Error(
      `CrudGen tarball is not self-contained: missing=${missing.join(',') || 'none'}, sourceTs=${sourceTs.length}.`,
    );
  }

  return {
    files: files.length,
    js: files.filter((filePath) => filePath.endsWith('.js')).length,
    dts: files.filter((filePath) => filePath.endsWith('.d.ts')).length,
    sourceTs: sourceTs.length,
  };
}

function listFiles(rootDir) {
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function assertSameCompiledProjectionArtifact(sourcePath, installedPath) {
  const digest = (filePath) =>
    crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

  if (digest(sourcePath) !== digest(installedPath)) {
    throw new Error(
      'Installed CrudGen projection artifact differs from the local source package.',
    );
  }
}

function packageDirFromEntrypoint(entrypoint, packageName) {
  let candidate = path.dirname(entrypoint);

  while (candidate !== path.dirname(candidate)) {
    const packageJsonPath = path.join(candidate, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name === packageName) return candidate;
    }
    candidate = path.dirname(candidate);
  }

  throw new Error(
    `Could not find ${packageName} package root for ${entrypoint}.`,
  );
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout);
      process.stderr.write(result.stderr);
    }
    throw new Error(`Command failed in ${cwd}: ${command} ${args.join(' ')}`);
  }

  return result;
}
