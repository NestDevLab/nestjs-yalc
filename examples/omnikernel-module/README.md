# OmniKernel Module

`@nestjs-yalc/omnikernel-module` is a foundational example module that models a
generic knowledge kernel with:

- named entities for reusable lookup records,
- records for structured domain objects,
- relations between records,
- external references for third-party synchronization.

It follows the same `CrudGenDependencyFactory` pattern used across the example
modules in this repository, so each entity exposes the usual auto-wired
service, dataloader, and GraphQL resolver providers.

## Document Slice Additions

- typed record and relation enums for status and relation semantics
- `OmniDocumentEntity` as the first concrete record family built on
  `OmniRecordEntity`
- single-table record storage so documents participate in the same record graph
  as generic Omni records

## Entities

- `OmniNamedEntity`: basic named records with `externalId`, `title`, and `slug`.
- `OmniRecordEntity`: richer records with `kind`, `status`, and `payload`.
- `OmniDocumentEntity`: concrete document-like records with document subtype,
  content, source URL, and publication timestamp, stored in the shared
  `omni-record` table.
- `OmniRelationEntity`: directional links between two Omni records.
- `OmniExternalRefEntity`: provider-specific mappings between internal records
  and external systems.

## Registration

```ts
import { OmniKernelModule } from '@nestjs-yalc/omnikernel-module';

@Module({
  imports: [OmniKernelModule.register('default')],
})
export class AppModule {}
```

## Notes

- Entities extend `EntityWithTimestamps` through `OmniBaseEntity`.
- JSON-like fields use TypeORM `simple-json` for portability across example
  databases.
- GraphQL DTOs include `class-validator` decorators as usage examples for input
  validation.
