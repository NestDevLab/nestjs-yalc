/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerService, LogLevel } from '@nestjs/common';
import { LogLevelEnum } from './logger.enum.js';
import { type EventEmitter2 } from '@nestjs/event-emitter';
import { event } from '@nestjs-yalc/event-manager/event.js';
import {
  PluginSystem,
  WithPluginSystem,
} from '@nestjs-yalc/utils/plugin.helper.js';
import { YalcGlobalClsService } from '../../app/src/cls.module.js';

export interface LogMethodOptions {
  message?: any;
  /**
   * The data is the place where you want to add the extra information
   * that are not returned back as a response but they can be sent to the logger or the event emitter.
   */
  data?: any;
  /**
   * This can be used to log the configuration values of the event.
   * This might be helpful to filter the logs based on extra configuration values
   * that are not the basic error level, statusCode etc.
   */
  config?: any;
  masks?: string[];
  context?: string;
  stack?: string;
  /**
   * If false, it will not trigger an event.
   * If string, it will trigger an event with the string as the event name instead of the default event name.
   */
  event?: string | false;
}

export type LogMethod = (message: any, options?: LogMethodOptions) => void;
export type LogMethodError = (
  message: any,
  stack?: string,
  options?: LogMethodOptions,
) => void;

export interface ILoggerPluginMethods<TClsService = any> extends Record<
  string,
  { (...args: any[]): void } | undefined
> {
  onBeforeLogging?: (
    message: any,
    options: LogMethodOptions,
    clsService: TClsService,
  ) => void;
}

export interface ImprovedLoggerService
  extends ImprovedLoggerServiceMethods, PluginSystem<ILoggerPluginMethods> {}

export interface ImprovedLoggerServiceMethods extends LoggerService {
  log: LogMethod;
  error: LogMethodError;
  warn: LogMethod;
  debug?: LogMethod | undefined;
  verbose?: LogMethod;
}

export const EVENT_LOG_DEFAULT = 'EVENT_LOG_DEFAULT';

export interface IImprovedLoggerOptions {
  event?:
    | {
        eventEmitter?: EventEmitter2 | false;
        /**
         * if set to true, it trigger an event with the name of EVENT_LOG_DEFAULT even
         * if we didn't specified the event name
         */
        useFallbackEvent?: boolean;
      }
    | false;
  clsService?: YalcGlobalClsService;
  overrideLoggerLevels?: LogLevel[];
}

export abstract class LoggerAbstractService
  extends WithPluginSystem<ILoggerPluginMethods>()
  implements ImprovedLoggerService
{
  public readonly isImprovedLoggerService = true;

  /**
   * This constructor override its empty method based on passed
   * logLevels and this.methods
   *
   * @param logLevels
   * @param this.methods
   */
  constructor(
    protected context: string,
    protected logLevels: LogLevel[] | undefined,
    protected methods: ImprovedLoggerServiceMethods,
    protected options: IImprovedLoggerOptions = {},
  ) {
    super();

    this.initializeLogger();
  }

  setLogLevels(levels: LogLevel[]) {
    this.logLevels = levels;
    this.initializeLogger();
  }

  initializeLogger() {
    const enabledLevels: { [key: string]: boolean } = {};
    this.logLevels?.forEach((level) => {
      if (!(level.toUpperCase() in LogLevelEnum))
        throw new Error(`ERROR: Logger Level: ${level} is not supported!`);

      enabledLevels[level] = true;
    });

    this.log = (message: any, options: LogMethodOptions = {}) => {
      void this.beforeLogging(message, options);
      (enabledLevels[LogLevelEnum.LOG] === true &&
        this.methods[LogLevelEnum.LOG]
        ? this.methods[LogLevelEnum.LOG]
        : () => {})(message, options);
    };

    this.error = (
      message: any,
      stack?: string,
      options: LogMethodOptions = {},
    ) => {
      options.stack = stack;
      void this.beforeLogging(message, options);

      (enabledLevels[LogLevelEnum.ERROR] === true &&
        this.methods[LogLevelEnum.ERROR]
        ? this.methods[LogLevelEnum.ERROR]
        : () => {})(message, stack, options);
    };

    this.warn = (message: any, options: LogMethodOptions = {}) => {
      void this.beforeLogging(message, options);

      (enabledLevels[LogLevelEnum.WARN] === true &&
        this.methods[LogLevelEnum.WARN]
        ? this.methods[LogLevelEnum.WARN]
        : () => {})(message, options);
    };

    if (
      enabledLevels[LogLevelEnum.DEBUG] === true &&
      this.methods[LogLevelEnum.DEBUG]
    )
      this.debug = (message: any, options: LogMethodOptions = {}) => {
        void this.beforeLogging(message, options);
        this.methods[LogLevelEnum.DEBUG]!(message, options);
      };

    if (
      enabledLevels[LogLevelEnum.VERBOSE] === true &&
      this.methods[LogLevelEnum.VERBOSE]
    )
      this.verbose = (message: any, options: LogMethodOptions = {}) => {
        void this.beforeLogging(message, options);
        this.methods[LogLevelEnum.VERBOSE]!(message, options);
      };
  }

  log!: LogMethod;
  error!: LogMethodError;
  warn!: LogMethod;
  debug?: LogMethod | undefined;
  verbose?: LogMethod;

  beforeLogging(message: any, options: LogMethodOptions) {
    this.options.event = this.options.event ?? {};
    this.invokePlugins(
      'onBeforeLogging',
      message,
      options,
      this.options.clsService,
    );
    return beforeLogging(message, options);
  }
}

export async function beforeLogging(
  message: any,
  options: LogMethodOptions & IImprovedLoggerOptions['event'] = {},
) {
  const emitter = options && options.eventEmitter;
  if (!emitter) return;

  const useFallbackEvent = (options && options.useFallbackEvent) ?? false;
  const defaultEventName = useFallbackEvent ? EVENT_LOG_DEFAULT : false;
  const eventName = options.event ?? defaultEventName;

  if (!eventName) return;

  await event(eventName, {
    event: { emitter },
    data: options?.data,
    masks: options?.masks,
    message,
    logger: false,
    stack: options?.stack,
  });
}
