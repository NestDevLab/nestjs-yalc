import {
  createProjectionDialect,
  type ProjectionFilter,
} from '@nestjs-yalc/crud-gen';
import type { InjectionToken, Provider } from '@nestjs/common';
import {
  In,
  IsNull,
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
} from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import type { OmniExtensionProjectionDefinition } from './omni-extension-projection.definition.js';
import {
  getOmniRelationProjectionAllowedKinds,
  type OmniRelationProjectionDefinition,
} from './omni-relation-projection.definition.js';
import { OmniRelationStatus } from './omni-relation-status.enum.js';
import type { OmniScope } from './omni-scope.js';

export interface OmniExtensionProjectionReaderRegistration<
  Entity extends ObjectLiteral = ObjectLiteral,
> {
  readonly type: 'extension';
  readonly id: string;
  readonly entity: EntityTarget<Entity>;
  readonly definition: OmniExtensionProjectionDefinition;
}

export interface OmniRelationProjectionReaderRegistration {
  readonly type: 'relation';
  readonly id: string;
  readonly definition: OmniRelationProjectionDefinition;
}

export type OmniProjectionReaderRegistration =
  | OmniExtensionProjectionReaderRegistration
  | OmniRelationProjectionReaderRegistration;

export interface OmniExtensionProjectionReader<
  Entity extends ObjectLiteral = ObjectLiteral,
> {
  get(guid: string): Promise<Entity | undefined>;
  list(options?: {
    /** Equality only, on declared fields that explicitly allow eq filtering. */
    where?: Readonly<Record<string, unknown>>;
    /** A bounded result size; policies commonly use take: 1 for existence. */
    take?: number;
  }): Promise<Entity[]>;
}

export interface OmniRelationProjectionReader {
  get(guid: string): Promise<OmniRelationEntity | undefined>;
  list(options?: {
    sourceRecordId?: string;
    targetRecordId?: string;
    /** A bounded result size for edge-existence checks. */
    take?: number;
  }): Promise<OmniRelationEntity[]>;
}

/**
 * Manager-bound readers available to a lifecycle policy. They intentionally
 * expose projection identities and constrained graph records, never TypeORM
 * repositories or query runners.
 */
export interface OmniProjectionTransactionReaders {
  extension<Entity extends ObjectLiteral = ObjectLiteral>(
    id: string,
  ): OmniExtensionProjectionReader<Entity>;
  relation(id: string): OmniRelationProjectionReader;
}

export interface OmniProjectionReaderCatalog {
  bind(
    manager: EntityManager,
    scope: OmniScope,
  ): OmniProjectionTransactionReaders;
}

export interface OmniProjectionReaderCatalogProvider {
  readonly token: InjectionToken<OmniProjectionReaderCatalog>;
}

export interface OmniProjectionReaderCatalogSource {
  readonly reader: OmniProjectionReaderRegistration;
}

/** Default token for a composed set of generated Omni projection resources. */
export const OMNI_PROJECTION_READER_CATALOG = Symbol(
  'OMNI_PROJECTION_READER_CATALOG',
);

function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') Object.freeze(value);
  return value;
}

function validateReaderTake(take: number | undefined): number | undefined {
  if (take === undefined) return undefined;
  if (!Number.isInteger(take) || take < 1 || take > 1_000) {
    throw new TypeError(
      'Omni projection reader take must be an integer from 1 to 1000.',
    );
  }
  return take;
}

function relationWhere(
  definition: OmniRelationProjectionDefinition,
): Record<string, unknown> {
  const relation = definition.relation;
  return {
    kind: In([...getOmniRelationProjectionAllowedKinds(definition)]),
    status: relation.status ?? OmniRelationStatus.Active,
    ...(relation.schema
      ? {
          payloadSchemaId: relation.schema.id,
          payloadSchemaVersion: relation.schema.version,
        }
      : {
          payloadSchemaId: IsNull(),
          payloadSchemaVersion: IsNull(),
        }),
  };
}

