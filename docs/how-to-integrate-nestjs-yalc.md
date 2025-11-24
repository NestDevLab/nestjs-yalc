# Building a modular Nest platform with `nestjs-yalc`

This guide shows how to structure a Nest monorepo that uses `nestjs-yalc` to ship a modular monolith that can later split into microservices. It walks through layout, dependencies, bootstrap, API strategies, config, and a repeatable recipe for new domains.

## Modular monolith in this context
- Each domain (e.g. “account”, “payments”) is:
  - a Nest application (`apps/<domain>`) with its own config, entrypoint, and runtime; and
  - a Nest module and client library in `libs/` that expose its API to other domains.
- All domains can be hosted inside a single “aggregator” app for development and e2e testing.
- Communication between domains is always done through `nestjs-yalc` strategies (local calls/events), never via direct cross-domain provider injection.
- Later, any domain can be split into a standalone microservice by changing the strategy (e.g. from local to HTTP) and re-pointing base URLs, without rewriting business logic.

## What `nestjs-yalc` gives you
- Base app bootstrap with config, logger, event bus, CLS, lifecycle guards.
- Strategy-driven service-to-service calls (local HTTP injection, HTTP/axios, or custom transports).
- Event manager with shared tokens and listeners.
- Utilities for errors, database helpers, data loaders, GraphQL CRUD generation, and Jest config generation.

## Repository layout
- `apps/` — deployable applications (one per bounded context). Each has `src/main.ts` that boots the module via a bootstrap helper (e.g., `AppBootstrap` or your thin wrapper).
- `libs/` — shareable code: domain libraries, client SDKs (`client-*`), cross-cutting helpers.
- `deps/nestjs-yalc/` — vendored `nestjs-yalc` sources; consumed as `file:` dependencies to pin versions and avoid network fetches.
- `utils/` — CI/build/test helpers (scripts, tsconfig references).
- Root configs — `nest-cli.json` (project map), `tsconfig*.json`, `webpack.config.cjs`, `jest.config.ts`.
- `examples/` — optional reference apps/modules. In this repo:
  - `examples/skeleton-module` is a GraphQL-only module showing CRUD-Gen patterns in isolation.
  - `examples/skeleton-app` is a small, in-memory SQLite app that wires `SkeletonModule` into REST + GraphQL, EventManager, Logger, ApiStrategy and validation; you can copy/extend it as a clean starting point for your own services.

## Dependency wiring
- `package.json`: reference `@nestjs-yalc/*` with `file:deps/nestjs-yalc/...` to lock the toolchain.
- Example:
  ```jsonc
  {
    "dependencies": {
      "@nestjs-yalc/app": "file:deps/nestjs-yalc/app",
      "@nestjs-yalc/api-strategy": "file:deps/nestjs-yalc/api-strategy",
      "@nestjs-yalc/database": "file:deps/nestjs-yalc/database",
      "@nestjs-yalc/logger": "file:deps/nestjs-yalc/logger",
      "@nestjs-yalc/utils": "file:deps/nestjs-yalc/utils"
    },
    "devDependencies": {
      "@nestjs-yalc/jest": "file:deps/nestjs-yalc/jest"
    }
  }
  ```
- `tsconfig.json`: add `deps/nestjs-yalc/types` and `types-extends` to `typeRoots` so editors resolve types across apps/libs.
- Example:
  ```jsonc
  {
    "compilerOptions": {
      "typeRoots": [
        "./node_modules/@types",
        "./deps/nestjs-yalc/types",
        "./deps/nestjs-yalc/types-extends"
      ]
    }
  }
  ```
- `webpack.config.cjs`: allowlist `@nestjs-yalc` in externals and add `deps/nestjs-yalc/node_modules` to `additionalModuleDirs` so bundling works with vendored packages.
- Example snippet:
  ```js
  config.externals = [
    nodeExternals({
      allowlist: [/^@nestjs-yalc(.*)/],
      additionalModuleDirs: [
        path.resolve(__dirname, 'deps/nestjs-yalc/node_modules'),
        path.resolve(__dirname, 'node_modules')
      ]
    }),
  ];
  ```
