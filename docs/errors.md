# DefaultError Class

This library provides an enhanced Error class that extends the built-in Error functionality with features like an internal message (that can be used for logging but not returned back to the user in an API context),
logging of the error at the moment it's thrown, event triggering for application reactivity during error occurrences,
and defining a data object that can be logged with the message and masked.
This mixin approach retains the original error class, allowing compatibility with NestJS exception filters and differentiation of errors by type.

In a NestJS application, this library is typically used together with `YalcEventService` from `@nestjs-yalc/event-manager` so that a single call can:

- log the error at an appropriate level derived from the HTTP status,
- emit a structured event payload,
- and propagate an `HttpException`-compatible error that carries both the HTTP status code and a safe response body for the client.

For a full, end-to-end overview see the [Error handling guide](./error-handling.md). It is also useful to read the [Event](./event-manager-event.md) and [Logger](./logger.md) documentation to understand how these two components work since they are used in the errors library.

## Constants

- `ON_DEFAULT_ERROR_EVENT`: The event name for default errors.

## Interfaces

The module exports two interfaces:

- `IAbstractDefaultError`: Extends the `HttpException` class with additional properties `data` and `internalMessage`.

- `IDefaultErrorOptions`: Specifies options for the default error class. It includes the following properties:

  - `data`: An optional property that can be of any type. This property is used to specify additional data related to the error that will be logged but not thrown back to the user.
  - `masks`: An optional array of strings. These strings represent keys in the data object that should be masked in the logs for privacy or security reasons.
  - `logger`: This property can either be an instance of the `ImprovedLoggerService` or a boolean. If set to true, the default logger (console) is used. If an instance of `ImprovedLoggerService` is provided, it will be used for logging.
  - `response`: An optional string or object that represents a message that will can be safely sent to the client.
  - `eventEmitter`: This can be an instance of either `EventEmitter2` or `EventEmitter`. It will be used to emit an event when an error occurs.

## Methods

- `newDefaultError`: A convenience function that creates a new `DefaultError` class instance extending the provided base class. It takes three parameters: a base class, options, and additional arguments.
- `DefaultErrorMixin`: A function that returns a class extending from the provided base class (or the `Error` class if no base class is provided), with the `IAbstractDefaultError` interface. This class can accept options and parameters in its constructor, handles logging, and emits an event on error occurrence.

## Types

- `DefaultErrorMixin`: A type alias for the `Mixin` of the `DefaultErrorMixin` function.

## Classes

`DefaultError`: An exported class that extends the `DefaultErrorMixin` class and provides a constructor with optional parameters for a message and options for both the extended `DefaultError` and the base error class. It exposes an `IBetterResponseInterface` through `getResponse()`, which is suitable to be returned to HTTP clients.

## Usage

```typescript
// Using IDefaultErrorOptions
const options: IDefaultErrorOptions = {
  data: { username: 'john', password: 'password' },
  masks: ['password'],
  logger: true,
  response: 'Something happened',
  eventEmitter: myEventEmitter,
};
```

### Scenario #1 DefaultError class - When you just need to throw a simple Error, but with steroid

Using DefaultError class, this will throw an error based on the native Error class
but with the additional features of the DefaultError class. You can also consider to extend this
class to create your custom one, if you want your class to use the `Error` class as a base (child of Error).

```typescript
throw new DefaultError('Something went wrong', options);
```

### Scenario #2. newDefaultError function - When you want to throw a different error type but wrapped by the DefaultError functionalities

This allows us to choose the base class for the error, in this case UnauthorizedException

```typescript
throw newDefaultError(UnauthorizedException, options, 'Login failed');
```

### Scenario #3. DefaultErrorMixin function - When you want full control over your implementation

This allows us to create a custom error class that is a mixin of the DefaultError class
and extends the UnauthorizedException class. You can use this class to implement your own logic
around the error handling, for example, to add additional properties or methods.

```typescript
class MyCustomError extends DefaultErrorMixin(UnauthorizedException) {
  constructor(message: string, options?: IDefaultErrorOptions) {
    super(options ?? {}, message);
  }
}

throw new MyCustomError('Login failed', options);
```

## Specialized classes

The library also provides specialized classes that extend the `DefaultError` class and provide additional functionality. They also include HTTP codes to facilitate semantic error handling for HTTP requests. Some of these classes are:

- `BadRequestError`: This class extends the `DefaultError` class and provides a constructor with optional parameters for a message and options for both the extended `BadRequestError` and the base error class. It also provides a static method `throw` that throws a `BadRequestError` with the provided message and options.

- `UnauthorizedError`: This class extends the `DefaultError` class and provides a constructor with optional parameters for a message and options for both the extended `UnauthorizedError` and the base error class. It also provides a static method `throw` that throws an `UnauthorizedError` with the provided message and options.

- `ForbiddenError`: This class extends the `DefaultError` class and provides a constructor with optional parameters for a message and options for both the extended `ForbiddenError` and the base error class. It also provides a static method `throw` that throws a `ForbiddenError` with the provided message and options.

- `LoginError`: This class extends the `DefaultError` class and provides a constructor with optional parameters for a message and options for both the extended `LoginError` and the base error class. It also provides a static method `throw` that throws a `LoginError` with the provided message and options. This is a custom class that uses the status code 401 just like the `UnauthorizedError` class, but it is used to indicate that the user is not logged in.

check the `error.class.ts` file for more details
