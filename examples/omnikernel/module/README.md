# OmniKernel Module

`@nestjs-yalc/omnikernel-module` is a reusable backend substrate for generic
records, collections, documents, relations, and external references.

This package intentionally does not publish REST controllers or GraphQL
resolvers. It provides entities, DTO metadata, services, dataloaders, and query
helpers. Consuming apps decide which APIs to expose by composing resources with
CrudGen.

## Model

- `OmniNamedEntity`: named lookup records.
- `OmniRecordEntity`: generic records with `kind`, `status`, and `payload`.
- `OmniDocumentEntity`: document-like records stored in the shared
  `omni-record` table.
- `OmniCollectionEntity`: container-like records stored in the shared
  `omni-record` table.
- `OmniRelationEntity`: directional graph links.
- `OmniExternalRefEntity`: external-system mappings.

## Relation Semantics

- `contains`: canonical organization edge, usually collection to contained
  record.
- `references`: explicit cross-record reference.
- `related_to`: loose association.

There is no separate `belongs_to` edge. Reverse traversal is represented by the
relation direction.

## Backend Registration

```ts
import { OmniKernelModule } from '@nestjs-yalc/omnikernel-module';

@Module({
  imports: [OmniKernelModule.register('default')],
})
export class AppModule {}
```

## CrudGen Backend Files

The module exports backend provider factories for each resource:

- `omni-named.backend.ts`
- `omni-record.backend.ts`
- `omni-document.backend.ts`
- `omni-collection.backend.ts`
- `omni-relation.backend.ts`
- `omni-external-ref.backend.ts`

Those factories are suitable for generated REST/GraphQL composition in an app
or for lower-level service/repository override patterns.

## Query Helpers

- `OmniKernelQueryService.getCollectionMembers(collectionId)`
- `OmniKernelQueryService.getDocumentCollections(documentId)`
- `OmniKernelQueryService.getDocumentExternalRefs(documentId, provider?)`

## Role In The Examples

Use this package when you need the reusable persistence backend. Use
`examples/omnikernel/app` to see that backend exposed through generated APIs.