- `utils/tsconfig.ref.json`: include the YALC tsconfig as a project reference when you need full type-checks.
- Example:
  ```jsonc
  {
    "references": [
      { "path": "../deps/nestjs-yalc/tsconfig.json" },
      { "path": "../tsconfig.json" }
    ]
  }
  ```

## Bootstrap pattern
- **Base module**: a project-defined `BaseAppModule` wrapper around `YalcBaseAppModule` (nestjs-yalc does not ship this class) standardizes:
  - Env resolution (`.env`, `.env.<NODE_ENV>`, `.env.remote`, `.env.dist`).
  - Config providers via `getAppConfigToken`, logger/event tokens per app, CLS, and global interceptors.
  - Shared imports: CLS (`YalcClsModule`), `EventModule`, HTTP/audit/log interceptors, XRay (optional), reference manager (optional).
- Skeleton:
  ```ts
  @Global()
  @Module(
    baseAppModuleMetadata(MyAppModule, APP_ALIAS_MY_APP, {
      configFactory: MyConfigFactory,
      isSingleton: true,
      providers: [
        // custom interceptors or services
      ],
    }),
  )
  export class MyAppModule extends BaseAppModule {}
  ```
- **Bootstrap helpers**: `AppBootstrap` / `StandaloneAppBootstrap` from `@nestjs-yalc/app`:
  - Start Fastify, register HTTP filters, ValidationPipe, Swagger config, and emit lifecycle events.
  - Offer `startServer()` plus curried helpers to execute functions inside an initialized Nest app (useful for handlers/CLI tasks).
- Entry point:
  ```ts
  import { AppBootstrap } from '@nestjs-yalc/app/app-bootstrap.helper.js';

  async function main() {
    await new AppBootstrap(APP_ALIAS_MY_APP, MyAppModule).startServer({
      createOptions: { rawBody: true }, // optional
    });
  }
  main();
  ```

## API strategy (service-to-service)
Use `@nestjs-yalc/api-strategy` to swap transport without touching domain logic.

- **Local HTTP (in-process)**: create a thin subclass of `NestLocalCallStrategy` to inject internal headers/user context, then register it.
  ```ts
  export class ProjectLocalCallStrategy extends NestLocalCallStrategy {
    constructor(host: HttpAdapterHost, cls: YalcGlobalClsService, cfg: AppConfigService) {
      super(host, cls, cfg, '', { headersWhitelist: ['x-user-id'] });
    }
    post(...args) {
      // add custom headers or tracing here
      return super.post(...args);
    }
  }

  // Register a local caller inside a module
  providers: [
    NestLocalCallStrategyProvider(MY_SERVICE_CALLER, {
      NestLocalStrategy: ProjectLocalCallStrategy,
      baseUrl: MY_BASE_URL, // e.g. '/v2/account'
    }),
  ];
  ```
  Client example:
  ```ts
  @Injectable()
  export class ClientAccountService extends BaseApiService {
    constructor(
      @Inject(APP_EVENT_SERVICE) event: EventService,
      @Inject(MY_SERVICE_CALLER) private readonly caller: IHttpCallStrategy,
    ) {
      super(event);
    }

    async getDetails(id: string) {
      const res = await this.caller.get<never, never, AccountDto>(`/details/${id}`);
      this.handleResponseStatus(res, 'get account details', id);
      return res.data;
    }
  }
  ```
  > Note: `BaseApiService` in this example is a project-specific helper that wraps common response/error handling; it is not provided by `nestjs-yalc`. You can either introduce a similar base class in your codebase or inline the response handling logic in each client service.

- **Events**: extend `NestLocalEventStrategy` if you need to enrich in-process events. Inject `APP_EVENT_SERVICE` (the YALC event bus) for async flows.

- **Switching transport**: replace `NestLocalCallStrategyProvider` with `NestHttpCallStrategyProvider` (or a custom strategy) while keeping the same caller token and client code.
  ```ts
  providers: [
    NestHttpCallStrategyProvider(MY_SERVICE_CALLER, {
      NestHttpStrategy: NestHttpCallStrategy,
      baseUrl: process.env.EXTERNAL_BASE_URL,
    }),
  ];
  ```

