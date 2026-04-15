import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const owner = getOption('owner') ?? process.env.EXAMPLE_MIRROR_OWNER ?? 'NestDevLab';
const branch = getOption('branch') ?? process.env.EXAMPLE_MIRROR_BRANCH ?? 'main';
const cloneRoot = path.join(repoRoot, 'var', 'example-mirrors');
const exportRoot = path.join(repoRoot, 'var', 'example-exports');

const mirrors = [
  {
    name: 'skeleton',
    repository:
      process.env.EXAMPLE_MIRROR_SKELETON_REPOSITORY ??
      'nestjs-yalc-example-skeleton',
  },
  {
    name: 'omnikernel',
    repository:
      process.env.EXAMPLE_MIRROR_OMNIKERNEL_REPOSITORY ??
      'nestjs-yalc-example-omnikernel',
  },
  {
    name: 'task',
    repository:
      process.env.EXAMPLE_MIRROR_TASK_REPOSITORY ??
      'nestjs-yalc-example-task',
  },
];

run('npm', ['run', 'examples:export'], repoRoot);
fs.mkdirSync(cloneRoot, { recursive: true });

for (const mirror of mirrors) {
  const sourceDir = path.join(exportRoot, mirror.name);
  const targetDir = path.join(cloneRoot, mirror.name);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing generated example export: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  run(
    'git',
    [
      'clone',
      '--branch',
      branch,
      '--single-branch',
      mirrorUrl(mirror.repository),
      targetDir,
    ],
    repoRoot,
  );

  replaceRepositoryContents(sourceDir, targetDir);

  const status = getOutput('git', ['status', '--short'], targetDir);

  if (!status.trim()) {
    console.log(`${mirror.name}: no mirror changes`);
    continue;
  }

  if (dryRun) {
    console.log(`${mirror.name}: pending mirror changes`);
    console.log(status);
    continue;
  }

  run('git', ['add', '--all'], targetDir);
  run(
    'git',
    ['commit', '-m', 'chore: sync generated example from nestjs-yalc'],
    targetDir,
  );
  run('git', ['push', 'origin', branch], targetDir);
}

function getOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function mirrorUrl(repository) {
  const token = process.env.EXAMPLE_MIRROR_TOKEN ?? process.env.GH_TOKEN;

  if (token) {
    return `https://x-access-token:${token}@github.com/${owner}/${repository}.git`;
  }

  return `https://github.com/${owner}/${repository}.git`;
}

function replaceRepositoryContents(sourceDir, targetDir) {
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.name === '.git') {
      continue;
    }

    fs.rmSync(path.join(targetDir, entry.name), {
      recursive: true,
      force: true,
    });
  }

  copyDir(sourceDir, targetDir);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
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

function getOutput(command, commandArgs, cwd) {
  return execFileSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function run(command, commandArgs, cwd) {
  console.log(`$ ${command} ${commandArgs.map(sanitizeArg).join(' ')}`);
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
  });
}

function sanitizeArg(arg) {
  return arg.replace(/x-access-token:[^@]+@github\.com/g, 'x-access-token:***@github.com');
}
