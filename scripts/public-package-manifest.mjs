import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const distRoot = path.join(repoRoot, 'var', 'dist');

export const readJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

export const getDistPackageDirs = () => {
  if (!fs.existsSync(distRoot)) return [];

  return fs
    .readdirSync(distRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(distRoot, entry.name))
    .filter((pkgDir) => fs.existsSync(path.join(pkgDir, 'package.json')))
    .sort();
};

export const getPublishOrderedDistPackageDirs = () => {
  const pkgDirs = getDistPackageDirs();
  const packageByName = new Map(
    pkgDirs.map((pkgDir) => {
      const pkg = readJson(path.join(pkgDir, 'package.json'));
      return [pkg.name, { pkg, pkgDir }];
    }),
  );
  const dependencyGraph = new Map(
    Array.from(packageByName.entries()).map(([pkgName, { pkg }]) => [
      pkgName,
      getInternalDependencyNames(pkg, [
        'dependencies',
        'optionalDependencies',
      ])
        .filter((dependencyName) => packageByName.has(dependencyName))
        .sort(),
    ]),
  );
  const components = getStronglyConnectedComponents(dependencyGraph);
  const componentByPackage = new Map(
    components.flatMap((component, componentIndex) =>
      component.map((pkgName) => [pkgName, componentIndex]),
    ),
  );
  const orderedComponents = [];
  const visitedComponents = new Set();

  const visitComponent = (componentIndex) => {
    if (visitedComponents.has(componentIndex)) return;
    visitedComponents.add(componentIndex);

    const dependencies = new Set();
    for (const pkgName of components[componentIndex]) {
      for (const dependencyName of dependencyGraph.get(pkgName) ?? []) {
        const dependencyComponent = componentByPackage.get(dependencyName);
        if (dependencyComponent !== componentIndex) {
          dependencies.add(dependencyComponent);
        }
      }
    }

    for (const dependencyComponent of Array.from(dependencies).sort(
      (left, right) =>
        components[left][0].localeCompare(components[right][0]),
    )) {
      visitComponent(dependencyComponent);
    }

    orderedComponents.push(componentIndex);
  };

  for (const componentIndex of components
    .map((_, index) => index)
    .sort((left, right) =>
      components[left][0].localeCompare(components[right][0]),
    )) {
    visitComponent(componentIndex);
  }

  return orderedComponents.flatMap((componentIndex) =>
    components[componentIndex].map(
      (pkgName) => packageByName.get(pkgName).pkgDir,
    ),
  );
};

const dependencyBlocks = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

const getInternalDependencyNames = (pkg, blocks = dependencyBlocks) => {
  const dependencyNames = new Set();

  for (const dependencyBlock of blocks) {
    for (const dependencyName of Object.keys(pkg[dependencyBlock] ?? {})) {
      dependencyNames.add(dependencyName);
    }
  }

  return Array.from(dependencyNames).filter((dependencyName) =>
    dependencyName.startsWith('@nestjs-yalc/'),
  );
};

const getStronglyConnectedComponents = (graph) => {
  let nextIndex = 0;
  const componentStack = [];
  const indexByNode = new Map();
  const lowLinkByNode = new Map();
  const nodesOnStack = new Set();
  const components = [];

  const visit = (node) => {
    indexByNode.set(node, nextIndex);
    lowLinkByNode.set(node, nextIndex);
    nextIndex += 1;
    componentStack.push(node);
    nodesOnStack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!indexByNode.has(dependency)) {
        visit(dependency);
        lowLinkByNode.set(
          node,
          Math.min(lowLinkByNode.get(node), lowLinkByNode.get(dependency)),
        );
      } else if (nodesOnStack.has(dependency)) {
        lowLinkByNode.set(
          node,
          Math.min(lowLinkByNode.get(node), indexByNode.get(dependency)),
        );
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;

    const component = [];
    let member;
    do {
      member = componentStack.pop();
      nodesOnStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component.sort());
  };

  for (const node of Array.from(graph.keys()).sort()) {
    if (!indexByNode.has(node)) visit(node);
  }

  return components;
};

const getPackageDependencyName = (specifier) => {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }

  return specifier.split('/')[0];
};

const getModuleSpecifiers = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const specifiers = new Set();

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.add(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return Array.from(specifiers);
};

const unwrapExportTarget = (target) => {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    return target.map(unwrapExportTarget).find(Boolean);
  }
  if (target && typeof target === 'object') {
    return unwrapExportTarget(target.import ?? target.default ?? target.require);
  }
  return undefined;
};

const resolvePackageExport = (entry, subpath) => {
  if (!subpath) {
    const rootExport = unwrapExportTarget(entry.pkg.exports?.['.']);
    return rootExport ?? entry.pkg.main;
  }

  const requestedExport = `./${subpath}`;
  const exactExport = unwrapExportTarget(entry.pkg.exports?.[requestedExport]);
  if (exactExport) return exactExport;

  for (const [exportPattern, target] of Object.entries(
    entry.pkg.exports ?? {},
  )) {
    const wildcardIndex = exportPattern.indexOf('*');
    if (wildcardIndex === -1) continue;

    const prefix = exportPattern.slice(0, wildcardIndex);
    const suffix = exportPattern.slice(wildcardIndex + 1);
    if (
      !requestedExport.startsWith(prefix) ||
      !requestedExport.endsWith(suffix)
    ) {
      continue;
    }

    const wildcard = requestedExport.slice(
      prefix.length,
      requestedExport.length - suffix.length,
    );
    const exportTarget = unwrapExportTarget(target);
    if (exportTarget) return exportTarget.replace('*', wildcard);
  }

  return `./src/${subpath}`;
};

