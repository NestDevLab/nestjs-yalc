import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = readJson(path.join(repoRoot, 'package.json'));
const outputRoot = path.join(repoRoot, 'var', 'example-exports');
const publicVersionRange = `^${rootPackage.version}`;
const publicPackageNames = new Set(
  [
    rootPackage.name,
    ...(rootPackage.workspaces ?? []).map((workspacePath) => {
      const packagePath = path.join(repoRoot, workspacePath, 'package.json');
      return fs.existsSync(packagePath) ? readJson(packagePath).name : undefined;
    }),
  ].filter(Boolean),
);

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

        if (publicPackageNames.has(dependencyName)) {
          manifest[section][dependencyName] = publicVersionRange;
        }
      }
    }

    fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function writeExportNotice(target, exampleName) {
  const notice = [
    '# Public example export',
    '',
    `This directory is a generated export of the \`${exampleName}\` example.`,
    '',
    'It is intended to be mirrored into a read-only example repository. Framework',
    'dependencies are rewritten to public `@nestjs-yalc/*` npm versions, while',
    'example-local modules stay as local `file:` dependencies.',
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
