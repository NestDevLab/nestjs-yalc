import { type ImprovedLoggerService } from '@nestjs-yalc/logger/logger-abstract.service.js';
import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { type IYalcBaseAppOptions } from './base-app.interface.js';
import {
  APP_LOGGER_SERVICE,
  MODULE_ALIAS_TOKEN,
  MODULE_OPTION_TOKEN,
} from './def.const.js';
import { AppContextService } from './app-context.service.js';

/**
 * This class is used to handle the lifecycle of the app
 * and apply some common logic and checks to all apps
 */
@Injectable()
export class LifeCycleHandler implements OnModuleDestroy, OnModuleInit {
  /**
   * We do this in the constructor since onModuleInit doesn't seem to be called
   * when we use 'useFactory' to create the provider
   * @todo: investigate why onModuleInit is not called
   *
   */
  constructor(
    @Inject(APP_LOGGER_SERVICE) private readonly logger: ImprovedLoggerService,
    @Inject(MODULE_ALIAS_TOKEN) private readonly moduleAlias: string,
    @Inject(AppContextService)
    private readonly appContextService: AppContextService,
    @Inject(MODULE_OPTION_TOKEN)
    private readonly options?: IYalcBaseAppOptions,
  ) {
    this.logger.debug?.(
      `====================== Init ${this.moduleAlias} ======================`,
    );
    if (
      this.options?.skipDuplicateAppCheck !== true &&
      this.appContextService.initializedApps.has(this.moduleAlias)
    ) {
      throw new Error(
        `Cannot initialize the same app (${this.moduleAlias}) twice`,
      );
    }
    this.appContextService.initializedApps.add(this.moduleAlias);
  }

  onModuleInit() {}

  onModuleDestroy() {
    this.logger.debug?.(
      `====================== Close ${this.moduleAlias} ======================`,
    );
    this.appContextService.initializedApps.delete(this.moduleAlias);
  }
}
