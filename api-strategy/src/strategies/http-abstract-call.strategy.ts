import { HTTPMethods } from '@nestjs-yalc/types/globals.d.js';
import { OutgoingHttpHeaders, IncomingHttpHeaders } from 'node:http2';
import { IApiCallStrategy } from '../context-call.interface.js';

/**
 * Configuration options for HTTP call strategies
 */
export interface IHttpCallStrategyOptions {
  /**
   * List of header names that should be forwarded from the original request context.
   * Only headers matching these names will be included in outgoing requests.
   * @example ['authorization', 'x-tenant-id', 'content-type']
   */
  headersWhitelist?: string[];
  /**
   * Optional function to determine if JSON parsing should be skipped for a response body.
   * Useful for handling non-JSON responses or streaming data.
   * @param body - The raw response body as a string
   * @returns `true` to skip parsing and return the raw body, `false` to parse as JSON
   * @example (body) => body.startsWith('<html>')
   */
  shouldSkipJsonParse?: (body: string) => boolean;
}

/**
 * HTTP request options compliant with all HTTP-based call strategies.
 * This interface provides a unified way to configure HTTP requests across different transport mechanisms.
 * @template TData - The type of data being sent in the request body (e.g., object, string, Buffer, stream)
 * @template TParams - The shape of URL query parameters as a key-value record
 * @example
 * ```typescript
 * // For a POST request with JSON body
 * const options: HttpOptions<{ userId: number }, { includeDetails: string }> = {
 *   method: 'POST',
 *   data: { userId: 123 },
 *   parameters: { includeDetails: 'true' }
 * };
 * ```
 */
export interface HttpOptions<
  TData = string | object | Buffer | NodeJS.ReadableStream,
  TParams extends Record<string, any> = Record<string, any>,
> {
  /** HTTP headers to include in the request */
  headers?: IncomingHttpHeaders | Record<string, string>;
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method?: HTTPMethods;
  /** AbortSignal for cancelling the request */
  signal?: AbortSignal;
  /** Additional request configuration (implementation-specific) */
  Request?: object;
  /** Request payload/body data */
  data?: TData;
  /** URL query parameters as key-value pairs */
  parameters?: TParams;
}

/**
 * Standard HTTP response structure returned by all HTTP call strategies.
 * @template T - The type of the parsed response data
 * @example
 * ```typescript
 * // For an API returning user data
 * const response: IHttpCallStrategyResponse<{ id: number; name: string }> = await strategy.get('/users/1');
 * console.log(response.data.name); // TypeScript knows data has 'name' property
 * ```
 */
export interface IHttpCallStrategyResponse<T = any> {
  /** The parsed response body */
  data: T;
  /** HTTP status code (e.g., 200, 404, 500) */
  status: number;
  /** HTTP status text (e.g., "OK", "Not Found") */
  statusText: string;
  /** Response headers from the server */
  headers: OutgoingHttpHeaders;
  /** Raw request object (implementation-specific) */
  request?: any;
}

/**
 * Interface defining the contract for HTTP-based API call strategies.
 * Implementations must provide methods for making HTTP requests with type-safe request/response handling.
 */
