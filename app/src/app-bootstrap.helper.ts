import { SystemExceptionFilter } from '@nestjs-yalc/errors/filters/index.js';
import {
  BadRequestException,
  ExceptionFilter,
  NestApplicationOptions,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// import { GqlExceptionFilter } from '@nestjs/graphql';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { fastify, FastifyInstance } from 'fastify';
import { envIsTrue } from '@nestjs-yalc/utils/env.helper.js';
import { useContainer } from 'class-validator';
import clc from 'cli-color';
import {
  BaseAppBootstrap,
  IGlobalOptions,
} from './app-bootstrap-base.helper.js';
import { getEnvLoggerLevels } from '@nestjs-yalc/logger/logger.helper.js';
import { UnwrapResultInterceptor } from './unwrap-result.interceptor.js';

export interface ICreateOptions {
  enableSwagger?: boolean;
  /**
   * Path segment (without leading slash) where Swagger UI/JSON is exposed.
   * Defaults to "api".
   */
  swaggerPath?: string;
  filters?: ExceptionFilter[];
  validationPipeOptions?: ValidationPipeOptions;
  /**
   * On some cases we do want to manually override the apiPrefix of the service conf
   */
  apiPrefix?: string;
}

export interface INestCreateOptions
  extends ICreateOptions, NestApplicationOptions {}

export class AppBootstrap<
  TGlobalOptions extends IGlobalOptions = IGlobalOptions,
> extends BaseAppBootstrap<NestFastifyApplication> {
  private fastifyInstance?: FastifyInstance;
  protected isSwaggerEnabled: boolean = false;
  protected swaggerPath = 'api';

  constructor(appAlias: string, module: any, options?: TGlobalOptions) {
    super(appAlias, module, { globalsOptions: options });
  }

  async startServer(options?: {
    createOptions?: INestCreateOptions;
    fastifyInstance?: FastifyInstance;
  }) {
    await this.initApp(options);

    if (envIsTrue(process.env.APP_DRY_RUN) === true) {
      await this.closeApp();
      process.exit(0);
    }

    // no need to wait here
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.listen();

    return this;
  }

  async initApp(options?: {
    createOptions?: INestCreateOptions;
    fastifyInstance?: FastifyInstance;
  }) {
    await this.createApp({
      fastifyInstance: this.fastifyInstance,
      createOptions: options?.createOptions,
    });

    return this.initSetup({
      fastifyInstance: this.fastifyInstance,
      createOptions: options?.createOptions,
    });
  }

  async initSetup(options?: {
    createOptions?: ICreateOptions;
    fastifyInstance?: FastifyInstance;
  }) {
    try {
      await this.applyBootstrapGlobals(options?.createOptions);

      await this.getApp().init();
    } catch (err) {
      this.closeCleanup();
      throw new Error('Process aborted');
    }

    if (envIsTrue(process.env.APP_DRY_RUN) === true) {
      this.loggerService?.log('Dry run, exiting...');
      await this.closeApp();
      process.exit(0);
    }

    return this;
  }

  async createApp(options?: {
    createOptions?: INestCreateOptions;
    fastifyInstance?: FastifyInstance;
  }) {
    this.fastifyInstance = options?.fastifyInstance ?? fastify();

    let app;
    try {
      app = await NestFactory.create<NestFastifyApplication>(
        this.module,
        new FastifyAdapter(this.fastifyInstance as any),
        {
          bufferLogs: false,
          abortOnError: options?.createOptions?.abortOnError ?? false,
          logger: getEnvLoggerLevels(),
          ...(options?.createOptions ?? {}),
        },
      );
    } catch (err) {
      this.closeCleanup();
      // eslint-disable-next-line no-console
      console.error(clc.red('Failed to create app'), clc.red(err));
      throw new Error('Process aborted');
    }

    return this.setApp(app);
  }

  getFastifyInstance() {
    return this.fastifyInstance;
  }

  setSwaggerEnabled(enabled: boolean) {
    this.isSwaggerEnabled = enabled;
  }

  async applyBootstrapGlobals(options?: ICreateOptions) {
    await super.applyBootstrapGlobals(options);

    this.getApp().useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        validateCustomDecorators: true,
        exceptionFactory: (errors) => {
          const errorMessages: { [key: string]: any } = {};
          errors.forEach((error) => {
            errorMessages[error.property] = error;
          });
          return new BadRequestException(errorMessages);
        },
        ...(options?.validationPipeOptions ?? {}),
      }),
    );

    this.getApp().setGlobalPrefix(
      options?.apiPrefix ?? (this.getConf()?.apiPrefix || ''),
    );

    await this.getApp().register(fastifyCookie as any, {});

    this.getApp().useGlobalInterceptors(new UnwrapResultInterceptor());

    /**
     * @todo refactor using a factory function to share with all services
     */
    const filters = [
      new SystemExceptionFilter(this.loggerService),
      ...(options?.filters ?? []),
    ];
    this.getApp().useGlobalFilters(...filters);

    if (options?.enableSwagger) {
      const swaggerPath = sanitizeSwaggerPath(options.swaggerPath);
      this.swaggerPath = swaggerPath;
      this.setSwaggerEnabled(true);
      const document = SwaggerModule.createDocument(
        this.getApp(),
        this.buildSwaggerConfig().build(),
      );
      SwaggerModule.setup(swaggerPath, this.getApp(), document, {
        jsonDocumentUrl: `/${swaggerPath}/json`,
        useGlobalPrefix: true,
      });
    }

    useContainer(this.getApp().select(this.getModule()), {
      fallbackOnErrors: true,
    });

    return this;
  }

  buildSwaggerConfig() {
    return new DocumentBuilder()
      .setTitle(this.appAlias)
      .setDescription(`${this.appAlias} rest api`);
  }

  async listen(callback?: {
    (port: number, host: string, domain: string): void;
  }) {
    const port = this.getConf()?.port || 0;
    const host = this.getConf()?.host || '0.0.0.0';
    let apiPrefix = this.getConf()?.apiPrefix;
    apiPrefix = apiPrefix ? `/${apiPrefix}` : '';
    const domain = this.getConf()?.domain || 'localhost';
    await this.getApp().listen(port, host, async (_err, address) => {
      // eslint-disable-next-line no-console
      console.debug(`Server ${this.appAlias} listening on
        http://localhost:${port}${apiPrefix}/
        http://127.0.0.1:${port}${apiPrefix}/
        http://${domain}:${port}${apiPrefix}/
        ${address}`);

      // // eslint-disable-next-line no-console
      // console.debug(`GraphQL ${this.appAlias} listening on
      //   http://localhost:${port}${apiPrefix}/graphql
      //   http://127.0.0.1:${port}${apiPrefix}/graphql
      //   http://${domain}:${port}${apiPrefix}/graphql`);

      if (this.isSwaggerEnabled) {
        // eslint-disable-next-line no-console
        console.debug(`Swagger ${this.appAlias} listening on
        http://localhost:${port}${apiPrefix}/${this.swaggerPath}
        http://127.0.0.1:${port}${apiPrefix}/${this.swaggerPath}
        http://${domain}:${port}${apiPrefix}/${this.swaggerPath}
        ${address}/${this.swaggerPath}
        JSON: http://localhost:${port}${apiPrefix}/${this.swaggerPath}/json`);
      }

      callback?.(port, host, domain);
    });

    /**
     * Hot reload @see https://docs.nestjs.com/recipes/hot-reload#hot-module-replacement-1
     */
    const hmr = typeof module !== 'undefined' ? (module as any).hot : undefined;
    if (hmr) {
      // eslint-disable-next-line no-console
      console.debug('Hot reload enabled. Reloading...');
      hmr.accept();
      hmr.dispose(() => this.closeApp());
    }
  }
}

function sanitizeSwaggerPath(path?: string): string {
  const normalized = (path ?? 'api').replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized || 'api';
}