function extensionReader<Entity extends ObjectLiteral>(
  manager: EntityManager,
  scope: OmniScope,
  registration: OmniExtensionProjectionReaderRegistration<Entity>,
): OmniExtensionProjectionReader<Entity> {
  const ownerWhere = {
    scopeId: scope.scopeId,
    kind: registration.definition.owner.kind,
    payloadSchemaId: registration.definition.owner.schema.id,
    payloadSchemaVersion: registration.definition.owner.schema.version,
    deletedAt: IsNull(),
  };
  const extensionRepository = manager.getRepository(registration.entity);
  const ownerRepository = manager.getRepository(OmniRecordEntity);
  const identity = registration.definition.identity.column;
  const scopeColumn = registration.definition.scope.column;

  const project = (entity: Entity, owner: OmniRecordEntity): Entity => {
    const projected = {
      ...entity,
      scopeId: owner.scopeId,
      guid: owner.guid,
      [registration.definition.revision.column]: owner.revision,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
      deletedAt: owner.deletedAt,
    } as Entity;
    return projected;
  };

  const getOwner = async (
    guid: string,
  ): Promise<OmniRecordEntity | undefined> => {
    const owner = await ownerRepository.findOne({
      where: { ...ownerWhere, guid },
    });
    return owner ?? undefined;
  };

  const dialect = (() => {
    const type = manager.connection.options.type;
    if (type !== 'sqlite' && type !== 'postgres') {
      throw new TypeError(
        'Omni projection readers require SQLite or PostgreSQL.',
      );
    }
    return createProjectionDialect(type);
  })();

  const filtersFor = (
    where: Readonly<Record<string, unknown>> | undefined,
  ): ProjectionFilter[] => {
    const filters: ProjectionFilter[] = [];
    for (const [fieldName, value] of Object.entries(where ?? {})) {
      const field = registration.definition.fields.find(
        (candidate) => candidate.name === fieldName,
      );
      if (!field || !field.query?.filter?.includes('eq')) {
        throw new TypeError(
          `Omni extension reader only permits declared eq fields: ${fieldName}.`,
        );
      }
      filters.push({ field, operator: 'eq', values: [value] });
    }
    return filters;
  };

  const projectMany = async (entities: Entity[]): Promise<Entity[]> => {
    if (entities.length === 0) return [];
    const candidates: unknown[] = entities.map(
      (entity) => entity[identity as keyof Entity] as unknown,
    );
    const guids = candidates.filter(
      (guid): guid is string => typeof guid === 'string',
    );
    const owners = await ownerRepository.find({
      where: { ...ownerWhere, guid: In(guids) },
    });
    const ownersByGuid = new Map(owners.map((owner) => [owner.guid, owner]));
    return entities.flatMap((entity) => {
      const guid = entity[identity as keyof Entity];
      const owner =
        typeof guid === 'string' ? ownersByGuid.get(guid) : undefined;
      return owner ? [project(entity, owner)] : [];
    });
  };

  return freeze({
    async get(guid: string): Promise<Entity | undefined> {
      const entity = await extensionRepository.findOne({
        where: { [scopeColumn]: scope.scopeId, [identity]: guid } as never,
      });
      if (!entity) return undefined;
      const owner = await getOwner(guid);
      return owner ? project(entity, owner) : undefined;
    },
    async list(
      options: {
        where?: Readonly<Record<string, unknown>>;
        take?: number;
      } = {},
    ): Promise<Entity[]> {
      const [entities] = await dialect.findMany(
        extensionRepository,
        registration.definition,
        scope.scopeId,
        filtersFor(options.where),
        [],
        { take: validateReaderTake(options.take) },
      );
      return projectMany(entities);
    },
  });
}

function relationReader(
  manager: EntityManager,
  scope: OmniScope,
  registration: OmniRelationProjectionReaderRegistration,
): OmniRelationProjectionReader {
  const repository = manager.getRepository(OmniRelationEntity);
  const fixed = relationWhere(registration.definition);
  return freeze({
    async get(guid: string): Promise<OmniRelationEntity | undefined> {
      const entity = await repository.findOne({
        where: { scopeId: scope.scopeId, guid, ...fixed } as never,
      });
      return entity ?? undefined;
    },
    async list(
      options: {
        sourceRecordId?: string;
        targetRecordId?: string;
        take?: number;
      } = {},
    ): Promise<OmniRelationEntity[]> {
      const { take, ...conditions } = options;
      return await repository.find({
        where: { scopeId: scope.scopeId, ...fixed, ...conditions } as never,
        take: validateReaderTake(take),
      });
    },
  });
}

/**
 * Creates an immutable catalog from resource registrations. It has no global
 * state: each hook binds the catalog to its active transaction manager.
 */
export function createOmniProjectionReaderCatalog(
  registrations: readonly (
    | OmniProjectionReaderRegistration
    | OmniProjectionReaderCatalogSource
  )[],
): OmniProjectionReaderCatalog {
  const byId = new Map<string, OmniProjectionReaderRegistration>();
  for (const source of registrations) {
    const registration = 'reader' in source ? source.reader : source;
    if (!registration.id || byId.has(registration.id)) {
      throw new TypeError(
        'Omni projection reader registrations must have unique non-empty ids.',
      );
    }
    byId.set(registration.id, registration);
  }
  const snapshot = freeze(new Map(byId));
  return freeze({
    bind(
      manager: EntityManager,
      scope: OmniScope,
    ): OmniProjectionTransactionReaders {
      return freeze({
        extension<Entity extends ObjectLiteral = ObjectLiteral>(
          id: string,
        ): OmniExtensionProjectionReader<Entity> {
          const registration = snapshot.get(id);
          if (!registration || registration.type !== 'extension') {
            throw new TypeError(
              `Omni extension projection reader is not registered: ${id}.`,
            );
          }
          return extensionReader(
            manager,
            scope,
            registration,
          ) as OmniExtensionProjectionReader<Entity>;
        },
        relation(id: string): OmniRelationProjectionReader {
          const registration = snapshot.get(id);
          if (!registration || registration.type !== 'relation') {
            throw new TypeError(
              `Omni relation projection reader is not registered: ${id}.`,
            );
          }
          return relationReader(manager, scope, registration);
        },
      });
    },
  });
}

/**
 * Creates the one Nest provider shared by lifecycle-enabled registrations.
 * Call it after creating the individual resource registrations, passing those
 * registrations directly; the catalog captures their immutable reader entries.
 */
export function createOmniProjectionReaderCatalogProvider(
  registrations: readonly (
    | OmniProjectionReaderRegistration
    | OmniProjectionReaderCatalogSource
  )[],
  token: InjectionToken<OmniProjectionReaderCatalog> = OMNI_PROJECTION_READER_CATALOG,
): Provider {
  return {
    provide: token,
    useValue: createOmniProjectionReaderCatalog(registrations),
  };
}
