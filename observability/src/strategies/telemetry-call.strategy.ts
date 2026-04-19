import type {
  IApiCallStrategy,
  ICallOptions,
  IObjectWithData,
} from '@nestjs-yalc/api-strategy/context-call.interface.js';
import { TelemetryService } from '../telemetry.service.js';

export interface TelemetryCallStrategyOptions {
  name: string;
  transport?: string;
}

export class TelemetryCallStrategy implements IApiCallStrategy {
  constructor(
    private readonly strategy: IApiCallStrategy,
    private readonly telemetry: TelemetryService,
    private readonly options: TelemetryCallStrategyOptions,
  ) {}

  get baseUrl() {
    return (this.strategy as { baseUrl?: string }).baseUrl;
  }

  set baseUrl(value: string | undefined) {
    (this.strategy as { baseUrl?: string }).baseUrl = value;
  }

  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.measure('call', path, () => this.strategy.call(path, options));
  }

  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.measure('get', path, () => this.strategy.get(path, options));
  }

  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.measure('post', path, () => this.strategy.post(path, options));
  }

  private measure<T>(
    operation: string,
    path: string,
    callback: () => Promise<IObjectWithData<T>>,
  ) {
    return this.telemetry.measure(
      `api-strategy.${this.options.name}.${operation}`,
      callback,
      {
        'yalc.strategy.kind': 'call',
        'yalc.strategy.name': this.options.name,
        'yalc.strategy.transport': this.options.transport,
        'yalc.strategy.operation': operation,
        'yalc.strategy.path': path,
      },
    ) as Promise<IObjectWithData<T>>;
  }
}
