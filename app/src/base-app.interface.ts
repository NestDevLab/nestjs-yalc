import { EventModule } from '@nestjs-yalc/event-manager/event.module.js';
import { LoggerServiceFactory } from '@nestjs-yalc/logger/index.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { DynamicModule, ModuleMetadata } from '@nestjs/common';
import {
  ConfigFactory,
  ConfigObject,
  ConfigFactoryKeyHost,
} from '@nestjs/config';

export interface ISingletonOption {
  /**
   * This is used to make sure that the module is not instantiated multiple times
   * This is useful when you have a dynamic module that is imported in multiple other modules
   * If you use static modules, this is not needed. Please use it with caution because it might
   * cause unexpected behavior
   *
   * NOTE: should be used in conjunction with the `global` property
   */
  isSingleton?: boolean;
}

export interface ISingletonDynamicModule
  extends ISingletonOption, DynamicModule {}

export interface IYalcBaseAppOptions extends Partial<ISingletonDynamicModule> {
  configFactory?: ConfigFactory<ConfigObject>;
  extraConfigs?: (ConfigFactory<ConfigObject> &
    ConfigFactoryKeyHost<ReturnType<ConfigFactory<ConfigObject>>>)[];
  envPath?: string | string[];
  /**
   * When envPath is not defined, this will be used to find the env file
   */
  envDir?: string;
  migrations?: ClassType[];
  skipDuplicateAppCheck?: boolean;
  logger?: boolean | typeof LoggerServiceFactory;
  eventModuleClass?: typeof EventModule;
}

export type BaseAppStaticOptions = Omit<IYalcBaseAppOptions, 'module'>;

export interface IYalcBaseDynamicModule extends ISingletonDynamicModule {
  imports: NonNullable<DynamicModule['imports']>;
  exports: NonNullable<DynamicModule['exports']>;
  controllers: NonNullable<DynamicModule['controllers']>;
  providers: NonNullable<DynamicModule['providers']>;
}

export interface IYalcBaseStaticModule extends ModuleMetadata {
  imports: NonNullable<DynamicModule['imports']>;
  exports: NonNullable<DynamicModule['exports']>;
  controllers: NonNullable<DynamicModule['controllers']>;
  providers: NonNullable<DynamicModule['providers']>;
}
