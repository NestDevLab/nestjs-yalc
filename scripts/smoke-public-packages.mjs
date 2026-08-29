import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  getRuntimeDependencyClosure,
  getPublishOrderedDistPackageDirs,
  readJson,
  repoRoot,
  validateDistPackage,
} from './public-package-manifest.mjs';

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value = 'true'] = arg.slice(2).split('=');
      return [key, value];
    }),
);

const source = args.get('source') ?? 'tarball';
const keepTemp = args.get('keep-temp') === 'true';
const rootPackage = readJson(path.join(repoRoot, 'package.json'));
const version = args.get('version') ?? rootPackage.version;
const crudGenPackage = readJson(path.join(repoRoot, 'crud-gen', 'package.json'));
const crudGenVersion =
  args.get('crud-gen-version') ?? crudGenPackage.version;
const omniKernelPackage = readJson(
  path.join(repoRoot, 'examples', 'omnikernel', 'module', 'package.json'),
);
const omniKernelVersion =
  args.get('omnikernel-version') ?? omniKernelPackage.version;

if (!['tarball', 'registry'].includes(source)) {
  console.error(`Unsupported smoke source: ${source}`);
  process.exit(1);
}

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), `nestjs-yalc-smoke-${source}-`),
);
const tarballDir = path.join(tempRoot, 'tarballs');
const frameworkConsumerDir = path.join(tempRoot, 'framework-consumer');
const crudGenConsumerDir = path.join(tempRoot, 'crud-gen-consumer');
const omniKernelConsumerDir = path.join(tempRoot, 'omnikernel-consumer');

fs.mkdirSync(tarballDir, { recursive: true });
fs.mkdirSync(frameworkConsumerDir, { recursive: true });
fs.mkdirSync(crudGenConsumerDir, { recursive: true });
fs.mkdirSync(omniKernelConsumerDir, { recursive: true });

