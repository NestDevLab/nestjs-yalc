import {
  IApiCallStrategy,
  ICallOptions,
  IObjectWithData,
} from '../context-call.interface.js';

export interface FallbackCallStrategyOptions {
  shouldFallback?: (error: unknown, strategyIndex: number) => boolean;
}

export class FallbackCallStrategy implements IApiCallStrategy {
  constructor(
    private readonly strategies: IApiCallStrategy[],
    private readonly options: FallbackCallStrategyOptions = {},
  ) {
    if (strategies.length === 0) {
      throw new Error('FallbackCallStrategy requires at least one strategy.');
    }
  }

  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute((strategy) => strategy.call(path, options));
  }

  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute((strategy) => strategy.get(path, options));
  }

  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute((strategy) => strategy.post(path, options));
  }

  private async execute<TResData>(
    callStrategy: (
      strategy: IApiCallStrategy,
    ) => Promise<IObjectWithData<TResData>>,
  ) {
    let lastError: unknown;

    for (const [index, strategy] of this.strategies.entries()) {
      try {
        return await callStrategy(strategy);
      } catch (error) {
        lastError = error;

        if (!this.shouldFallback(error, index)) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private shouldFallback(error: unknown, strategyIndex: number) {
    return this.options.shouldFallback?.(error, strategyIndex) ?? true;
  }
}
