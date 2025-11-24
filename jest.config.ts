import {
  IAppProjSetting,
  IOptions,
  IProjectInfo,
  jestConfGenerator,
} from './jest/src/config';
import path from 'node:path';

console.log('=================== LOADING JEST OPTIONS ================');

import tsProjects from './tsconfig.json';

const appProjectsSettings: { [key: string]: IAppProjSetting } = {};

const projectList: { [key: string]: IProjectInfo } = {};

const paths: Record<string, string[]> = tsProjects.compilerOptions.paths;
Object.keys(paths).map((k: string) => {
  const pathValue: string = paths[k][0];
  const cleaned = pathValue.replace(/^\.\//, '');
  const dir = path.dirname(cleaned);
  const basePath = dir.endsWith('/src') ? dir.replace('/src', '') : dir;
  const sourcePath = cleaned
    .replace(/\/index\.ts$/, '')
    .replace(/\/index\.d\.ts$/, '');

  if (!k.endsWith('*')) {
    projectList[k] = {
      path: basePath,
      sourcePath,
      type: 'library',
    };
  }
});

const options: IOptions = {
  defaultConfOptions: {
    transformEsModules: false,
    jestConf: {
      // injectGlobals: false, -> we can't set it to false because of this issue: https://github.com/golevelup/nestjs/issues/557
    },
  },
  // TODO: re-enable everything except types
  skipProjects: ['types', 'types-extends', 'graphql', 'kafka', 'jest'],
  defaultCoverageThreshold: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100,
  },
  confOverrides: {
    '@nestjs-yalc/app': {
      coverageThreshold: {
        statements: 60.76,
        branches: 52.08,
        functions: 52.94,
        lines: 60.55,
      },
    },
    '@nestjs-yalc/logger': {
      coverageThreshold: {
        statements: 98.02,
        branches: 94.4,
        functions: 83.87,
        lines: 88.7,
      },
    },
    '@nestjs-yalc/utils': {
      coverageThreshold: {
        statements: 93.44,
        branches: 92.85,
        functions: 87.17,
        lines: 93.83,
      },
    },
    '@nestjs-yalc/database': {
      coverageThreshold: {
        statements: 98,
        branches: 95,
        functions: 98,
        lines: 98,
      },
    },
    '@nestjs-yalc/data-loader': {
      coverageThreshold: {
        statements: 98,
        branches: 95,
        functions: 98,
        lines: 98,
      },
    },
    '@nestjs-yalc/errors': {
      coverageThreshold: {
        statements: 98,
        branches: 95,
        functions: 98,
        lines: 98,
      },
    },
    '@nestjs-yalc/event-manager': {
      coverageThreshold: {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    },
    '@nestjs-yalc/crud-gen': {
      coverageThreshold: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    '@nestjs-yalc/skeleton-module': {
      coverageThreshold: {
        statements: 80,
        branches: 70,
        functions: 40,
        lines: 75,
      },
    },
  },
};

const conf = jestConfGenerator(
  __dirname,
  projectList,
  appProjectsSettings,
  options,
);

conf.injectGlobals = true;

export default conf;