export interface IHttpCallStrategy extends IApiCallStrategy {
  /**
   * Execute an HTTP request with full control over method, data, and parameters.
   * @template TOptData - The type of request body data (default: string | object | Buffer | stream)
   * @template TParams - The shape of URL query parameters (default: Record<string, any>)
   * @template TResData - The expected type of the response body after parsing
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration including method, headers, data, and parameters
   * @returns Promise resolving to the HTTP response with typed data
   * @example
   * ```typescript
   * // POST request with typed request/response
   * interface CreateUserDto { name: string; email: string; }
   * interface UserResponse { id: number; name: string; email: string; }
   *
   * const response = await strategy.call<CreateUserDto, {}, UserResponse>('/users', {
   *   method: 'POST',
   *   data: { name: 'John', email: 'john@example.com' }
   * });
   * console.log(response.data.id); // TypeScript knows this is a number
   * ```
   */
  call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>>;
  /**
   * Execute an HTTP GET request.
   * @template TOptData - The type of request body data (typically unused for GET)
   * @template TParams - The shape of URL query parameters
   * @template TResData - The expected type of the response body
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration (excluding method, which is fixed to GET)
   * @returns Promise resolving to the HTTP response with typed data
   * @example
   * ```typescript
   * // GET request with query parameters
   * interface UserListResponse { users: Array<{ id: number; name: string }>; total: number; }
   *
   * const response = await strategy.get<never, { page: string; limit: string }, UserListResponse>(
   *   '/users',
   *   { parameters: { page: '1', limit: '10' } }
   * );
   * console.log(response.data.total);
   * ```
   */
  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>>;
  /**
   * Execute an HTTP POST request.
   * @template TOptData - The type of request body data to send
   * @template TParams - The shape of URL query parameters
   * @template TResData - The expected type of the response body
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration (excluding method, which is fixed to POST)
   * @returns Promise resolving to the HTTP response with typed data
   * @example
   * ```typescript
   * // POST request with body and query parameters
   * interface CreateOrderDto { productId: number; quantity: number; }
   * interface OrderResponse { orderId: string; total: number; }
   *
   * const response = await strategy.post<CreateOrderDto, { notify: string }, OrderResponse>(
   *   '/orders',
   *   {
   *     data: { productId: 42, quantity: 2 },
   *     parameters: { notify: 'true' }
   *   }
   * );
   * console.log(response.data.orderId);
   * ```
   */
  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>>;
}

/**
 * Abstract base class for HTTP-based API call strategies.
 * Provides convenience methods (get, post) that delegate to the abstract `call` method.
 * Concrete implementations must implement the `call` method for their specific transport mechanism
 * (e.g., Axios, Fastify inject, native fetch).
 * @example
 * ```typescript
 * class MyHttpStrategy extends HttpAbstractStrategy {
 *   async call<TOptData, TParams extends Record<string, any>, TResData>(
 *     path: string,
 *     options?: HttpOptions<TOptData, TParams>
 *   ): Promise<IHttpCallStrategyResponse<TResData>> {
 *     // Implementation using your HTTP client
 *     const response = await myHttpClient.request({ url: path, ...options });
 *     return { data: response.body, status: response.statusCode, ... };
 *   }
 * }
 * ```
 */
export abstract class HttpAbstractStrategy implements IHttpCallStrategy {
  /**
   * Abstract method to execute an HTTP request. Must be implemented by concrete strategy classes.
   * @template TOptData - The type of request body data being sent
   * @template TParams - The shape of URL query parameters
   * @template TResData - The expected type of the response body
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration including method, headers, data, and parameters
   * @returns Promise resolving to the HTTP response with typed data
   */
  abstract call<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>>;

  /**
   * Convenience method to execute an HTTP GET request.
   * Delegates to `call()` with method set to 'GET'.
   * @template TOptData - The type of request body data (typically unused for GET)
   * @template TParams - The shape of URL query parameters
   * @template TResData - The expected type of the response body
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration (method will be overridden to GET)
   * @returns Promise resolving to the HTTP response with typed data
   */
  get<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>> {
    return this.call<TOptData, TParams, TResData>(path, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * Convenience method to execute an HTTP POST request.
   * Delegates to `call()` with method set to 'POST'.
   * @template TOptData - The type of request body data to send
   * @template TParams - The shape of URL query parameters
   * @template TResData - The expected type of the response body
   * @param path - The URL path or full URL to request
   * @param options - HTTP request configuration (method will be overridden to POST)
   * @returns Promise resolving to the HTTP response with typed data
   */
  post<TOptData, TParams extends Record<string, any>, TResData>(
    path: string,
    options?: HttpOptions<TOptData, TParams> | { method?: string },
  ): Promise<IHttpCallStrategyResponse<TResData>> {
    return this.call<TOptData, TParams, TResData>(path, {
      ...options,
      method: 'POST',
    });
  }
}
