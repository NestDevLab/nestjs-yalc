import { HttpAdapterHost } from '@nestjs/core';
import {
  HttpAbstractStrategy,
  HttpOptions,
  IHttpCallStrategyOptions,
  IHttpCallStrategyResponse,
} from './http-abstract-call.strategy.js';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { InjectOptions } from 'fastify';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { filterHeaders } from '../header-whitelist.helper.js';
import { AppConfigService } from '@nestjs-yalc/app/app-config.service.js';
import { MAIN_APP_CONFIG_SERVICE } from '@nestjs-yalc/app/def.const.js';

export type NestLocalCallStrategyOptions = IHttpCallStrategyOptions & {
  internalRequestHeader?: string;
  internalRequestToken?: string;
};

export class NestLocalCallStrategy extends HttpAbstractStrategy {
  private readonly internalHeader: string;
  private readonly internalToken?: string;

  constructor(
    protected readonly adapterHost: HttpAdapterHost,
    protected readonly clsService: YalcGlobalClsService,
    protected readonly configService: AppConfigService,
    private baseUrl = '',
    protected readonly options: NestLocalCallStrategyOptions = {},
  ) {
    super();
    this.internalHeader = options.internalRequestHeader ?? 'x-internal-request-token';
    this.internalToken =
      options.internalRequestToken ?? (configService as any)?.values?.internalRequestToken;
  }

  async call<
    TOptData extends string | object | Buffer | NodeJS.ReadableStream,
    TParams extends Record<string, any>,
    TResData,
  >(
    path: string,
    options?: HttpOptions<TOptData, TParams>,
  ): Promise<IHttpCallStrategyResponse<TResData>> {
    const instance: FastifyAdapter = this.adapterHost.httpAdapter.getInstance();
    const clsHeaders = filterHeaders(this.clsService.get('headers'), this.options.headersWhitelist);
    const headers: Record<string, any> = {
      ...clsHeaders,
      ...(options?.headers ?? {}),
    };
    if (this.internalHeader && this.internalToken && !headers[this.internalHeader]) {
      headers[this.internalHeader] = this.internalToken;
    }
    /**
     * We need this to do a type check on the options and
     * implement the mapping from HttpOptions to InjectOptions;
     */
    const _options:
      | {
          [k: string | number | symbol]: never;
        }
      | InjectOptions = {
      headers,
      method: options?.method,
      /**@todo investigate where to set thi */
      // signal: options?.signal,
      payload: options?.data, // map data to payload
    };

    const args: InjectOptions = {
      ..._options,
      url: `${this.baseUrl}${path}`,
    };

    if (options?.parameters) {
      args.query = Object.fromEntries(new URLSearchParams(options.parameters));
    }

    const result = await instance.inject(args);

    let data;
    try {
      if (
        this.options.shouldSkipJsonParse &&
        this.options.shouldSkipJsonParse(result.body)
      ) {
        data = result.body;
      } else {
        data = result.json();
      }
    } catch (_e) {
      //The content-type of the response is not application/json
      // if so, we use the body instead
      data = result.body;
    }

    return {
      data,
      headers: result.headers,
      status: result.statusCode,
      statusText: result.statusMessage,
      request: result.payload, // TODO: double check if it's the correct value
    };
  }
}

export interface NestLocalCallStrategyProviderOptions {
  baseUrl?: string;
  NestLocalStrategy?: ClassType<NestLocalCallStrategy>;
  headersWhitelist?: string[];
  internalRequestHeader?: string;
  internalRequestToken?: string;
}

/**
 * Just a convenient provider to inject the NestLocalCallStrategy
 */
export const NestLocalCallStrategyProvider = (
  provide: string,
  options: NestLocalCallStrategyProviderOptions = {},
) => ({
  provide,
  useFactory: (
    httpAdapter: HttpAdapterHost,
    clsService: YalcGlobalClsService,
    configService: AppConfigService,
  ) => {
    const _options = {
      baseUrl: '',
      NestLocalStrategy: NestLocalCallStrategy,
      ...options,
    };

    return new _options.NestLocalStrategy(
      httpAdapter,
      clsService,
      configService,
      _options.baseUrl,
      _options,
    );
  },
  inject: [HttpAdapterHost, YalcGlobalClsService, MAIN_APP_CONFIG_SERVICE],
});
