# @nestjs-yalc/api-strategy

Transport strategy helpers for keeping application code stable while the
underlying call path changes.

Use this package to code against HTTP call or event interfaces while selecting
local Nest calls, remote HTTP calls, emitted events, fallback chains, shadow
calls, or conditional strategies through providers.

## Installation

```bash
npm install @nestjs-yalc/api-strategy
```

## Main Exports

- `NestLocalCallStrategy` for in-process Nest/Fastify calls.
- `NestHttpCallStrategy` and `HttpAbstractCallStrategy` for remote HTTP calls.
- `NestLocalEventStrategy` and `RabbitMqEventStrategy` for event emission.
- `FallbackCallStrategy`, `ShadowCallStrategy`, and conditional/composite
  strategies for staged migrations and resilience.
- `ContextCallServiceFactory`, `ContextEventServiceFactory`, and strategy
  selector providers for Nest DI wiring.

## Example

```ts
import { NestHttpCallStrategy } from '@nestjs-yalc/api-strategy';

const usersApi = new NestHttpCallStrategy(httpService, UserDto, baseUrl);
const users = await usersApi.get('/users');
```

## Documentation

- API Strategy guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/api-strategy.md
- API Strategy and EventManager patterns:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/api-strategy-event-manager-patterns.md
