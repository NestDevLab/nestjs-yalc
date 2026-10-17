# @nestjs-yalc/app

## 1.4.0

### Minor Changes

- fe60194: Add `swaggerDocumentOptions` to `ICreateOptions` so callers can pass `SwaggerDocumentOptions` (for example `autoTagControllers: false`) to `SwaggerModule.createDocument`.

### Patch Changes

- fe60194: Build the default Fastify instance through `FastifyAdapter`. Nest 11 reads `initialConfig.routerOptions`, which a bare `fastify()` instance doesn't expose, so requests through Nest middleware failed with a 500.

## 1.3.3

### Patch Changes

- Publish npm-safe README files for every package and prevent Jekyll landing-page
  markup from being copied into npm tarballs.