## Config and tokens
- Every app declares an alias (`APP_ALIAS_*`) and uses YALC tokens (`APP_EVENT_SERVICE`, `SYSTEM_LOGGER_SERVICE`, `getAppConfigToken(alias)`, `getAppEventToken(alias)`) to isolate config/logging when multiple modules run in the same process.
- Database and connection tokens (e.g., `getConnectionName()`) should be namespaced per app to avoid collisions in the monolith runtime.

## Building and testing
- Build with `nest build` or use a webpack command that surfaces bundler output (`npm run build:webpack`). Ensure webpack externals allow your workspace packages and `@nestjs-yalc/*`; dev mode should avoid over-bundling node externals for faster rebuilds.
- Tests: `jest.config.ts` can use `@nestjs-yalc/jest` (for example via `@nestjs-yalc/jest/config/jest-conf.generator`) to generate per-project configs from `nest-cli.json`. Provide commands for unit, coverage, and e2e (e.g., `npm run test`, `test:cov`, `ci:checks`).
- E2E: import `@nestjs-yalc/jest/config/index.js` helpers per app to keep setup consistent.

## Monolith assembly
- Create an “aggregator” app (e.g., `apps/_atlas`) that imports many domain modules and registers shared call strategies. This provides a single runtime for development/e2e while keeping boundaries intact.
- Principles:
  - Each domain exposes a Nest module plus a client library.
  - Cross-domain communication goes through strategy-driven callers (no direct provider imports between domains).
  - Config/log/event/DB tokens remain per-app so modules can cohabit one process safely.
- Aggregator sketch:
  ```ts
  @Module({
    imports: [
      AccountModule,
      PaymentModule,
      ReportingModule,
      // ...
    ],
    providers: [
      NestLocalCallStrategyProvider(ACCOUNT_CALLER, {
        NestLocalStrategy: ProjectLocalCallStrategy,
        baseUrl: ACCOUNT_BASE_URL,
      }),
      NestLocalCallStrategyProvider(PAYMENT_CALLER, {
        NestLocalStrategy: ProjectLocalCallStrategy,
        baseUrl: PAYMENT_BASE_URL,
      }),
    ],
    controllers: [AggregatorController],
  })
  export class AggregatorModule extends BaseAppModule {}
  ```

## Adding a new domain (repeatable recipe)
1) **Define constants**: add `<domain>.defs.ts` with `APP_ALIAS_*`, base URLs, caller tokens, and DB connection tokens.  
2) **Domain module**: extend your project’s `BaseAppModule` via `baseAppModuleMetadata(MyModule, APP_ALIAS_X, { configFactory, isSingleton: true })`. Import dependencies (other domain modules/clients, `HttpModule`, DB modules). Register `NestLocalCallStrategyProvider` for every outbound dependency using the base URLs from defs. Provide services/repositories/controllers and exports as needed.  
3) **Client library** (`libs/client-<domain>`): implement `Client<Domain>Service` that injects the caller token (`@Inject(MY_SERVICE_CALLER) serviceCaller: IHttpCallStrategy`) and `APP_EVENT_SERVICE`. Optionally reuse a project-specific base service (like `BaseApiService`) for response handling or inline the logic.  
4) **Entry point**: add `apps/<domain>/src/main.ts` with `new AppBootstrap(APP_ALIAS_<DOMAIN>, <Domain>Module).startServer()`.  
5) **Register in `nest-cli.json`**: add both application and library entries with correct `root`, `sourceRoot`, and `tsConfigPath`.  
6) **Testing**: add unit tests for services/clients; wire e2e tests using the YALC Jest config helpers.  
7) **Aggregate**: import the new module into your aggregator app if you want it available in the monolith runtime, and add strategy providers for its outbound calls.
- Minimal file checklist:
  - `apps/<domain>/src/main.ts`
  - `apps/<domain>/src/<domain>.module.ts`
  - `apps/<domain>/src/config/config.ts` (factory + validation schema)
  - `apps/<domain>/src/<domain>.controller.ts` and services/repositories
  - `libs/client-<domain>/src/client-<domain>.service.ts`
  - `libs/client-<domain>/src/<domain>.defs.ts` (caller token/base URL)
  - `nest-cli.json` entries for both app and lib

