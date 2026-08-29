import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import type { IWhereCondition } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.type.js';
import { Operators } from '@nestjs-yalc/crud-gen/crud-gen.enum.js';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service.js';
import type { DeepPartial, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { IsNull } from 'typeorm';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';

type ScopedEntity = ObjectLiteral & {
  scopeId: string;
  deletedAt?: Date | null;
};

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

/**
 * The shared service boundary for scoped Omni CRUD. Every lookup, mutation,
 * and generated grid is scoped before it reaches the generic CrudGen service.
 */
export class OmniScopedService<
  Entity extends ScopedEntity,
> extends GenericService<Entity> {
  constructor(
    repository: any,
    scopeOrRepositoryWrite?: OmniScope | any,
    private readonly deletion: OmniDeletePolicy = 'hard',
  ) {
    const scope = isOmniScope(scopeOrRepositoryWrite)
      ? scopeOrRepositoryWrite
      : defaultOmniScope;
    super(
      repository,
      isOmniScope(scopeOrRepositoryWrite) ? undefined : scopeOrRepositoryWrite,
    );
    this.scope = scope;
  }

  protected readonly scope: OmniScope;

  protected get scopeId(): string {
    return this.scope.scopeId;
  }

  protected scopedConditions(
    conditions: FindOptionsWhere<Entity>,
  ): FindOptionsWhere<Entity> {
    this.rejectClientScope(conditions as object);
    return {
      ...conditions,
      scopeId: this.scopeId,
      ...(this.deletion === 'tombstone' ? { deletedAt: IsNull() } : {}),
    } as unknown as FindOptionsWhere<Entity>;
  }

  override async getEntity(
    conditions:
      | FindOptionsWhere<Entity>[]
      | FindOptionsWhere<Entity>
      | ObjectLiteral
      | string,
    fields?: (keyof Entity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull: false },
  ): Promise<Entity | undefined>;
  override async getEntity(
    conditions:
      | FindOptionsWhere<Entity>[]
      | FindOptionsWhere<Entity>
      | ObjectLiteral
      | string,
    fields?: (keyof Entity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<Entity>;
  override async getEntity(
    conditions:
      | FindOptionsWhere<Entity>[]
      | FindOptionsWhere<Entity>
      | ObjectLiteral
      | string,
    fields?: (keyof Entity)[],
    relations?: string[],
    databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<Entity | undefined> {
    const entity = await super.getEntity(
      this.scopedWhere(conditions),
      fields,
      relations,
      databaseName,
      { failOnNull: false },
    );
    if (!entity && options?.failOnNull) this.notFound();
    return entity;
  }

  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    withCount?: false,
    relations?: string[],
    databaseName?: string,
  ): Promise<Entity[]>;
  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    withCount: true,
    relations?: string[],
    databaseName?: string,
  ): Promise<[Entity[], number]>;
  override async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Entity> = {},
    withCount = false,
    relations?: string[],
    databaseName?: string,
  ): Promise<Entity[] | [Entity[], number]> {
    const scopedOptions = this.scopeFindOptions(findOptions);
    if (withCount) {
      return super.getEntityListExtended(
        scopedOptions,
        true,
        relations,
        databaseName,
      );
    }
    return super.getEntityListExtended(
      scopedOptions,
      false,
      relations,
      databaseName,
    );
  }

  private scopeFindOptions(
    findOptions: CrudGenFindManyOptions<Entity>,
  ): CrudGenFindManyOptions<Entity> {
    this.rejectScopeInWhere(findOptions.where);
    const userWhere = findOptions.where;
    const filters: IWhereCondition<Entity>['filters'] = {};
    filters.scopeId = this.scopeId;
    if (this.deletion === 'tombstone') filters.deletedAt = IsNull();
    const where: IWhereCondition<Entity> = {
      operator: Operators.AND,
      filters,
      ...(userWhere ? { childExpressions: [userWhere] } : {}),
    };
    return {
      ...findOptions,
      where,
      ...(findOptions.subQueryFilters
        ? {
            subQueryFilters: this.scopeFindOptions(findOptions.subQueryFilters),
          }
        : {}),
    };
  }

  override async createEntity(
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity?: true,
  ): Promise<Entity>;
  override async createEntity(
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity?: boolean,
  ): Promise<Entity | boolean>;
  override async createEntity(
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity = true,
  ): Promise<Entity | boolean> {
    this.rejectServerFields(input as object);
    this.validatePayloadContract(input as object);
    return super.createEntity(
      { ...input, scopeId: this.scopeId } as DeepPartial<Entity>,
      findOptions,
      returnEntity,
    );
  }

  override async updateEntity(
    conditions: FindOptionsWhere<Entity>,
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity?: true,
  ): Promise<Entity>;
  override async updateEntity(
    conditions: FindOptionsWhere<Entity>,
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity?: boolean,
  ): Promise<Entity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<Entity>,
    input: DeepPartial<Entity>,
    findOptions?: CrudGenFindManyOptions<Entity>,
    returnEntity = true,
  ): Promise<Entity | boolean> {
    this.rejectServerFields(input as object);
    this.validatePayloadContract(input as object);
    if (hasOwn(input as object, 'guid')) {
      throw new BadRequestException('guid is immutable.');
    }
    return super.updateEntity(
      this.scopedConditions(conditions),
      { ...input, scopeId: this.scopeId } as DeepPartial<Entity>,
      findOptions,
      returnEntity,
    );
  }

  override async deleteEntity(
    conditions: FindOptionsWhere<Entity>,
  ): Promise<boolean> {
    const scoped = this.scopedConditions(conditions);
    if (this.deletion === 'hard') {
      return super.deleteEntity(scoped);
    }
    const result = await this.getRepository().update(scoped, {
      deletedAt: new Date(),
    } as DeepPartial<Entity>);
    if (!result.affected) this.notFound();
    return true;
  }

  protected rejectServerFields(input: object): void {
    for (const field of ['scopeId', 'revision', 'deletedAt']) {
      if (hasOwn(input, field)) {
        throw new BadRequestException(`${field} is server-owned.`);
      }
    }
  }

  protected rejectClientScope(input: object): void {
    if (hasOwn(input, 'scopeId')) {
      throw new BadRequestException('scopeId is derived from server context.');
    }
  }

  private validatePayloadContract(input: object): void {
    const candidate = input as Record<string, unknown>;
    if (
      hasOwn(candidate, 'payload') &&
      candidate.payload !== null &&
      (typeof candidate.payload !== 'object' ||
        Array.isArray(candidate.payload))
    ) {
      throw new BadRequestException('payload must be a JSON object or null.');
    }

    const hasSchemaId = hasOwn(candidate, 'payloadSchemaId');
    const hasSchemaVersion = hasOwn(candidate, 'payloadSchemaVersion');
    if (hasSchemaId !== hasSchemaVersion) {
      throw new BadRequestException(
        'payloadSchemaId and payloadSchemaVersion must be supplied together.',
      );
    }
    if (!hasSchemaId) return;

    if (
      typeof candidate.payloadSchemaId !== 'string' ||
      candidate.payloadSchemaId.trim().length === 0 ||
      candidate.payloadSchemaId.length > 128
    ) {
      throw new BadRequestException(
        'payloadSchemaId must be a non-empty string.',
      );
    }
    if (
      typeof candidate.payloadSchemaVersion !== 'number' ||
      !Number.isInteger(candidate.payloadSchemaVersion) ||
      candidate.payloadSchemaVersion < 1 ||
      candidate.payloadSchemaVersion > 2_147_483_647
    ) {
      throw new BadRequestException(
        'payloadSchemaVersion must be a positive signed 32-bit integer.',
      );
    }
  }

  protected notFound(): never {
    throw new NotFoundException('Omni resource was not found in this scope.');
  }

  private scopedWhere(
    where:
      | FindOptionsWhere<Entity>[]
      | FindOptionsWhere<Entity>
      | ObjectLiteral
      | string,
  ): FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] {
    if (typeof where === 'string') {
      throw new BadRequestException(
        'String where clauses are not supported for scoped Omni resources.',
      );
    }
    if (Array.isArray(where)) {
      return where.map((condition) => this.scopedConditions(condition));
    }
    return this.scopedConditions(where as FindOptionsWhere<Entity>);
  }

  private rejectScopeInWhere(where: unknown): void {
    if (!where || typeof where !== 'object') return;
    if (Array.isArray(where)) {
      where.forEach((item) => this.rejectScopeInWhere(item));
      return;
    }
    const candidate = where as Record<string, unknown>;
    if (hasOwn(candidate, 'scopeId')) this.rejectClientScope(candidate);
    if (candidate.filters && typeof candidate.filters === 'object') {
      this.rejectScopeInWhere(candidate.filters);
    }
    if (Array.isArray(candidate.childExpressions)) {
      candidate.childExpressions.forEach((item) =>
        this.rejectScopeInWhere(item),
      );
    }
  }
}

function isOmniScope(value: unknown): value is OmniScope {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as OmniScope).scopeId === 'string' &&
    typeof (value as OmniScope).cacheKey === 'function'
  );
}

const defaultOmniScope: OmniScope = {
  scopeId: 'default',
  cacheKey: (key) => `default:${key}`,
};