const resolveFile = (candidate) => {
  const candidates = [candidate];
  if (!path.extname(candidate)) {
    candidates.push(`${candidate}.js`, path.join(candidate, 'index.js'));
  }

  return candidates.find((filePath) => fs.existsSync(filePath));
};

export const getRuntimeDependencyClosure = (entryPackageName) => {
  const packageEntries = getDistPackageDirs().map((pkgDir) => ({
    pkgDir,
    pkg: readJson(path.join(pkgDir, 'package.json')),
  }));
  const packageByName = new Map(
    packageEntries.map((entry) => [entry.pkg.name, entry]),
  );
  const entry = packageByName.get(entryPackageName);

  if (!entry) {
    throw new Error(`Dist package not found: ${entryPackageName}`);
  }

  const entryTarget = resolvePackageExport(entry, '');
  const entryFile = entryTarget
    ? resolveFile(path.resolve(entry.pkgDir, entryTarget))
    : undefined;
  if (!entryFile) {
    throw new Error(`Runtime entrypoint not found for ${entryPackageName}.`);
  }

  const queue = [{ entry, filePath: entryFile }];
  const visitedFiles = new Set();
  const packageNames = new Set();
  const errors = new Set();
  const builtins = new Set([
    ...builtinModules,
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
  ]);

  while (queue.length > 0) {
    const current = queue.shift();
    const visitKey = `${current.entry.pkg.name}:${current.filePath}`;
    if (visitedFiles.has(visitKey)) continue;

    visitedFiles.add(visitKey);
    packageNames.add(current.entry.pkg.name);

    for (const specifier of getModuleSpecifiers(current.filePath)) {
      if (specifier.startsWith('.')) {
        const relativeFile = resolveFile(
          path.resolve(path.dirname(current.filePath), specifier),
        );
        if (!relativeFile) {
          errors.add(
            `${current.entry.pkg.name} imports missing runtime file ${specifier} from ${path.relative(
              current.entry.pkgDir,
              current.filePath,
            )}.`,
          );
          continue;
        }
        queue.push({ entry: current.entry, filePath: relativeFile });
        continue;
      }

      if (builtins.has(specifier)) continue;

      const dependencyName = getPackageDependencyName(specifier);
      const isSelfImport = dependencyName === current.entry.pkg.name;
      const isDeclared = dependencyBlocks.some(
        (block) => current.entry.pkg[block]?.[dependencyName],
      );
      if (!isSelfImport && !isDeclared) {
        errors.add(
          `${current.entry.pkg.name} imports undeclared runtime dependency ${dependencyName} from ${path.relative(
            current.entry.pkgDir,
            current.filePath,
          )}.`,
        );
      }

      const internalEntry = packageByName.get(dependencyName);
      if (!internalEntry) continue;

      const packageSubpath = specifier.slice(dependencyName.length + 1);
      const exportTarget = resolvePackageExport(internalEntry, packageSubpath);
      const internalFile = exportTarget
        ? resolveFile(path.resolve(internalEntry.pkgDir, exportTarget))
        : undefined;
      if (!internalFile) {
        errors.add(`${specifier} does not resolve to a built runtime file.`);
        continue;
      }
      queue.push({ entry: internalEntry, filePath: internalFile });
    }
  }

  return {
    errors: Array.from(errors).sort(),
    packageNames: Array.from(packageNames).sort(),
    visitedFiles: Array.from(visitedFiles).sort(),
  };
};

export const validateDistPackage = (pkgDir) => {
  const pkgPath = path.join(pkgDir, 'package.json');
  const pkg = readJson(pkgPath);
  const errors = [];

  if (!pkg.name?.startsWith('@nestjs-yalc/')) {
    errors.push(`Package name must use the @nestjs-yalc scope: ${pkg.name}`);
  }

  if (pkg.private) {
    errors.push('Published dist packages must not be private.');
  }

  if (pkg.publishConfig?.access !== 'public') {
    errors.push('Scoped packages must set publishConfig.access to public.');
  }

  for (const dependencyBlock of dependencyBlocks) {
    for (const [name, version] of Object.entries(pkg[dependencyBlock] ?? {})) {
      if (typeof version === 'string' && version.startsWith('file:')) {
        errors.push(`${dependencyBlock}.${name} still uses ${version}.`);
      }
    }
  }

  if (pkg.main && !fs.existsSync(path.join(pkgDir, pkg.main))) {
    errors.push(`main points to a missing file: ${pkg.main}`);
  }

  if (pkg.types && !fs.existsSync(path.join(pkgDir, pkg.types))) {
    errors.push(`types points to a missing file: ${pkg.types}`);
  }

  return { pkg, errors };
};
