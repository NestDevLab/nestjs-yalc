# @nestjs-yalc/app

Application bootstrap helpers and base NestJS module utilities for YALC apps.

Use this package when an application wants shared configuration loading,
application-scoped logger and event providers, CLS wiring, lifecycle handling,
Swagger setup, and consistent bootstrap behavior.

## Installation

```bash
npm install @nestjs-yalc/app
```

Install the NestJS peer packages used by your application, such as
`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, and the selected HTTP
platform package.

## Import Surface

The package ships helpers through subpath exports. Import the specific helper
module you need, for example `@nestjs-yalc/app/app-bootstrap.helper.js`.

- `AppBootstrap` and `StandaloneAppBootstrap` for HTTP and standalone Nest app
  startup.
- `YalcBaseAppModule` and `YalcDefaultAppModule` for reusable base module
  composition.
- `AppDependencyFactory` for assembling common app imports and providers.
- `AppConfigService`, `createAppConfigProvider`, and token helpers for
  application-scoped configuration.
- `YalcClsModule`, `YalcAlsService`, and `YalcGlobalClsService` for context
  storage.
- `UnwrapResultInterceptor` for unwrapping `neverthrow` Result values.

## Example

```ts
import { AppBootstrap } from '@nestjs-yalc/app/app-bootstrap.helper.js';
import { AppModule } from './app.module.js';

await new AppBootstrap(AppModule).bootstrap();
```

## Documentation

- Integration guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/how-to-integrate-nestjs-yalc.md
- Backend blueprint:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/backend-blueprint.md
