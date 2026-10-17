---
'@nestjs-yalc/app': patch
---

Build the default Fastify instance through `FastifyAdapter`. Nest 11 reads `initialConfig.routerOptions`, which a bare `fastify()` instance doesn't expose, so requests through Nest middleware failed with a 500.
