import {
  IApiCallStrategy,
  ICallOptions,
  IObjectWithData,
} from '../context-call.interface.js';

export type ShadowCallStrategyErrorMode = 'throw' | 'ignore';

export interface ShadowCallStrategyOptions {
  awaitShadows?: boolean;
  shadowErrorMode?: ShadowCallStrategyErrorMode;
}

export class ShadowCallStrategy implements IApiCallStrategy {
  private readonly awaitShadows: boolean;
  private readonly shadowErrorMode: ShadowCallStrategyErrorMode;

  constructor(
    private readonly primary: IApiCallStrategy,
    private readonly shadows: IApiCallStrategy[],
    options: ShadowCallStrategyOptions = {},
  ) {
    if (shadows.length === 0) {
      throw new Error(
        'ShadowCallStrategy requires at least one shadow strategy.',
      );
    }

    this.shadowErrorMode = options.shadowErrorMode ?? 'ignore';
    this.awaitShadows =
      options.awaitShadows ?? this.shadowErrorMode === 'throw';
  }

  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute(
      (strategy) => strategy.call(path, options),
      (strategy) => strategy.call(path, options),
    );
  }

  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute(
      (strategy) => strategy.get(path, options),
      (strategy) => strategy.get(path, options),
    );
  }

  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.execute(
      (strategy) => strategy.post(path, options),
      (strategy) => strategy.post(path, options),
    );
  }

  private async execute<TResData>(
    primaryCall: (
      strategy: IApiCallStrategy,
    ) => Promise<IObjectWithData<TResData>>,
    shadowCall: (strategy: IApiCallStrategy) => Promise<IObjectWithData<any>>,
  ) {
    const primaryResult = await primaryCall(this.primary);
    const shadowExecution = Promise.all(
      this.shadows.map((strategy) => shadowCall(strategy)),
    );

    if (this.awaitShadows) {
      if (this.shadowErrorMode === 'throw') {
        await shadowExecution;
      } else {
        await shadowExecution.catch(() => undefined);
      }
    } else {
      void shadowExecution.catch(() => undefined);
    }

    return primaryResult;
  }
}
