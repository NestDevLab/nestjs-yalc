# @nestjs-yalc/event-manager

## 1.3.4

### Patch Changes

- 8d3d378: Publish OmniKernel as a normal framework package and verify its complete
  runtime and type dependency closure from a standalone tarball consumer.
- ab50237: Declare the complete runtime dependency and peer graph reached by a standalone
  CrudGen installation. This lets consumers install `@nestjs-yalc/crud-gen`
  directly without relying on the aggregate framework package to hoist missing
  dependencies.
- Updated dependencies [ab50237]
  - @nestjs-yalc/errors@1.3.4
  - @nestjs-yalc/logger@1.3.4
  - @nestjs-yalc/utils@1.3.4

## 1.3.3

### Patch Changes

- Publish npm-safe README files for every package and prevent Jekyll landing-page
  markup from being copied into npm tarballs.
