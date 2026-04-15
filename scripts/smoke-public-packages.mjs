import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
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

if (!['tarball', 'registry'].includes(source)) {
  console.error(`Unsupported smoke source: ${source}`);
  process.exit(1);
}

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), `nestjs-yalc-smoke-${source}-`),
);
const tarballDir = path.join(tempRoot, 'tarballs');
const consumerDir = path.join(tempRoot, 'consumer');

fs.mkdirSync(tarballDir, { recursive: true });
fs.mkdirSync(consumerDir, { recursive: true });

try {
  writeConsumerProject(consumerDir);

  const installTargets =
    source === 'tarball'
      ? packDistPackages(tarballDir)
      : [`@nestjs-yalc/framework@${version}`];

  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--omit=optional',
      '--ignore-scripts',
      ...installTargets,
    ],
    consumerDir,
  );

  run(
    'node',
    [path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
    consumerDir,
  );
  run('node', ['smoke-runtime.mjs'], consumerDir);

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
  const tarballs = [];

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
    tarballs.push(path.join(destinationDir, packResult.filename));
  }

  return tarballs;
}

function writeConsumerProject(targetDir) {
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
    `const packages = [
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
