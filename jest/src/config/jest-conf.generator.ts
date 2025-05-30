/* istanbul ignore file */

import * as path from 'path';
import os from 'os';

import type { JestConfigWithTsJest } from 'ts-jest';
import defaultConf, {
  coveragePathIgnorePatterns,
  globals,
  coverageThreshold,
  IDefaultConfOptions,
  tsJestConfig,
  tsJestConfigE2E,
} from './jest-def.config';
// import { options as jestOptionObject } from 'jest-cli/build/cli/args';
import _yargs from 'yargs';
const yargs = _yargs.default;

interface IAppDep {
  name: string;
  path: string;
}
export interface IAppProjSetting {
  confOverride?: any;
  deps: IAppDep[];
}

export interface IProjectInfo {
  path: string;
  sourcePath: string;
  type: 'library' | 'application' | string;
}

export interface IOptions {
  skipProjects?: string[];
  /**
   * key: project name
   * value: jest configurations
   */
  confOverrides?: { [key: string]: any };
  defaultCoverageThreshold?: {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
  };
  tsConfigPath?: { (proj: IProjectInfo): string };
  coverageOutputPath?: { (subProjectPath: string): string };
  defaultConfOptions?: IDefaultConfOptions;
  tsJestConfig?: any;
  extraSetupFiles?: string[];
  setupFilesAfterEnv?: string[];
}

// considering our heap consumption (~300-700mb), 5 workers will consume around 3GB of ram
// if you want to increase/decrease this value, you can set the npm_config_jestworkers:
// * npm < 9  -> with the `npm config set` command (more info: https://docs.npmjs.com/cli/v7/commands/npm-config)
// * npm >= 9 -> with: export JEST_WORKERS=5
const maxWorkers =
  process.env.npm_config_jestworkers ||
  process.env.JEST_WORKERS ||
  os.cpus().length ||
  10;

// eslint-disable-next-line no-console
console.log(`Max workers: ${maxWorkers}`);

