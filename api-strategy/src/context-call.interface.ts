export interface IObjectWithData<TData> {
  data?: TData;
}

/**
 * @template TData - type of data to be sent to the server (body data in case of http)
 * @template TParams - type of parameters to be sent to the server (query params in case of http)
 */
export interface ICallOptions<
  TData,
  TParams extends Record<string, any>,
> extends IObjectWithData<TData> {
  data?: TData;
  parameters?: TParams;
}

export interface IApiCallStrategy {
  /**
   * @template TOptData - type of data to be sent to the server (body data in case of http)
   * @template TParams - type of parameters to be sent to the server (query params in case of http)
   * @template TResData - type of data to be received from the server (response data in case of http)
   */
  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>>;
  /**
   * alias for call that retrieves data without side effects (read-only)
   *
   * @template TOptData - type of data to be sent to the server (body data in case of http)
   * @template TParams - type of parameters to be sent to the server (query params in case of http)
   * @template TResData - type of data to be received from the server (response data in case of http)
   */
  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>>;
  /**
   * alias for call that retrieves data with side effects (creation of a resource, etc.)
   *
   * @template TOptData - type of data to be sent to the server (body data in case of http)
   * @template TParams - type of parameters to be sent to the server (query params in case of http)
   * @template TResData - type of data to be received from the server (response data in case of http)
   */
  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: ICallOptions<TOptData, TParams>,
  ): Promise<IObjectWithData<TResData>>;
}
