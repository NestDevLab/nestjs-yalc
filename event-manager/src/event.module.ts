import { DynamicModule, LogLevel, Module, Provider } from '@nestjs/common';
import { YalcEventService, IEventServiceOptions } from './event.service.js';
import { ImprovedLoggerService } from '@nestjs-yalc/logger/logger-abstract.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppLoggerFactory } from '@nestjs-yalc/logger/logger.factory.js';
import { EventNameFormatter } from './emitter.js';
import { isProviderObject } from '@nestjs-yalc/utils/nestjs/nest.helper.js';

export const EVENT_LOGGER = 'EVENT_LOGGER';
export const EVENT_EMITTER = 'EVENT_EMITTER';

function isImprovedLoggerService(
  loggerProvider?:
    | ImprovedLoggerService
    | ILoggerProviderOptionsObject
    | string,
): loggerProvider is ImprovedLoggerService {
  return (
    loggerProvider !== undefined &&
    typeof loggerProvider === 'object' &&
    'isImprovedLoggerService' in loggerProvider &&
    loggerProvider.isImprovedLoggerService === true
  );
}

export type ILoggerProviderOptions = Parameters<typeof AppLoggerFactory>;

export type ILoggerProviderOptionsObject = {
  context: ILoggerProviderOptions[0];
  loggerLevels?: ILoggerProviderOptions[1];
  loggerType?: ILoggerProviderOptions[2];
  options?: ILoggerProviderOptions[3];
};

export interface IEventModuleOptions<
  TFormatter extends EventNameFormatter = EventNameFormatter,
> extends IEventServiceOptions<TFormatter> {
  loggerProvider?:
    | ImprovedLoggerService
    | ILoggerProviderOptionsObject
    | Provider<ImprovedLoggerService>
    | string;
  eventEmitter?: Provider<EventEmitter2>;
  eventService?: (
    logger: ImprovedLoggerService,
    emitter: EventEmitter2,
    options?: IEventModuleOptions<TFormatter>,
  ) => YalcEventService;
  eventServiceToken?: string;
  imports?: any[];
  overrideLoggerLevels?: LogLevel[];
}

export const OPTION_PROVIDER = 'OPTION_PROVIDER';

export interface IProviderOptions {
  logger: ImprovedLoggerService | ILoggerProviderOptionsObject;
  emitter: EventEmitter2;
}

@Module({})
export class EventModule {
  static forRootAsync<
    TFormatter extends EventNameFormatter = EventNameFormatter,
  >(
    options?: IEventModuleOptions<TFormatter>,
    optionProvider?: Provider<IProviderOptions>,
  ): DynamicModule {
    const loggerProviderName =
      typeof options?.loggerProvider === 'string'
        ? options.loggerProvider
        : options && isProviderObject(options.loggerProvider)
          ? (options.loggerProvider as any).provide
          : EVENT_LOGGER;
    const emitterProviderName =
      options && isProviderObject(options.eventEmitter)
        ? (options.eventEmitter as any).provide
        : EventEmitter2;

    const eventProviderName = options?.eventServiceToken ?? YalcEventService;

    const imports: any[] = options?.imports ?? [];
    const providers: Provider[] = [
      {
        provide: eventProviderName,
        useFactory: (logger: ImprovedLoggerService, emitter: EventEmitter2) => {
          return (
            options?.eventService?.(logger, emitter, options) ??
            new YalcEventService(logger, emitter, options)
          );
        },
        inject: [loggerProviderName, emitterProviderName],
      },
    ];

    const loggerProvider = options?.loggerProvider;
    if (isProviderObject(loggerProvider)) {
      providers.push(loggerProvider);
    } else {
      providers.push({
        provide: loggerProviderName,
        useFactory: (providedOptions?: IProviderOptions) => {
          const _options = providedOptions?.logger ?? loggerProvider;

          if (isImprovedLoggerService(_options)) {
            return _options;
          } else {
            const defaultArgs: ILoggerProviderOptionsObject = {
              context: 'default',
            };
            const args =
              _options && typeof _options !== 'string' ? _options : defaultArgs;

            return AppLoggerFactory(
              args.context,
              args.loggerLevels,
              args.loggerType,
              args.options,
            );
          }
        },
        inject: [{ token: OPTION_PROVIDER, optional: true }],
      });
    }

    if (options?.eventEmitter) {
      providers.push(options.eventEmitter);
    }

    if (optionProvider) {
      providers.push(optionProvider);
    }

    return {
      module: EventModule,
      providers,
      imports,
      exports: [loggerProviderName, eventProviderName],
    };
  }
}
