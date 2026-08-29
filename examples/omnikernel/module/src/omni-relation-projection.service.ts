import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Operators,
  PROJECTION_INTEGER_MAX,
  type CrudGenFindManyOptions,
} from '@nestjs-yalc/crud-gen';
import {
  In,
  IsNull,
  type DataSource,
  type DeepPartial,
  type EntityManager,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import {
  createOmniProjectionReaderCatalog,
  type OmniProjectionReaderCatalog,
} from './omni-projection.catalog.js';
import {
  getOmniRelationProjectionAliases,
  getOmniRelationProjectionAllowedKinds,
  type OmniRelationProjectionDefinition,
} from './omni-relation-projection.definition.js';
import type { OmniProjectionLifecycle } from './omni-projection.lifecycle.js';
import { OmniRelationService } from './omni-relation.service.js';
import { OmniRelationStatus } from './omni-relation-status.enum.js';
import type { OmniRelationKindContract } from './omni-relation-kind.contract.js';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
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
 * One generated relation surface over OmniRelationEntity. Creation selects an
 * allowed kind; every other operation constrains that field to the registered
 * set and keeps endpoints, status, and schema metadata server-owned.
 */
export class OmniRelationProjectionService extends OmniRelationService {
  constructor(
    repository: Repository<OmniRelationEntity>,
    scope: OmniScope,
    private readonly relationDeletion: OmniDeletePolicy,
    recordRepository: Repository<OmniRecordEntity>,
    kinds: OmniRelationKindContract,
    private readonly definition: OmniRelationProjectionDefinition,
    private readonly dataSource?: DataSource,
    private readonly lifecycle?: OmniProjectionLifecycle<
      OmniRelationProjectionDefinition,
      OmniRelationEntity
    >,
    private readonly readerCatalog?: OmniProjectionReaderCatalog,
  ) {
    super(repository, scope, relationDeletion, recordRepository, kinds);
    for (const kind of getOmniRelationProjectionAllowedKinds(definition)) {
      try {
        kinds.assert(kind);
      } catch (error) {
        throw new TypeError(
          error instanceof Error
            ? error.message
            : 'Omni relation projection kind is not registered.',
        );
      }
    }
  }

  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: true,
  ): Promise<OmniRelationEntity>;
  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRelationEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity = true,
  ): Promise<OmniRelationEntity | boolean> {
    const normalized = this.normalizeInput(input as Record<string, unknown>);
    this.rejectFixedFields(normalized, true);
    this.selectCreateKind(normalized);
    const created = this.createValues(normalized);
    if (!this.lifecycle) {
      const result = await super.createEntity(
        created,
        findOptions,
        returnEntity,
      );
      return typeof result === 'boolean' ? result : this.publicEntity(result);
    }
    const result = await this.mutate(async (manager) => {
      await this.assertRelation(
        created,
        manager.getRepository(OmniRecordEntity),
      );
      await this.lifecycle!.beforeCreate?.({
        definition: this.definition,
        scope: this.scope,
        manager,
        readers: this.readers(manager),
        input: this.publicInput(normalized),
      });
      const repository = manager.getRepository(OmniRelationEntity);
      const entity = {
        ...created,
        scopeId: this.scopeId,
      };
      const guid = this.requiredIdentifier(entity.guid, 'guid');
      await repository.insert(entity as never);
      if (!returnEntity) return true;
      return repository.findOneOrFail({
        where: {
          scopeId: this.scopeId,
          guid,
          ...this.definitionFilters(),
        } as FindOptionsWhere<OmniRelationEntity>,
      });
    });
    return typeof result === 'boolean' ? result : this.publicEntity(result);
  }

  override async getEntity(
    conditions:
      | FindOptionsWhere<OmniRelationEntity>[]
      | FindOptionsWhere<OmniRelationEntity>
      | ObjectLiteral
      | string,
    fields?: (keyof OmniRelationEntity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull: false },
  ): Promise<OmniRelationEntity | undefined>;
  override async getEntity(
    conditions:
      | FindOptionsWhere<OmniRelationEntity>[]
      | FindOptionsWhere<OmniRelationEntity>
      | ObjectLiteral
      | string,
    fields?: (keyof OmniRelationEntity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<OmniRelationEntity>;
  override async getEntity(
    conditions:
      | FindOptionsWhere<OmniRelationEntity>[]
      | FindOptionsWhere<OmniRelationEntity>
      | ObjectLiteral
      | string,
    fields?: (keyof OmniRelationEntity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<OmniRelationEntity | undefined> {
    const entity = await super.getEntity(
      this.withDefinitionConditions(conditions),
      fields,
      relations,
      databaseName,
      options as never,
    );
    return entity ? this.publicEntity(entity) : entity;
  }

  override async getEntityListExtended(
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    withCount?: false,
    relations?: string[],
    databaseName?: string,
  ): Promise<OmniRelationEntity[]>;
  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<OmniRelationEntity>,
    withCount: true,
    relations?: string[],
    databaseName?: string,
  ): Promise<[OmniRelationEntity[], number]>;
  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<OmniRelationEntity> = {},
    withCount = false,
    relations?: string[],
    databaseName?: string,
  ): Promise<OmniRelationEntity[] | [OmniRelationEntity[], number]> {
    this.rejectFixedFilters(findOptions.where);
    const where = {
      operator: Operators.AND,
      filters: this.definitionFilters(),
      ...(findOptions.where ? { childExpressions: [findOptions.where] } : {}),
    };
    if (withCount) {
      const result = await super.getEntityListExtended(
        { ...findOptions, where },
        true,
        relations,
        databaseName,
      );
      return [result[0].map((entity) => this.publicEntity(entity)), result[1]];
    }
    const result = await super.getEntityListExtended(
      { ...findOptions, where },
      false,
      relations,
      databaseName,
    );
    return result.map((entity) => this.publicEntity(entity));
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    _findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: true,
  ): Promise<OmniRelationEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    _findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRelationEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    _findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity = true,
  ): Promise<OmniRelationEntity | boolean> {
    const normalized = this.normalizeInput(input as Record<string, unknown>);
    this.rejectFixedFields(normalized);
    this.rejectImmutableEndpoints(normalized);
    this.validatePayload(normalized);
    const expectedRevision = normalized.expectedRevision;
    if (
      typeof expectedRevision !== 'number' ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1 ||
      expectedRevision >= PROJECTION_INTEGER_MAX
    ) {
      throw new BadRequestException(
        `expectedRevision must be an integer between 1 and ${PROJECTION_INTEGER_MAX - 1}.`,
      );
    }
    const fixedConditions = this.withDefinitionConditions(
      this.normalizeConditions(conditions),
    ) as FindOptionsWhere<OmniRelationEntity>;
    const { expectedRevision: _expectedRevision, ...changes } = normalized;
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Omni relation update requires metadata.');
    }
    const result = await this.mutate(async (manager) => {
      const repository = manager.getRepository(OmniRelationEntity);
      const current = await repository.findOne({ where: fixedConditions });
      if (!current) this.notFound();
      if (current.revision !== expectedRevision) {
        throw new ConflictException('Omni relation revision conflict.');
      }
      await this.assertRelation(
        { ...current, ...changes },
        manager.getRepository(OmniRecordEntity),
      );
      await this.lifecycle?.beforeUpdate?.({
        definition: this.definition,
        scope: this.scope,
        manager,
        readers: this.readers(manager),
        input: this.publicInput(normalized),
        current,
      });
      const result = await repository
        .createQueryBuilder()
        .update()
        .set({ ...changes, revision: () => '"revision" + 1' } as never)
        .where('"scopeId" = :scopeId', { scopeId: this.scopeId })
        .andWhere('"guid" = :guid', { guid: current.guid })
        .andWhere('"revision" = :expectedRevision', { expectedRevision })
        .andWhere('"kind" IN (:...kinds)', {
          kinds: [...getOmniRelationProjectionAllowedKinds(this.definition)],
        })
        .andWhere('"status" = :status', {
          status: this.definition.relation.status ?? OmniRelationStatus.Active,
        })
        .andWhere(
          this.definition.relation.schema
            ? '"payloadSchemaId" = :schemaId AND "payloadSchemaVersion" = :schemaVersion'
            : '"payloadSchemaId" IS NULL AND "payloadSchemaVersion" IS NULL',
          this.definition.relation.schema
            ? {
                schemaId: this.definition.relation.schema.id,
                schemaVersion: this.definition.relation.schema.version,
              }
            : {},
        )
        .execute();
      if (result.affected !== 1) {
        const existing = await repository.findOne({ where: fixedConditions });
        if (!existing) this.notFound();
        throw new ConflictException('Omni relation revision conflict.');
      }
      if (!returnEntity) return true;
      return repository.findOneOrFail({ where: fixedConditions });
    });
    return typeof result === 'boolean' ? result : this.publicEntity(result);
  }

  override async deleteEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
  ): Promise<boolean> {
    const fixedConditions = this.withDefinitionConditions(
      this.normalizeConditions(conditions),
    ) as FindOptionsWhere<OmniRelationEntity>;
    if (!this.lifecycle) return super.deleteEntity(fixedConditions);
    return this.mutate(async (manager) => {
      const repository = manager.getRepository(OmniRelationEntity);
      const current = await repository.findOne({ where: fixedConditions });
      if (!current) this.notFound();
      await this.lifecycle!.beforeDelete?.({
        definition: this.definition,
        scope: this.scope,
        manager,
        readers: this.readers(manager),
        input: {},
        current,
      });
      const result =
        this.relationDeletion === 'hard'
          ? await repository.delete(fixedConditions)
          : await repository.update(fixedConditions, { deletedAt: new Date() });
      if (result.affected !== 1) this.notFound();
      return true;
    });
  }

  protected override assertEndpointKinds(
    source: OmniRecordEntity,
    target: OmniRecordEntity,
  ): void {
    if (
      source.kind !== this.definition.relation.sourceKind ||
      target.kind !== this.definition.relation.targetKind
    ) {
      throw new BadRequestException(
        'Omni relation endpoints do not match the registered resource kinds.',
      );
    }
  }

  private createValues(
    input: Record<string, unknown>,
  ): DeepPartial<OmniRelationEntity> {
    return {
      ...input,
      kind: input.kind as string,
      status: this.definition.relation.status ?? OmniRelationStatus.Active,
      ...(this.definition.relation.schema
        ? {
            payloadSchemaId: this.definition.relation.schema.id,
            payloadSchemaVersion: this.definition.relation.schema.version,
          }
        : {}),
    } as DeepPartial<OmniRelationEntity>;
  }

  private publicEntity(entity: OmniRelationEntity): OmniRelationEntity {
    const aliases = getOmniRelationProjectionAliases(this.definition);
    return {
      ...entity,
      ...(aliases.kind === 'kind' ? {} : { [aliases.kind]: entity.kind }),
      ...(aliases.source === 'sourceRecordId'
        ? {}
        : { [aliases.source]: entity.sourceRecordId }),
      ...(aliases.target === 'targetRecordId'
        ? {}
        : { [aliases.target]: entity.targetRecordId }),
      ...(aliases.payload === 'payload'
        ? {}
        : { [aliases.payload]: entity.payload }),
    } as OmniRelationEntity;
  }

  /** Keeps lifecycle policies transport-neutral by exposing definition aliases. */
  private publicInput(
    input: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    const aliases = getOmniRelationProjectionAliases(this.definition);
    const output = { ...input };
    for (const [field, alias] of [
      ['kind', aliases.kind],
      ['sourceRecordId', aliases.source],
      ['targetRecordId', aliases.target],
      ['payload', aliases.payload],
    ] as const) {
      if (field === alias || !hasOwn(output, field)) continue;
      output[alias] = output[field];
      delete output[field];
    }
    return output;
  }

  private selectCreateKind(input: Record<string, unknown>): void {
    const allowed = getOmniRelationProjectionAllowedKinds(this.definition);
    if (allowed.length === 1) {
      if (input.kind !== undefined) {
        throw new BadRequestException('Omni relation kind is server-owned.');
      }
      input.kind = allowed[0];
      return;
    }
    if (typeof input.kind !== 'string' || !allowed.includes(input.kind)) {
      throw new BadRequestException(
        'Omni relation kind is not allowed by this resource.',
      );
    }
  }

  private normalizeInput(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = { ...input };
    const aliases = getOmniRelationProjectionAliases(this.definition);
    for (const [alias, field] of [
      [aliases.kind, 'kind'],
      [aliases.source, 'sourceRecordId'],
      [aliases.target, 'targetRecordId'],
      [aliases.payload, 'payload'],
    ] as const) {
      if (alias === field) continue;
      if (!hasOwn(normalized, alias)) continue;
      if (hasOwn(normalized, field)) {
        throw new BadRequestException(
          `Omni relation ${alias} conflicts with ${field}.`,
        );
      }
      normalized[field] = normalized[alias];
      delete normalized[alias];
    }
    return normalized;
  }

  private normalizeConditions(
    conditions: FindOptionsWhere<OmniRelationEntity>,
  ): FindOptionsWhere<OmniRelationEntity> {
    return this.normalizeInput(
      conditions as Record<string, unknown>,
    ) as FindOptionsWhere<OmniRelationEntity>;
  }

  private rejectFixedFields(
    input: Record<string, unknown>,
    allowKind = false,
  ): void {
    for (const field of [
      ...(allowKind ? [] : ['kind']),
      'status',
      'payloadSchemaId',
      'payloadSchemaVersion',
    ]) {
      if (hasOwn(input, field)) {
        throw new BadRequestException(
          `Omni relation ${field} is server-owned.`,
        );
      }
    }
  }

  private rejectImmutableEndpoints(input: Record<string, unknown>): void {
    for (const field of ['guid', 'sourceRecordId', 'targetRecordId']) {
      if (hasOwn(input, field)) {
        throw new BadRequestException(`Omni relation ${field} is immutable.`);
      }
    }
  }

  private validatePayload(input: Record<string, unknown>): void {
    if (
      hasOwn(input, 'payload') &&
      input.payload !== null &&
      (typeof input.payload !== 'object' || Array.isArray(input.payload))
    ) {
      throw new BadRequestException('payload must be a JSON object or null.');
    }
  }

  private withDefinitionConditions(
    conditions:
      | FindOptionsWhere<OmniRelationEntity>[]
      | FindOptionsWhere<OmniRelationEntity>
      | ObjectLiteral
      | string,
  ):
    | FindOptionsWhere<OmniRelationEntity>[]
    | FindOptionsWhere<OmniRelationEntity>
    | ObjectLiteral {
    if (typeof conditions === 'string') {
      return { guid: conditions, ...this.definitionFilters() };
    }
    if (Array.isArray(conditions)) {
      return conditions.map(
        (condition) =>
          this.withDefinitionConditions(
            condition,
          ) as FindOptionsWhere<OmniRelationEntity>,
      );
    }
    this.assertFixedConditions(conditions);
    return { ...conditions, ...this.definitionFilters() };
  }

  private definitionFilters(): Record<string, unknown> {
    const relation = this.definition.relation;
    return {
      kind: In([...getOmniRelationProjectionAllowedKinds(this.definition)]),
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

  private assertFixedConditions(conditions: ObjectLiteral): void {
    for (const field of Object.keys(this.definitionFilters())) {
      if (hasOwn(conditions, field)) {
        throw new BadRequestException(
          `Omni relation ${field} is server-owned.`,
        );
      }
    }
  }

  private rejectFixedFilters(where: unknown): void {
    if (!where || typeof where !== 'object') return;
    if (Array.isArray(where)) {
      where.forEach((entry) => this.rejectFixedFilters(entry));
      return;
    }
    const candidate = where as Record<string, unknown>;
    for (const field of Object.keys(this.definitionFilters())) {
      if (hasOwn(candidate, field)) {
        throw new BadRequestException(
          `Omni relation ${field} is server-owned.`,
        );
      }
    }
    if (candidate.filters && typeof candidate.filters === 'object') {
      this.rejectFixedFilters(candidate.filters);
    }
    if (Array.isArray(candidate.childExpressions)) {
      candidate.childExpressions.forEach((entry) =>
        this.rejectFixedFilters(entry),
      );
    }
  }

  private readers(manager: EntityManager) {
    return (
      this.readerCatalog ??
      createOmniProjectionReaderCatalog([
        {
          type: 'relation',
          id: this.definition.id,
          definition: this.definition,
        },
      ])
    ).bind(manager, this.scope);
  }

  private async mutate<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!this.lifecycle) return work(this.getRepositoryWrite().manager);
    if (!this.dataSource) {
      throw new TypeError(
        'Omni relation lifecycle requires a DataSource for serializable mutations.',
      );
    }
    try {
      return await this.dataSource.transaction('SERIALIZABLE', work);
    } catch (error) {
      if (isRetryableTransactionError(error)) {
        throw new ConflictException(
          'Omni projection concurrent write conflict; retry the mutation.',
        );
      }
      throw error;
    }
  }
}
