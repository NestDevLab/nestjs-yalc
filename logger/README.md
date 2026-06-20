# @nestjs-yalc/logger

Logger providers and logger service implementations for NestJS-YALC
applications.

Use this package to create Nest-compatible loggers with environment-driven log
levels, structured event integration, masking helpers, Pino support, and TypeORM
logger adapters.

## Installation

```bash
npm install @nestjs-yalc/logger
```

## Main Exports

- `LoggerServiceFactory` and `AppLoggerFactory` for Nest provider creation.
- `ImprovedLoggerService` interfaces and abstract service types.
- `ImprovedNestLogger`, `ConsoleLogger`, and `PinoLogger` implementations.
- `TypeORMLogger` for TypeORM integration.
- `maskDataInObject` and environment log-level helpers.
- `LogLevelEnum`, `LoggerTypeEnum`, and logger event enums.

## Example

```ts
import { LoggerServiceFactory } from '@nestjs-yalc/logger';

export const AppLoggerProvider = LoggerServiceFactory(
  'app',
  'APP_LOGGER_SERVICE',
  'App',
);
```

## Documentation

- Logger guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/logger.md
