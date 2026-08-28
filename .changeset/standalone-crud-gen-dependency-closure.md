---
"@nestjs-yalc/crud-gen": patch
"@nestjs-yalc/data-loader": patch
"@nestjs-yalc/database": patch
"@nestjs-yalc/errors": patch
"@nestjs-yalc/event-manager": patch
"@nestjs-yalc/field-middleware": patch
"@nestjs-yalc/graphql": patch
"@nestjs-yalc/logger": patch
"@nestjs-yalc/utils": patch
---

Declare the complete runtime dependency and peer graph reached by a standalone
CrudGen installation. This lets consumers install `@nestjs-yalc/crud-gen`
directly without relying on the aggregate framework package to hoist missing
dependencies.
