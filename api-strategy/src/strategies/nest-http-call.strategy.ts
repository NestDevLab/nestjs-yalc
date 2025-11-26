import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { HttpService } from '@nestjs/axios';
import {
  HttpAbstractStrategy,
  IHttpCallStrategyResponse,
  HttpOptions,
  IHttpCallStrategyOptions,
} from './http-abstract-call.strategy.js';
import { AxiosRequestConfig } from 'axios';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { filterHeaders } from '../header-whitelist.helper.js';

export type NestHttpCallStrategyOptions = IHttpCallStrategyOptions & {
  internalRequestHeader?: string;
  internalRequestToken?: string;
};

export class NestHttpCallStrategy extends HttpAbstractStrategy {
  private readonly internalHeader: string;
  private readonly internalToken?: string;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly clsService: YalcGlobalClsService,
    private baseUrl = '',
    protected readonly options: NestHttpCallStrategyOptions = {},
  ) {
    super();
    this.internalHeader = options.internalRequestHeader ?? 'x-internal-request-token';
    this.internalToken = options.internalRequestToken;
  }

  async call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams>,
  ): Promise<IHttpCallStrategyResponse<TResData>> {
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
     * implement the mapping from HttpOptions to AxiosRequestConfig
     */
    const _options:
      | {
          [k: string | number | symbol]: never;
        }
      | AxiosRequestConfig = {
      headers,
      method: options?.method,
      signal: options?.signal,
      data: options?.data,
    };

    if (options?.parameters) {
      _options.params = new URLSearchParams(options.parameters);
    }

    const { data, ...res } = await this.httpService.axiosRef.request({
      headers: _options?.headers as any,
      method: _options?.method,
      signal: _options?.signal,
      data: _options?.data,
      params: _options?.params,
      url: `${this.baseUrl}${path}`,
    });

    return {
      ...res,
      data,
    };
  }
}

export interface NestHttpCallStrategyProviderOptions {
  baseUrl?: string;
  NestHttpStrategy?: ClassType<NestHttpCallStrategy>;
  headersWhitelist?: string[];
  internalRequestHeader?: string;
  internalRequestToken?: string;
}

/**
 * Just a convenient provider to inject the NestLocalCallStrategy
 */
export const NestHttpCallStrategyProvider = (
  provide: string,
  options: NestHttpCallStrategyProviderOptions = {},
) => ({
  provide,
  useFactory: (httpAdapter: HttpService, clsService: YalcGlobalClsService) => {
    const _options = {
      baseUrl: '',
      NestHttpStrategy: NestHttpCallStrategy,
      ...options,
    };

    return new _options.NestHttpStrategy(
      httpAdapter,
      clsService,
      _options.baseUrl,
      _options,
    );
  },
  inject: [HttpService, YalcGlobalClsService],
});