export function jestConfGenerator(
  rootPath: string,
  projectList: { [key: string]: IProjectInfo },
  appProjectsSettings: {
    [key: string]: IAppProjSetting;
  },
  options: IOptions,
): JestConfigWithTsJest {
  const createProjectSets = (projects: any[]) => {
    const _projectSets: { [key: string]: any } = {};
    for (const app in appProjectsSettings) {
      _projectSets[app] = projects.filter((p) =>
        appProjectsSettings[app].deps.some((v) =>
          p.displayName.startsWith(`unit/${v.name}`),
        ),
      );
    }

    return {
      ..._projectSets,
      all: projects,
    };
  };

  const cacheDirBase = '/tmp/jest_rs/';

  let projects = [];

  const confFactory = (
    projName: string,
    proj: IProjectInfo,
    projects?: any,
  ) => ({
    ...defaultConf(
      `${rootPath}/`,
      options.defaultConfOptions,
      tsJestConfig(
        options.tsConfigPath?.(proj) ??
          `${rootPath}/${proj.path}/tsconfig.${
            proj.type === 'library' ? 'lib' : 'app'
          }.json`,
        options.tsJestConfig,
      ),
    ),
    globals: globals(),
    // name: `unit/${projName}`,
    displayName: `unit/${projName}`,
    cacheDirectory: `${cacheDirBase}/unit/${projName}`,
    rootDir: `${rootPath}/${proj.sourcePath}/`,
    roots: [`${rootPath}/${proj.path}`],
    maxWorkers,
    setupFiles: [
      `${__dirname}/jest.setup.ts`,
      ...(options.extraSetupFiles ?? []),
    ],
    coverageThreshold: coverageThreshold(
      projects,
      options.defaultCoverageThreshold,
    ),
    coveragePathIgnorePatterns,
  });

  for (const projName of Object.keys(projectList)) {
    const proj = projectList[projName];
    if (!options.skipProjects?.includes(proj.path)) {
      let conf = confFactory(projName, proj);

      if (appProjectsSettings[projName]?.confOverride) {
        conf = { ...conf, ...appProjectsSettings[projName].confOverride };
      }

      if (options.confOverrides) {
        const overrideKey = Object.keys(options.confOverrides).find(
          (v) => projName === v && v,
        );

        const overrideConf =
          overrideKey && options.confOverrides[overrideKey]
            ? options.confOverrides[overrideKey]
            : {};

        conf = { ...conf, ...overrideConf };
      }

      projects.push(conf);
    }
  }

  const projectSets: { [key: string]: any } = createProjectSets(projects);

  // use argv to catch the path argument in any position
  const argv: any = yargs(process.argv.slice(2))
    .command('$0 [paths]', 'test paths', (yargs) => {
      return yargs
        .positional('path', {
          describe: 'test path',
          type: 'string',
          coerce: (arg: string): string[] => {
            return arg.split(',');
          },
        })
        .option('proj', {
          describe: 'comma-separated project names',
          type: 'string',
          coerce: (arg: string): string[] => {
            return arg.split(',');
          },
        })
        .option('paths', {
          describe: 'comma-separated test paths',
          type: 'string',
          coerce: (arg: string): string[] => {
            return arg.split(',');
          },
        });
    })
    .showHelpOnFail(false)
    // .options(jestOptionObject)
    .fail(() => {
      // nothing to do
    }).argv;

  const selectedProj =
    argv.proj || process.env.npm_config_projects?.split(',') || 'all';

  projects = Array.isArray(selectedProj)
    ? Object.values(projectSets)
        .flat()
        .filter((value) => {
          return selectedProj.some((projName) => {
            return value.displayName === `unit/${projName}`;
          });
        })
    : projectSets[selectedProj];

  const paths = [];

  if (argv.path) {
    paths.push(argv.path);
  }

  if (argv.paths) {
    paths.push(...argv.paths);
  }

  const possiblePath =
    (paths.length > 0 ? paths : null) ??
    argv.testPathPattern?.[0] ??
    argv.coverage ??
    '';

  // eslint-disable-next-line no-console
  console.debug('possiblePaths', possiblePath);

  let config: any = {};

  function getSubprojectPath(testPath: string) {
    // "." must be converted to "/"
    let subProjectPath = testPath.startsWith('.')
      ? testPath.slice(1)
      : testPath;
    subProjectPath = subProjectPath.startsWith(rootPath)
      ? subProjectPath.slice(rootPath.length)
      : subProjectPath;
    // we always need "/" at the beginning of the string
    subProjectPath = subProjectPath.startsWith('/')
      ? subProjectPath
      : `/${subProjectPath}`;

    // get the project which prefix is closest to testPath
    // to apply the correct path for coverage etc.
    for (const proj of Object.values(projectList)) {
      const root: string = proj.path;
      if (testPath.startsWith(root) && subProjectPath.length < root.length) {
        subProjectPath = `/${root}`;
      }
    }

    const lastIndexOfSrc = subProjectPath.lastIndexOf(`/src/`);
    if (lastIndexOfSrc >= 0)
      subProjectPath = subProjectPath.substring(0, lastIndexOfSrc);

    return subProjectPath;
  }

  let selectedProjects: any[] = [];
  if (possiblePath === true) {
    if (Array.isArray(selectedProj)) {
      selectedProjects.push(
        ...projects.filter((p: any) =>
          selectedProj.some((projName) =>
            p.displayName.startsWith(`unit/${projName}`),
          ),
        ),
      );
    } else {
      selectedProjects = projects;
    }
  } else {
    const testPaths: string[] = Array.isArray(possiblePath)
      ? possiblePath
      : [possiblePath];

    // eslint-disable-next-line no-console
    console.debug('testPaths', testPaths);
    const subProjectPathList = testPaths.map((v) => getSubprojectPath(v));

    selectedProjects = projects.filter((v: any) =>
      subProjectPathList.some((subProjectPath) =>
        v.rootDir.startsWith(`${rootPath}${subProjectPath}`),
      ),
    );

    if (Array.isArray(selectedProj)) {
      selectedProjects.push(
        ...projects.filter((p: any) =>
          selectedProj.some((projName) =>
            p.displayName.startsWith(`unit/${projName}`),
          ),
        ),
      );
    }

    // eslint-disable-next-line no-console
    console.debug('Subproject path:', subProjectPathList ?? ['']);
  }

  // eslint-disable-next-line no-console
  console.debug(
    'selectedProjects',
    selectedProjects.map((v: any) => v.displayName),
  );

  // we can still support specific coverage output path when only one project is selected
  const coverageFolder = selectedProjects.length > 1 ? '' : selectedProj;

  config = {
    coverageReporters: ['json-summary', 'json', 'lcov', 'text', 'clover'],
    rootDir: `${rootPath}`,
    coverageThreshold: coverageThreshold(
      selectedProjects,
      options.defaultCoverageThreshold,
    ),
    coverageDirectory: path.join(
      rootPath,
      options.coverageOutputPath?.(coverageFolder) ??
        `var/coverage/${coverageFolder}`,
    ),
    collectCoverageFrom: [
      `**/*.{js,ts}`,
      '!**/node_modules/**',
      '!**/.warmup/**',
    ],
  };

  config.projects = selectedProjects;

  return config;
}

export interface E2EOptions {
  alias?: string;
  e2eDirname: string;
  rootDirname: string;
  defaultConfOptions?: IDefaultConfOptions;
  confOverride?: JestConfigWithTsJest;
  withGqlPlugins?: boolean;
  tsJestConfig?: any;
}

export const createE2EConfig = (options: E2EOptions): JestConfigWithTsJest => {
  let conf: JestConfigWithTsJest = {
    ...defaultConf(
      `${options.rootDirname}`,
      options.defaultConfOptions,
      tsJestConfigE2E(
        path.resolve(`${options.e2eDirname}/tsconfig.json`),
        options.withGqlPlugins ?? false,
        options.tsJestConfig,
      ),
    ),
    testRegex: '.*\\.e2e-spec\\.ts$',
    setupFilesAfterEnv: [`${options.e2eDirname}/jest.e2e-setup.ts`],
    roots: [`${options.e2eDirname}`],
    bail: 1,
  };

  if (options.alias) {
    conf.displayName = `e2e/${options.alias}`;
    // conf.name = `e2e/${options.alias}`;
  }

  if (options.confOverride) {
    conf = {
      ...conf,
      ...options.confOverride,
    };
  }

  return conf;
};
