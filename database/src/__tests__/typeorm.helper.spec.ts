import { expect, jest, describe, it } from '@jest/globals';
import { TypeORMLogger } from '@nestjs-yalc/logger/typeorm-logger.js';
import {
  setGlobalMigrationClasses,
  yalcTypeOrmPostgresOptions,
} from '../typeorm.helpers.js';

describe('setGlobalMigrationClasses', () => {
  it('should set global migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }];

    setGlobalMigrationClasses(connName, classes);

    expect(global.TypeORM_Migration_classes[connName]).toEqual(classes);
  });
});

describe('getGlobalMigrationClasses', () => {
  it('should get global migration classes', () => {
    const connName = 'testConnection';
    const classes = [{ name: 'testClass' }];
    global.TypeORM_Migration_classes = { [connName]: classes };

    expect(getGlobalMigrationClasses(connName)).toEqual(classes);
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
