import { expect, jest, describe, it } from '@jest/globals';
import { TypeORMLogger } from '@nestjs-yalc/logger/typeorm-logger.js';
import {
  setGlobalPreDeployMigrationClasses,
  yalcTypeOrmPostgresOptions,
  getGlobalPostDeployMigrationClasses,
  setGlobalMigrationClasses,
  getGlobalPreDeployMigrationClasses,
  getGlobalMigrationClasses,
  setGlobalPostDeployMigrationClasses,
} from '../typeorm.helpers.ts';
import { ClassType } from '@nestjs-yalc/types/index.js';
import { MigrationInterface } from 'typeorm';

describe('setGlobalPreDeployMigrationClasses', () => {
  it('should set global migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }] as ClassType<MigrationInterface>[];

    setGlobalPreDeployMigrationClasses(connName, classes as ClassType<MigrationInterface>[]);

    expect(global.TypeORM_Migration_classes?.[connName]).toEqual(classes);
  });
});

describe('setGlobalPostDeployMigrationClasses', () => {
  it('should set global post-deploy migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }] as ClassType<MigrationInterface>[];

    setGlobalPostDeployMigrationClasses(connName, classes as ClassType<MigrationInterface>[]);

    expect(global.TypeORM_PostDeploy_Migration_classes?.[connName]).toEqual(classes);
  });
});

describe('setGlobalMigrationClasses', () => {
  it('should set global pre-deploy and post-deploy migration classes', () => {
    const connName = 'testConnection';
    const preDeployClasses = [{ name: 'testClassPre' }] as ClassType<MigrationInterface>[];
    const postDeployClasses = [{ name: 'testClassPost' }] as ClassType<MigrationInterface>[];

    setGlobalMigrationClasses(connName, preDeployClasses, postDeployClasses);

    expect(global.TypeORM_Migration_classes?.[connName]).toEqual(preDeployClasses);
    expect(global.TypeORM_PostDeploy_Migration_classes?.[connName]).toEqual(postDeployClasses);
  });

  it('should set global pre-deploy and post-deploy migration classes', () => {
    const connName = 'testConnection';
    const preDeployClasses = [{ name: 'testClassPre' }] as ClassType<MigrationInterface>[];
    const postDeployClasses = [{ name: 'testClassPost' }] as ClassType<MigrationInterface>[];
    global.TypeORM_Migration_classes = undefined;
    global.TypeORM_PostDeploy_Migration_classes = undefined;

    setGlobalMigrationClasses(connName, preDeployClasses, postDeployClasses);

    expect(global.TypeORM_Migration_classes?.[connName]).toEqual(preDeployClasses);
    expect(global.TypeORM_PostDeploy_Migration_classes?.[connName]).toEqual(postDeployClasses);
  });
});

describe('getGlobalPreDeployMigrationClasses', () => {
  it('should get global migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }] as ClassType<MigrationInterface>[];
    global.TypeORM_Migration_classes = { [connName]: classes };

    expect(getGlobalPreDeployMigrationClasses(connName)).toEqual(classes);
  });

  it('should get global migration classes', () => {
    const connName = 'testConnection';
    global.TypeORM_Migration_classes = undefined;

    expect(getGlobalPreDeployMigrationClasses(connName)).toEqual([]);
  });
});

describe('getGlobalMigrationClasses', () => {
  it('should merge pre and post deploy classes', () => {
    const connName = 'testConnection';
    const pre = [{ name: 'pre' }] as ClassType<MigrationInterface>[];
    const post = [{ name: 'post' }] as ClassType<MigrationInterface>[];
    global.TypeORM_Migration_classes = { [connName]: pre };
    global.TypeORM_PostDeploy_Migration_classes = { [connName]: post };

    expect(getGlobalMigrationClasses(connName)).toEqual([...pre, ...post]);
  });

  it('should return empty array when none set', () => {
    const connName = 'testConnection';
    global.TypeORM_Migration_classes = undefined;
    global.TypeORM_PostDeploy_Migration_classes = undefined;

    expect(getGlobalMigrationClasses(connName)).toEqual([]);
  });
});

describe('getGlobalPostDeployMigrationClasses', () => {
  it('should get global post-deploy migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }] as ClassType<MigrationInterface>[];
    global.TypeORM_PostDeploy_Migration_classes = { [connName]: classes };

    expect(getGlobalPostDeployMigrationClasses(connName)).toEqual(classes);
  });

  it('should get global post-deploy migration classes', () => {
    const connName = 'testConnection';
    global.TypeORM_PostDeploy_Migration_classes = undefined;

    expect(getGlobalPostDeployMigrationClasses(connName)).toEqual([]);
  });
});

jest.mock('@nestjs-yalc/logger');

describe('yalcTypeOrmPostgresOptions', () => {
  it('should return TypeOrmModuleOptions with appOptions', () => {
    const name = 'testName';
    const postgresConf = { host: 'localhost' };
    const eventService = jest.fn();
    const eventEmitter = jest.fn();
    const appOptions = { migrations: ['migration1'] };

    const result = yalcTypeOrmPostgresOptions(
      name,
      postgresConf,
      eventService,
      appOptions,
    );

    expect(result).toEqual({
      name,
      type: 'postgres',
      logger: new TypeORMLogger(eventService),
      migrations: appOptions.migrations,
      ...postgresConf,
    });
  });

  it('should return TypeOrmModuleOptions without appOptions', () => {
    const name = 'testName';
    const postgresConf = { host: 'localhost' };
    const eventService = jest.fn();

    const result = yalcTypeOrmPostgresOptions(name, postgresConf, eventService);

    expect(result).toEqual({
      name,
      type: 'postgres',
      logger: new TypeORMLogger(eventService),
      migrations: global.TypeORM_Migration_classes?.[name],
      ...postgresConf,
    });
  });
});