## Environment and configuration
- Env discovery is centralized (typically `.env`, `.env.<NODE_ENV>`, `.env.remote`, `.env.dist` for non-prod). Keep this in the base module factory so all apps behave consistently.
- Always inject config via `getAppConfigToken(APP_ALIAS_X)` rather than directly constructing `AppConfigService`, to keep contexts isolated in multi-app processes.
- Example env loading snippet:
  ```ts
  const envPath = envFilePathList(envDir);
  envPath.splice(envPath.indexOf(`${envDir}/.env.dist`), 0, `${envDir}/.env.remote`);
  ConfigModule.forRoot({
    envFilePath: envPath,
    isGlobal: true,
    load: [registerAs(APP_ALIAS_MY_APP, configFactory)],
  });
  ```

## Best practices
- Enforce boundaries: never call another domain’s providers directly—always go through a client service + strategy token.
- Default to local-call strategies for monolith development; switch to HTTP or other transports when deploying services independently.
- Mark modules `isSingleton: true` when they must not be instantiated multiple times inside the aggregator.
- Namespace DB/event tokens per app to avoid collisions.
- Use the YALC utilities (logger, errors, event-manager, data-loader, crud-gen, jest helpers) instead of ad-hoc implementations to keep behavior consistent across domains.

## Putting it all together: new project checklist
1) **Initialize the repo**
   - Create a new Node/Nest project with `package.json`.
   - Add `apps/`, `libs/`, `deps/nestjs-yalc/`, `utils/` folders.
   - Vendor `nestjs-yalc` into `deps/nestjs-yalc` or add it as a workspace.
2) **Wire core tooling**
   - In `package.json`, point `@nestjs-yalc/*` to `file:deps/nestjs-yalc/...`.
   - Configure `tsconfig.json` `typeRoots` to include `deps/nestjs-yalc/types` and `types-extends`.
   - Create `webpack.config.cjs` with `@nestjs-yalc` allowlisted in externals and `deps/nestjs-yalc/node_modules` in `additionalModuleDirs`.
   - Add `jest.config.ts` using `@nestjs-yalc/jest` and `nest-cli.json` with your first projects.
3) **Create the base app pieces**
   - Implement your own `BaseAppModule` wrapping `YalcBaseAppModule` (env loading, config, logger, event bus, CLS, interceptors).
   - Optionally implement your own thin bootstrap wrapper (for example an `AppBuilder` class that extends `AppBootstrap`) to centralize HTTP filters, ValidationPipe, Swagger, lifecycle hooks.
4) **Create the first domain**
   - Add `apps/account/src/config/config.ts` (config factory and validation).
   - Add `apps/account/src/account.module.ts` as `BaseAppModule`-based module.
   - Add `apps/account/src/main.ts` using `AppBootstrap` to start the server.
   - Add `libs/client-account/` with `client-account.service.ts` using `IHttpCallStrategy` and your preferred response-handling helper (for example a project-specific `BaseApiService`).
   - Register `NestLocalCallStrategyProvider` for any dependencies the account module has on other domains.
5) **Create the aggregator app**
   - Add `apps/_platform/src/platform.module.ts` importing `AccountModule` and other domain modules as they are added.
   - Register shared `NestLocalCallStrategyProvider` instances for cross-domain calls (one provider per caller token).
   - Add `apps/_platform/src/main.ts` to start the aggregator with `AppBootstrap`.
6) **Add more domains incrementally**
   - For each new domain, repeat the “Adding a new domain” recipe:
     - defs, module, entrypoint, client lib, nest-cli entries, tests.
   - Import new domain modules into the aggregator app as needed.
7) **Evolve towards microservices**
   - When a domain needs to become an independent service:
     - Switch its callers from `NestLocalCallStrategyProvider` to `NestHttpCallStrategyProvider` (or another transport).
     - Deploy that domain’s app separately and adjust base URLs.
   - Keep all other domains unchanged; they still use the same client APIs and tokens.
