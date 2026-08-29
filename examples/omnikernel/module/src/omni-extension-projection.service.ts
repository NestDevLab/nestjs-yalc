import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen';
import {
  PROJECTION_INTEGER_MAX,
  ProjectionResourceService,
  type ProjectionDialect,
  type ProjectionValuePatch,
} from '@nestjs-yalc/crud-gen';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  In,
  IsNull,
  type DataSource,
  type EntityManager,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import {
  createOmniProjectionReaderCatalog,
  type OmniProjectionReaderCatalog,
} from './omni-projection.catalog.js';
import type { OmniExtensionProjectionDefinition } from './omni-extension-projection.definition.js';
import type { OmniProjectionLifecycle } from './omni-projection.lifecycle.js';
import type { OmniScope } from './omni-scope.js';

function hasOwn(input: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function isUniqueConstraint(error: unknown): boolean {
  const candidate = error as { driverError?: { code?: unknown } } | undefined;
  const code = candidate?.driverError?.code;
  return code === 'SQLITE_CONSTRAINT' || code === '23505';
}

function isRetryableTransactionError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  const code = candidate?.driverError?.code ?? candidate?.code;
  return (
    code === '40001' ||
    code === 'SQLITE_BUSY' ||
    code === 'SQLITE_BUSY_SNAPSHOT'
  );
}

/**
 * Generated-CRUD compatible store for a dedicated extension table. It keeps
 * the Omni record as the only root identity and revision owner, while the
 * extension table owns projected columns and its native JSON payload.
 */
export class OmniExtensionProjectionService<
  Extension extends ObjectLiteral,
