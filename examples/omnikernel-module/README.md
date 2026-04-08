# OmniKernel Module

`@nestjs-yalc/omnikernel-module` is an example module for building a
graph-shaped content and knowledge layer on top of `nestjs-yalc`.

The idea behind OmniKernel is simple:

- store generic records that can represent many domain objects,
- specialize some of those records into richer concrete types such as documents,
- connect records through typed relations,
- and map internal entities to external systems through stable references.

In practical terms, the finished OmniKernel example is meant to become a
reference module for systems that need:

- documents and other structured records,
- collections or containers for organizing those records,
- typed graph links between entities,
- and synchronization hooks toward external providers.

This example is intentionally not AI-specific. The goal is to provide a generic
kernel for content, graph, and synchronization concerns that other modules can
build on.

Today, the module already models:

- named entities for reusable lookup records,
- records for structured domain objects,
- collections for organizing documents and other records,
- relations between records,
- external references for third-party synchronization.

It follows the same `CrudGenDependencyFactory` pattern used across the example
modules in this repository, so each entity exposes the usual auto-wired
service, dataloader, and GraphQL resolver providers.

The module now also includes workflow/query helpers for:

- syncing document and collection external references through a typed
  `OmniExternalRefService`
- traversing collection membership and document external refs through
  `OmniKernelQueryService`

## Final Objective

The final OmniKernel module should demonstrate a coherent end state where:

- generic records provide the common storage model,
- documents become the first concrete record family,
- collections organize and group documents,
- typed relations express navigation across the graph,
- external refs make sync scenarios explicit,
- and higher-level services show how to query and traverse the model in a real
  application.

One of the intended downstream consumers is the task application. The long-term
goal is for the task app to stop inventing its own parallel model and instead
reuse OmniKernel concepts such as:

- records/documents for task-like entities,
- collections for project or board-like grouping,
- relations for dependencies and hierarchy,
- external refs for third-party tracker synchronization.

That integration is intentionally deferred until the OmniKernel model is stable
enough to avoid reworking the task app on every intermediate schema change.

The current document write path also enforces the base record `kind` at the
service layer, so direct service usage cannot persist a non-document document
record by accident.

## Document Slice Additions

- typed record and relation enums for status and relation semantics
- `OmniDocumentEntity` as the first concrete record family built on
  `OmniRecordEntity`
- single-table record storage so documents participate in the same record graph
  as generic Omni records

## Collection Slice Additions

- `OmniCollectionEntity` as the first organization/container record family
- shared `omni-record` storage for collections and documents in the same graph
- collection membership expressed through standard Omni relations, with
  collection-to-document `contains` links as the first concrete example

## Relation Semantics

- `contains` is the canonical organization edge, flowing from collection to the
  contained record
- there is intentionally no separate `belongs_to` inverse edge yet, because the
  reverse meaning is already carried by relation direction
- `derived_from` is currently reserved for document-to-document lineage
- `references` and `related_to` remain the flexible cross-record graph links

## External Ref Workflows

- `internalType` is now explicit through `OmniExternalRefInternalType`
- document sync helpers use `document` as the internal target type
- collection sync helpers use `collection` as the internal target type
- upserts are keyed by provider, externalId, account, and container

## Query Layer

- `OmniKernelQueryService.getCollectionMembers(collectionId)` returns the
  records linked by canonical collection `contains` relations
- `OmniKernelQueryService.getDocumentCollections(documentId)` resolves the
  parent collections for a document
- `OmniKernelQueryService.getDocumentExternalRefs(documentId, provider?)`
  resolves the external sync mappings for a document

## Entities

- `OmniNamedEntity`: basic named records with `externalId`, `title`, and `slug`.
- `OmniRecordEntity`: richer records with `kind`, `status`, and `payload`.
- `OmniDocumentEntity`: concrete document-like records with document subtype,
  content, source URL, and publication timestamp, stored in the shared
  `omni-record` table.
- `OmniCollectionEntity`: concrete container-like records with collection
  subtype and summary fields, stored in the shared `omni-record` table.
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
- The package now includes `tsconfig.lib.json` / `tsconfig.dev.json` so the
  root repo Jest config can discover `@nestjs-yalc/omnikernel-module` as a
  first-class test project during CI runs.