try {
  const tarballs =
    source === 'tarball' ? packDistPackages(tarballDir) : new Map();
  const frameworkInstallTargets =
    source === 'tarball'
      ? Array.from(tarballs.values())
      : [`@nestjs-yalc/framework@${version}`];

  writeFrameworkConsumerProject(frameworkConsumerDir);

  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--omit=optional',
      '--ignore-scripts',
      ...frameworkInstallTargets,
    ],
    frameworkConsumerDir,
  );

  run(
    'node',
    [path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
    frameworkConsumerDir,
  );
  run('node', ['smoke-runtime.mjs'], frameworkConsumerDir);

  const crudGenClosure =
    source === 'tarball'
      ? getRuntimeDependencyClosure('@nestjs-yalc/crud-gen')
      : undefined;
  if (crudGenClosure?.errors.length) {
    throw new Error(
      `CrudGen runtime dependency closure is incomplete:\n- ${crudGenClosure.errors.join(
        '\n- ',
      )}`,
    );
  }

  writeCrudGenConsumerProject(
    crudGenConsumerDir,
    source,
    crudGenVersion,
    tarballs,
    source === 'tarball' ? Array.from(tarballs.keys()) : [],
  );
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts'],
    crudGenConsumerDir,
  );
  run(
    'node',
    [path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
    crudGenConsumerDir,
  );
  run('node', ['smoke-runtime.mjs'], crudGenConsumerDir);

  const omniKernelClosure =
    source === 'tarball'
      ? getRuntimeDependencyClosure('@nestjs-yalc/omnikernel-module')
      : undefined;
  if (omniKernelClosure?.errors.length) {
    throw new Error(
      `OmniKernel runtime dependency closure is incomplete:\n- ${omniKernelClosure.errors.join(
        '\n- ',
      )}`,
    );
  }

  writeOmniKernelConsumerProject(
    omniKernelConsumerDir,
    source,
    omniKernelVersion,
    tarballs,
    source === 'tarball' ? Array.from(tarballs.keys()) : [],
  );
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts'],
    omniKernelConsumerDir,
  );
  run(
    'node',
    [path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
    omniKernelConsumerDir,
  );
  run('node', ['smoke-runtime.mjs'], omniKernelConsumerDir);

  console.log(`Public package smoke test passed (${source}).`);
} finally {
  if (keepTemp) {
    console.log(`Smoke workspace kept at ${tempRoot}`);
  } else {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function packDistPackages(destinationDir) {
  const packageDirs = getPublishOrderedDistPackageDirs();
  const tarballs = new Map();

  if (packageDirs.length === 0) {
    throw new Error('No dist packages found. Run npm run build first.');
  }

  for (const pkgDir of packageDirs) {
    const { pkg, errors } = validateDistPackage(pkgDir);
    if (errors.length > 0) {
      throw new Error(`${pkg.name} is not publishable:\n- ${errors.join('\n- ')}`);
    }

    const result = run(
      'npm',
      ['pack', '--json', '--pack-destination', destinationDir],
      pkgDir,
      { capture: true },
    );
    const [packResult] = JSON.parse(result.stdout);
    tarballs.set(pkg.name, path.join(destinationDir, packResult.filename));
  }

  return tarballs;
}

function writeFrameworkConsumerProject(targetDir) {
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        scripts: {
          smoke: 'node smoke-runtime.mjs',
        },
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['smoke-types.ts'],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-types.ts'),
    `import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import type { ICrudGenBaseParams } from '@nestjs-yalc/crud-gen';
import {
  ContextCallServiceFactory,
  SortDirection,
  YalcEventService,
  yalcTypeOrmPostgresOptions,
} from '@nestjs-yalc/framework';

class SmokeEntity {
  id!: string;
}

const entityClass: ClassType<SmokeEntity> = SmokeEntity;
const query: ICrudGenBaseParams<SmokeEntity> = {
  startRow: 0,
  endRow: 10,
};

const runtimeReferences = [
  entityClass.name,
  query.startRow,
  SortDirection.ASC,
  ContextCallServiceFactory.name,
  YalcEventService.name,
  typeof yalcTypeOrmPostgresOptions,
];

if (runtimeReferences.length !== 6) {
  throw new Error('Unexpected smoke reference count');
}
`,
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-runtime.mjs'),
    `import fs from 'node:fs';

const crudGenPackage = JSON.parse(
  fs.readFileSync(
    new URL('./node_modules/@nestjs-yalc/crud-gen/package.json', import.meta.url),
    'utf8',
  ),
);
for (const dependencyName of [
  '@nestjs-yalc/event-manager',
  'graphql-type-json',
]) {
  if (!crudGenPackage.dependencies?.[dependencyName]) {
    throw new Error(
      \`CrudGen package is missing runtime dependency: \${dependencyName}\`,
    );
  }
}

const packages = [
  '@nestjs-yalc/framework',
  '@nestjs-yalc/api-strategy',
  '@nestjs-yalc/crud-gen',
  '@nestjs-yalc/database',
  '@nestjs-yalc/event-manager',
  '@nestjs-yalc/kafka',
  '@nestjs-yalc/logger',
  '@nestjs-yalc/utils',
];

for (const packageName of packages) {
  const loaded = await import(packageName);
  if (!loaded || Object.keys(loaded).length === 0) {
    throw new Error(\`Package did not expose runtime exports: \${packageName}\`);
  }
}

const framework = await import('@nestjs-yalc/framework');
for (const exportName of [
  'ContextCallServiceFactory',
  'SortDirection',
  'YalcEventService',
  'yalcTypeOrmPostgresOptions',
]) {
  if (!(exportName in framework)) {
    throw new Error(\`Missing framework export: \${exportName}\`);
  }
}

console.log('Runtime imports passed.');
`,
  );
}

function writeCrudGenConsumerProject(
  targetDir,
  packageSource,
  packageVersion,
  tarballs,
  closurePackageNames,
) {
  const crudGenTarget =
    packageSource === 'tarball'
      ? `file:${requireTarball(tarballs, '@nestjs-yalc/crud-gen')}`
      : packageVersion;
  const overrides =
    packageSource === 'tarball'
      ? Object.fromEntries(
          closurePackageNames
            .filter((packageName) => packageName !== '@nestjs-yalc/crud-gen')
            .map((packageName) => [
              packageName,
              `file:${requireTarball(tarballs, packageName)}`,
            ]),
        )
      : undefined;

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@nestjs-yalc/crud-gen': crudGenTarget,
        },
        ...(overrides && Object.keys(overrides).length > 0
          ? { overrides }
          : {}),
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['smoke-types.ts'],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-types.ts'),
    `import {
  createProjectionDialect,
  defineProjectionResource,
  type ProjectionResourceDefinition,
} from '@nestjs-yalc/crud-gen';

const definition: ProjectionResourceDefinition = defineProjectionResource({
  id: 'standalone-smoke',
  tableName: 'resources',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'space_id', serverOwned: true },
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
    {
      name: 'title',
      storage: 'json',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      path: ['title'],
      query: { filter: ['eq'], sort: true },
    },
  ],
});

const sqliteName = createProjectionDialect('sqlite').name;
const postgresName = createProjectionDialect('postgres').name;
void [definition, sqliteName, postgresName];
`,
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-runtime.mjs'),
    `import fs from 'node:fs';
import {
  createProjectionDialect,
  defineProjectionResource,
} from '@nestjs-yalc/crud-gen';

const consumerPackage = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
if (
  Object.keys(consumerPackage.dependencies ?? {}).join(',') !==
  '@nestjs-yalc/crud-gen'
) {
  throw new Error('Standalone consumer must declare only CrudGen.');
}

const definition = defineProjectionResource({
  id: 'standalone-smoke',
  tableName: 'resources',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'space_id', serverOwned: true },
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
    {
      name: 'title',
      storage: 'json',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      path: ['title'],
      query: { filter: ['eq'], sort: true },
    },
  ],
});

const dialects = [
  createProjectionDialect('sqlite'),
  createProjectionDialect('postgres'),
];
if (
  definition.scope.column !== 'space_id' ||
  dialects.map(({ name }) => name).join(',') !== 'sqlite,postgres'
) {
  throw new Error('CrudGen projection exports did not execute as expected.');
}

console.log('Standalone CrudGen import passed.');
`,
  );
}

