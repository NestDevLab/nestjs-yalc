import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { DynamicModule, Type } from '@nestjs/common';
import { StandaloneAppBootstrap } from './app-bootstrap-standalone.helper.js';
import { curry } from 'lodash-es';
import {
  BaseAppBootstrap,
  IGlobalOptions,
} from './app-bootstrap-base.helper.js';

export function isDynamicModule(module: any): module is DynamicModule {
  return module.module !== undefined;
}

export const executeFunctionForApp = async (
  app: BaseAppBootstrap<any>,
  serviceType: any,
  fn: { (service: any): Promise<any> },
  options: { closeApp?: boolean },
): Promise<void> => {
  const nestApp = await app.getApp();
  await nestApp.init();

  const service = await nestApp.resolve(serviceType);

  await fn(service).finally(async () => {
    if (options.closeApp) await app.closeApp();
  });
};

/**
 * Curried version of the executeStandaloneFunctionForApp to memoize the app
 * Use it when you need to run the executeStandaloneFunction multiple time
 * @see https://lodash.com/docs/#curry
 * @param module
 * @returns
 */
export const curriedExecuteStandaloneFunction = async <
  TOptions extends IGlobalOptions,
>(
  module: any,
  options?: TOptions,
) =>
  curry(executeFunctionForApp)(
    await new StandaloneAppBootstrap(
      isDynamicModule(module) ? module.module.name : module.name,
      module,
      options,
    ).initApp(),
  );

/**
 *
 * @param module
 * @param serviceType
 * @param fn
 * @returns
 */
export const executeStandaloneFunction = async <
  TService,
  TOptions extends IGlobalOptions,
>(
  module: DynamicModule | Type<any>,
  serviceType: ClassType<TService>,
  fn: { (service: TService): Promise<any> },
  options?: TOptions,
  executeOptions: { closeApp?: boolean } = {},
) => {
  return (await curriedExecuteStandaloneFunction(module, options))(
    serviceType,
    fn,
    executeOptions,
  );
};
