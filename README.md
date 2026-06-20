# @nestjs-yalc/framework

NestJS-YALC is a collection of NestJS packages for generated CRUD APIs,
transport strategies, structured events, errors, logging, and operational
helpers.

The framework package re-exports the runtime packages that make up the public
YALC surface. Install a focused package when you only need one area, or install
`@nestjs-yalc/framework` when an application wants the aggregate entry point.

## Installation

```bash
npm install @nestjs-yalc/framework
```

Most applications also install the NestJS, TypeORM, GraphQL, or OpenTelemetry
peer packages required by the specific YALC modules they use.

## Package Areas

- `@nestjs-yalc/app`: application bootstrap and base module helpers.
- `@nestjs-yalc/crud-gen`: generated REST, GraphQL, service, repository, and
  dataloader surfaces.
- `@nestjs-yalc/api-strategy`: local, HTTP, event, fallback, shadow, and
  conditional transport strategies.
- `@nestjs-yalc/event-manager`: structured events, logs, and HTTP-aware error
  helpers.
- `@nestjs-yalc/errors`: typed error classes and Result helpers.
- `@nestjs-yalc/logger`: Nest, console, Pino, and TypeORM logger helpers.
- `@nestjs-yalc/observability`: OpenTelemetry integration for YALC event flows.

## Documentation

- Documentation index:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/documentation.md
- Getting started:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/getting-started.md
- Public npm publication:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/npm-publication.md
