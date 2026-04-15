import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = readJson(path.join(repoRoot, 'package.json'));
const outputRoot = path.join(repoRoot, 'var', 'example-exports');
const publicPackageVersions = new Map([[rootPackage.name, rootPackage.version]]);

for (const workspacePath of rootPackage.workspaces ?? []) {
  const packagePath = path.join(repoRoot, workspacePath, 'package.json');

  if (!fs.existsSync(packagePath)) {
    continue;
  }

  const manifest = readJson(packagePath);

  if (manifest.name && manifest.version) {
    publicPackageVersions.set(manifest.name, manifest.version);
  }
}

const examples = [
  {
    name: 'skeleton',
    source: path.join(repoRoot, 'examples', 'skeleton'),
    localPackages: new Map([['@nestjs-yalc/skeleton-module', 'file:../module']]),
  },
  {
    name: 'omnikernel',
    source: path.join(repoRoot, 'examples', 'omnikernel'),
    localPackages: new Map([['@nestjs-yalc/omnikernel-module', 'file:../module']]),
  },
  {
    name: 'task',
    source: path.join(repoRoot, 'examples', 'task'),
    extraCopies: [
      {
        from: path.join(repoRoot, 'examples', 'omnikernel', 'module'),
        to: 'omnikernel-module',
      },
    ],
    localPackages: new Map([
      ['@nestjs-yalc/task-system-module', 'file:../module'],
      ['@nestjs-yalc/omnikernel-module', 'file:../omnikernel-module'],
    ]),
  },
];

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const example of examples) {
  const target = path.join(outputRoot, example.name);
  copyDir(example.source, target);

  for (const extraCopy of example.extraCopies ?? []) {
    copyDir(extraCopy.from, path.join(target, extraCopy.to));
  }

  rewritePackageManifests(target, example.localPackages);
  writeExportNotice(target, example.name);
  writeMirrorCi(target, example.name);
  writeMirrorGitignore(target);
  console.log(`exported ${example.name} -> ${path.relative(repoRoot, target)}`);
}

function rewritePackageManifests(rootDir, localPackages) {
  for (const packagePath of findFiles(rootDir, 'package.json')) {
    const manifest = readJson(packagePath);

    for (const section of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
      'devDependencies',
    ]) {
      if (!manifest[section]) {
        continue;
      }

      for (const [dependencyName, dependencyVersion] of Object.entries(
        manifest[section],
      )) {
        if (localPackages.has(dependencyName)) {
          manifest[section][dependencyName] = localPackages.get(dependencyName);
          continue;
        }

        if (publicPackageVersions.has(dependencyName)) {
          manifest[section][dependencyName] =
            versionRangeForPublicPackage(dependencyName);
        }
      }
    }

    fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function versionRangeForPublicPackage(packageName) {
  return `^${publicPackageVersions.get(packageName)}`;
}

function writeExportNotice(target, exampleName) {
  const notice = [
    '# Public example export',
    '',
    `This directory is a generated export of the \`${exampleName}\` example.`,
    '',
    'It is intended to be mirrored into a read-only example repository. Framework',
    'dependencies are rewritten to package-specific public npm versions, while',
    'example-local modules stay as local `file:` dependencies.',
    '',
    'Do not edit the mirror repository directly. Change the source example in',
    '`NestDevLab/nestjs-yalc`, regenerate the export, and sync the mirror.',
    '',
    'Regenerate it from the framework monorepo with:',
    '',
    '```bash',
    'npm run examples:export',
    '```',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(target, 'PUBLIC_EXPORT.md'), notice);
}

function writeMirrorCi(target, exampleName) {
  const workflowDir = path.join(target, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });

  const workflow = [
    'name: example ci',
    '',
    'on:',
    '  workflow_dispatch:',
    '  push:',
    '    branches:',
    '      - main',
    '  pull_request:',
    '',
    'env:',
    '  NODE_VERSION: 24',
    '  NODE_ENV: pipeline',
    '  JWT_SECRET_PVT: dummydummy',
    '  JWT_SECRET_PUB: dummydummy',
    '',
    'jobs:',
    '  e2e:',
    `    name: ${exampleName} example e2e`,
    '    runs-on: ubuntu-latest',
    '',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v4',
    '',
    '      - name: Setup Node',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version: ${{ env.NODE_VERSION }}',
    '',
    '      - name: Install example dependencies',
    '        run: npm install --prefer-offline --no-audit --prefix app',
    '',
    '      - name: Build example app',
    '        run: npm run build --prefix app',
    '',
    '      - name: Run example e2e tests',
    '        run: npm run test:e2e --prefix app',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(workflowDir, 'ci.yml'), workflow);
}

function writeMirrorGitignore(target) {
  const gitignore = [
    'node_modules/',
    'dist/',
    'coverage/',
    '.env',
    '.env.*',
    '!.env.example',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(target, '.gitignore'), gitignore);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function findFiles(rootDir, fileName) {
  const files = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFiles(entryPath, fileName));
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      files.push(entryPath);
    }
  }

  return files;
}

function shouldSkip(name) {
  return new Set([
    'node_modules',
    'dist',
    'coverage',
    'package-lock.json',
    '.turbo',
    '.cache',
  ]).has(name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