function writeOmniKernelConsumerProject(
  targetDir,
  packageSource,
  packageVersion,
  tarballs,
  closurePackageNames,
) {
  const omniKernelTarget =
    packageSource === 'tarball'
      ? `file:${requireTarball(tarballs, '@nestjs-yalc/omnikernel-module')}`
      : packageVersion;
  const overrides =
    packageSource === 'tarball'
      ? Object.fromEntries(
          closurePackageNames
            .filter(
              (packageName) =>
                packageName !== '@nestjs-yalc/omnikernel-module',
            )
            .map((packageName) => [
              packageName,
              `file:${requireTarball(tarballs, packageName)}`,
            ]),
        )
      : undefined;

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@nestjs-yalc/omnikernel-module': omniKernelTarget,
        },
        ...(overrides && Object.keys(overrides).length > 0
          ? { overrides }
          : {}),
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['smoke-types.ts'],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-types.ts'),
    `import {
  OmniKernelModule,
  OmniRecordEntity,
  createOmniExtensionProjectionRegistration,
} from '@nestjs-yalc/omnikernel-module';

void [
  OmniKernelModule,
  OmniRecordEntity,
  createOmniExtensionProjectionRegistration,
];
`,
  );

  fs.writeFileSync(
    path.join(targetDir, 'smoke-runtime.mjs'),
    `import fs from 'node:fs';
import * as omniKernel from '@nestjs-yalc/omnikernel-module';

const consumerPackage = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
if (
  Object.keys(consumerPackage.dependencies ?? {}).join(',') !==
  '@nestjs-yalc/omnikernel-module'
) {
  throw new Error('Standalone consumer must declare only OmniKernel.');
}

for (const exportName of [
  'OmniKernelModule',
  'OmniRecordEntity',
  'createOmniExtensionProjectionRegistration',
]) {
  if (!(exportName in omniKernel)) {
    throw new Error(\`Missing OmniKernel export: \${exportName}\`);
  }
}

console.log('Standalone OmniKernel import passed.');
`,
  );
}

function requireTarball(tarballs, packageName) {
  const tarball = tarballs.get(packageName);
  if (!tarball) {
    throw new Error(`No local tarball found for ${packageName}.`);
  }
  return tarball;
}

function run(command, commandArgs, cwd, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.status !== 0) {
    if (options.capture) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    throw new Error(
      `Command failed in ${cwd}: ${command} ${commandArgs.join(' ')}`,
    );
  }

  return result;
}
