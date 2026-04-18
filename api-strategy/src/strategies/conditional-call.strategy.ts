import {
  IApiCallStrategy,
  ICallOptions,
  IObjectWithData,
} from '../context-call.interface.js';

export interface ConditionalCallStrategyOptions {
  enabled?: boolean | (() => boolean);
  disabledResponse?: IObjectWithData<any>;
  disabledError?: Error | (() => Error);
}

export class ConditionalCallStrategy implements IApiCallStrategy {
  constructor(
    private readonly strategy: IApiCallStrategy,
    private readonly options: ConditionalCallStrategyOptions = {},
  ) {}

  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.whenEnabled(() => this.strategy.call(path, options));
  }

  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.whenEnabled(() => this.strategy.get(path, options));
  }

  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>> {
    return this.whenEnabled(() => this.strategy.post(path, options));
  }

  private async whenEnabled<TResData>(
    execute: () => Promise<IObjectWithData<TResData>>,
  ) {
    if (this.isEnabled()) {
      return execute();
    }

    if (this.options.disabledResponse) {
      return this.options.disabledResponse as IObjectWithData<TResData>;
    }

    throw this.resolveDisabledError();
  }

  private isEnabled() {
    return typeof this.options.enabled === 'function'
      ? this.options.enabled()
      : this.options.enabled !== false;
  }

  private resolveDisabledError() {
    if (typeof this.options.disabledError === 'function') {
      return this.options.disabledError();
    }

    return (
      this.options.disabledError ??
      new Error('ConditionalCallStrategy is disabled.')
    );
  }
}