> extends ProjectionResourceService<Extension> {
  constructor(
    extensionRepository: Repository<Extension>,
    private readonly ownerRepository: Repository<OmniRecordEntity>,
    private readonly dataSource: DataSource,
    scope: OmniScope,
    dialect: ProjectionDialect,
    events: YalcEventService,
    private readonly omniDefinition: OmniExtensionProjectionDefinition,
    private readonly lifecycle?: OmniProjectionLifecycle<
      OmniExtensionProjectionDefinition,
      Extension
    >,
    private readonly readerCatalog?: OmniProjectionReaderCatalog,
  ) {
    super(extensionRepository, scope, dialect, events, omniDefinition);
  }

  override async getEntity(
    conditions: Record<string, unknown>,
    _fields?: string[],
    _relations?: string[],
    _databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<Extension | null> {
    const guid = this.guidFromConditions(conditions);
    const entity = await this.readOne(guid);
    if (!entity && options?.failOnNull) this.notFound();
    return entity;
  }

  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Extension> = {},
    withCount = false,
  ): Promise<Extension[] | [Extension[], number]> {
    const [extensions, count] = await this.dialect.findMany(
      this.repository,
      this.definition,
      this.scope.scopeId,
      this.filtersFromFindOptions(findOptions),
      this.sortingFromFindOptions(findOptions),
      this.pageFromFindOptions(findOptions),
    );
    const guidColumn = this.definition.identity.column;
    const guids = extensions.map(
      (extension) =>
        (extension as Record<string, unknown>)[guidColumn] as string,
    );
    if (guids.length === 0) return withCount ? [[], count] : [];

    const owners = await this.ownerRepository.find({
      where: {
        scopeId: this.scope.scopeId,
        guid: In(guids),
        kind: this.omniDefinition.owner.kind,
        payloadSchemaId: this.omniDefinition.owner.schema.id,
        payloadSchemaVersion: this.omniDefinition.owner.schema.version,
        deletedAt: IsNull(),
      },
    });
    const ownersByGuid = new Map(owners.map((owner) => [owner.guid, owner]));
    if (ownersByGuid.size !== extensions.length) {
      throw new Error(
        'Omni extension projection invariant failed: an extension owner is unavailable.',
      );
    }
    const projected = extensions.map((extension) =>
      this.merge(extension, ownersByGuid.get((extension as any)[guidColumn])!),
    );
    return withCount ? [projected, count] : projected;
  }

  override async createEntity(
    input: Record<string, unknown>,
  ): Promise<Extension> {
    this.rejectUnknownInput(input, true);
    const extension = this.createExtension(input);
    const guid = extension[this.definition.identity.column] as string;
    const owner = this.ownerRepository.create({
      scopeId: this.scope.scopeId,
      guid,
      title: this.omniDefinition.owner.title,
      kind: this.omniDefinition.owner.kind,
      status: this.omniDefinition.owner.status,
      payload: null,
      payloadSchemaId: this.omniDefinition.owner.schema.id,
      payloadSchemaVersion: this.omniDefinition.owner.schema.version,
    });

    try {
      return await this.mutate(async (manager) => {
        await this.lifecycle?.beforeCreate?.({
          definition: this.omniDefinition,
          scope: this.scope,
          manager,
          readers: this.readers(manager),
          input,
        });
        await manager.getRepository(OmniRecordEntity).save(owner);
        const saved = await manager
          .getRepository(this.repository.target)
          .save(extension as Extension);
        return this.merge(saved, owner);
      });
    } catch (error) {
      if (isUniqueConstraint(error)) this.identityConflict();
      throw error;
    }
  }

  override async updateEntity(
    conditions: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<Extension> {
    this.rejectUnknownInput(input, false);
    const guid = this.guidFromConditions(conditions);
    const expectedRevision = input.expectedRevision;
    if (
      typeof expectedRevision !== 'number' ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1 ||
      expectedRevision >= PROJECTION_INTEGER_MAX
    ) {
      this.invalid(
        `expectedRevision must be an integer between 1 and ${PROJECTION_INTEGER_MAX - 1}.`,
      );
    }
    const patch = this.createValuePatch(guid, input);

    return this.mutate(async (manager) => {
      const owners = manager.getRepository(OmniRecordEntity);
      const extensions = manager.getRepository(this.repository.target);
      const currentOwner = await this.findOwner(guid, manager);
      const currentExtension = await extensions.findOne({
        where: {
          [this.definition.scope.column]: this.scope.scopeId,
          [this.definition.identity.column]: guid,
        } as any,
      });
      if (!currentOwner) this.notFound();
      if (currentOwner.revision !== expectedRevision) {
        await this.throwUpdateMiss(guid, manager);
      }
      if (!currentExtension) {
        throw new Error(
          'Omni extension projection invariant failed: extension row is unavailable.',
        );
      }
      await this.lifecycle?.beforeUpdate?.({
        definition: this.omniDefinition,
        scope: this.scope,
        manager,
        readers: this.readers(manager),
        input,
        current: this.merge(currentExtension, currentOwner),
      });
      const result = await owners
        .createQueryBuilder()
        .update()
        .set({ revision: () => '"revision" + 1' })
        .where(
          '"scopeId" = :scopeId AND "guid" = :guid AND "revision" = :expectedRevision AND "kind" = :kind AND "payloadSchemaId" = :schemaId AND "payloadSchemaVersion" = :schemaVersion AND "deletedAt" IS NULL',
          {
            scopeId: this.scope.scopeId,
            guid,
            expectedRevision,
            kind: this.omniDefinition.owner.kind,
            schemaId: this.omniDefinition.owner.schema.id,
            schemaVersion: this.omniDefinition.owner.schema.version,
          },
        )
        .execute();
      if (!result.affected) await this.throwUpdateMiss(guid, manager);

      const patched = await this.dialect.patchValues(
        extensions,
        this.definition,
        patch,
      );
      if (patched !== 1) {
        throw new Error(
          'Omni extension projection invariant failed: extension row is unavailable.',
        );
      }
      const extension = await extensions.findOneOrFail({
        where: {
          [this.definition.scope.column]: this.scope.scopeId,
          [this.definition.identity.column]: guid,
        } as any,
      });
      const owner = await owners.findOneOrFail({
        where: { scopeId: this.scope.scopeId, guid },
      });
      return this.merge(extension, owner);
    });
  }

  override async deleteEntity(
    conditions: Record<string, unknown>,
  ): Promise<boolean> {
    const guid = this.guidFromConditions(conditions);
    await this.mutate(async (manager) => {
      const owner = await this.findOwner(guid, manager);
      if (!owner) this.notFound();
      const extension = await manager
        .getRepository(this.repository.target)
        .findOne({
          where: {
            [this.definition.scope.column]: this.scope.scopeId,
            [this.definition.identity.column]: guid,
          } as any,
        });
      if (!extension) {
        throw new Error(
          'Omni extension projection invariant failed: extension row is unavailable.',
        );
      }
      await this.lifecycle?.beforeDelete?.({
        definition: this.omniDefinition,
        scope: this.scope,
        manager,
        readers: this.readers(manager),
        input: {},
        current: this.merge(extension, owner),
      });
      const result = await manager.getRepository(OmniRecordEntity).delete({
        scopeId: this.scope.scopeId,
        guid,
        kind: this.omniDefinition.owner.kind,
        payloadSchemaId: this.omniDefinition.owner.schema.id,
        payloadSchemaVersion: this.omniDefinition.owner.schema.version,
      });
      if (!result.affected) this.notFound();
    });
    return true;
  }

  private createExtension(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const extension: Record<string, unknown> = {
      [this.definition.scope.column]: this.scope.scopeId,
      [this.definition.payload.column]: this.createPayload(input),
    };
    for (const field of this.definition.fields) {
      const value = input[field.name];
      if (field.requiredOnCreate && (value === undefined || value === null)) {
        this.invalid(`Projection field ${field.name} is required on create.`);
      }
      if (value === null && !field.nullable) {
        this.invalid(`Projection field ${field.name} cannot be null.`);
      }
      if (value !== undefined && field.storage === 'column') {
        extension[field.column ?? field.name] = this.normalizeValue(
          field,
          value,
        );
      }
    }
    return extension;
  }

  private readers(manager: EntityManager) {
    return (
      this.readerCatalog ??
      createOmniProjectionReaderCatalog([
        {
          type: 'extension',
          id: this.omniDefinition.id,
          entity: this.repository.target,
          definition: this.omniDefinition,
        },
      ])
    ).bind(manager, this.scope);
  }

  private async mutate<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      if (this.lifecycle) {
        return await this.dataSource.transaction('SERIALIZABLE', work);
      }
      return await this.dataSource.transaction(work);
    } catch (error) {
      if (isRetryableTransactionError(error)) {
        throw this.events.errorConflict(
          'projection.concurrent.write.conflict',
          {
            response: {
              message:
                'Omni projection concurrent write conflict; retry the mutation.',
            },
          },
        );
      }
      throw error;
    }
  }

  private createValuePatch(
    guid: string,
    input: Record<string, unknown>,
  ): ProjectionValuePatch {
    const patch: ProjectionValuePatch = {
      scopeId: this.scope.scopeId,
      guid,
      columnValues: {},
      jsonValues: [],
    };
    for (const field of this.definition.fields) {
      if (
        field.name === this.definition.identity.column ||
        !hasOwn(input, field.name)
      ) {
        continue;
      }
      const value = input[field.name];
      if (value === null && !field.nullable) {
        this.invalid(`Projection field ${field.name} cannot be null.`);
      }
      const normalized = this.normalizeValue(field, value);
      if (field.storage === 'column') {
        patch.columnValues[field.column ?? field.name] = normalized;
      } else {
        patch.jsonValues.push({ field, value: normalized });
      }
    }
    if (
      Object.keys(patch.columnValues).length === 0 &&
      patch.jsonValues.length === 0
    ) {
      this.invalid('Projection update requires at least one writable field.');
    }
    return patch;
  }

  private async readOne(guid: string): Promise<Extension | null> {
    const extension = await this.repository.findOne({
      where: {
        [this.definition.scope.column]: this.scope.scopeId,
        [this.definition.identity.column]: guid,
      } as any,
    });
    if (!extension) return null;
    const owner = await this.findOwner(guid);
    return owner ? this.merge(extension, owner) : null;
  }

  private async findOwner(
    guid: string,
    manager?: EntityManager,
  ): Promise<OmniRecordEntity | null> {
    return (
      manager?.getRepository(OmniRecordEntity) ?? this.ownerRepository
    ).findOne({
      where: {
        scopeId: this.scope.scopeId,
        guid,
        kind: this.omniDefinition.owner.kind,
        payloadSchemaId: this.omniDefinition.owner.schema.id,
        payloadSchemaVersion: this.omniDefinition.owner.schema.version,
        deletedAt: IsNull(),
      },
    });
  }

  private merge(extension: Extension, owner: OmniRecordEntity): Extension {
    return {
      ...(this.project(extension) as Record<string, unknown>),
      scopeId: owner.scopeId,
      guid: owner.guid,
      [this.definition.revision.column]: owner.revision,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
      deletedAt: owner.deletedAt,
    } as unknown as Extension;
  }

  private async throwUpdateMiss(
    guid: string,
    manager: EntityManager,
  ): Promise<never> {
    if (!(await this.findOwner(guid, manager))) this.notFound();
    throw this.events.errorConflict('projection.revision.conflict', {
      response: { message: 'Projection resource revision is stale.' },
    });
  }

  private identityConflict(): never {
    throw this.events.errorConflict('projection.identity.conflict', {
      response: {
        message: 'Projection identity already exists in this scope.',
      },
    });
  }
}
