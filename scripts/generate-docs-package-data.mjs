import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputPath = path.join(repoRoot, 'docs/_data/public_packages.json');
const tempOutputPath = path.join(
  repoRoot,
  'var/tmp/public_packages.expected.json',
);
const scopePrefix = '@nestjs-yalc/';
const frameworkPackage = `${scopePrefix}framework`;

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, 'utf8'));

const packageToDocsData = (packageJson) => {
  const { name, description = '' } = packageJson;

  return {
    name,
    shortName: name.startsWith(scopePrefix)
      ? name.slice(scopePrefix.length)
      : name,
    npmUrl: `https://www.npmjs.com/package/${name}`,
    description,
  };
};

const rootPackage = await readJson(path.join(repoRoot, 'package.json'));
const packages = [];

for (const workspace of rootPackage.workspaces ?? []) {
  const workspacePackagePath = path.join(repoRoot, workspace, 'package.json');
  const packageJson = await readJson(workspacePackagePath);

  if (
    packageJson.private === true ||
    typeof packageJson.name !== 'string' ||
    !packageJson.name.startsWith(scopePrefix) ||
    packageJson.name === frameworkPackage
  ) {
    continue;
  }

  packages.push(packageToDocsData(packageJson));
}

const nextContent = `${JSON.stringify(packages, null, 2)}\n`;

if (checkOnly) {
  let currentContent = '';

  try {
    currentContent = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (currentContent !== nextContent) {
    await mkdir(path.dirname(tempOutputPath), { recursive: true });
    await writeFile(tempOutputPath, nextContent);
    console.error(
      [
        'docs/_data/public_packages.json is stale.',
        'Run `npm run docs:packages` and commit the updated data file.',
        `Expected data was written to ${path.relative(repoRoot, tempOutputPath)}.`,
      ].join('\n'),
    );
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextContent);
}
