import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type {
  CrudGenFindManyOptions,
  ProjectionScope,
} from '@nestjs-yalc/crud-gen';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { FindOperator, In, type ObjectLiteral, type Repository } from 'typeorm';

type ProjectionRequest = {
  projectionScopeId?: string;
  req?: { projectionScopeId?: string };
};

@Injectable({ scope: Scope.REQUEST })
export class ProjectionScopeContext implements ProjectionScope {
  readonly scopeId: string;

  constructor(@Inject(REQUEST) request: ProjectionRequest) {
    const scopeId = request.projectionScopeId ?? request.req?.projectionScopeId;
    if (!scopeId) {
      throw new Error('Projection scope context is unavailable.');
    }
    this.scopeId = scopeId;
  }

  cacheKey(key: string): string {
    return `${this.scopeId}:${key}`;
  }
}

type ProjectionSpikeRelationDefinition = {
  identity: string;
  scope: string;
  source: string;
  target: string;
  fields: readonly string[];
  mutableFields: readonly string[];
};

type FindOperatorLike = { type: string; value: unknown };

function isFindOperator(value: unknown): value is FindOperatorLike {
  return (
    value instanceof FindOperator ||
    (!!value &&
      typeof value === 'object' &&
      'type' in value &&
      'value' in value)
  );
}

/**
 * Test-fixture relation service retained only to exercise scoped endpoints in
 * the disposable spike. B2 owns the future generic relation contract.
 */
export class ProjectionSpikeRelationService<Entity extends ObjectLiteral> {
  constructor(
    private readonly repository: Repository<Entity>,
    private readonly endpoints: Repository<ObjectLiteral>,
    private readonly scope: ProjectionScope,
    private readonly events: YalcEventService,
    private readonly definition: ProjectionSpikeRelationDefinition,
  ) {}

  supportsStructuredGraphqlFilters(): boolean {
    return true;
  }

  supportsExtendedRepository(): boolean {
    return true;
  }

  async getEntity(
    conditions: Record<string, unknown>,
    _fields?: string[],
    _relations?: string[],
    _databaseName?: string,
    options?: { failOnNull?: boolean },
  ): Promise<Entity | null> {
    const relation = await this.repository.findOne({
      where: {
        [this.definition.scope]: this.scope.scopeId,
        [this.definition.identity]: this.identity(conditions),
      } as never,
    });
    if (!relation && options?.failOnNull) this.notFound();
    return relation;
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Entity> = {},
    withCount = false,
  ): Promise<Entity[] | [Entity[], number]> {
    const where: Record<string, unknown> = {
      [this.definition.scope]: this.scope.scopeId,
    };
    const filter = (findOptions.where as { filters?: Record<string, unknown> })
      ?.filters?.[this.definition.identity];
    if (isFindOperator(filter) && filter.type === 'in') {
      where[this.definition.identity] = In(filter.value as string[]);
    } else if (typeof filter === 'string') {
      where[this.definition.identity] = filter;
    }
    const [relations, count] = await this.repository.findAndCount({
      where: where as never,
      order: { [this.definition.identity]: 'ASC' } as never,
      skip: findOptions.skip,
      take: findOptions.take,
    });
    return withCount ? [relations, count] : relations;
  }

  async createEntity(input: Record<string, unknown>): Promise<Entity> {
    this.rejectUnknown(input, this.definition.fields);
    const source = this.requiredString(input, this.definition.source);
    const target = this.requiredString(input, this.definition.target);
    const count = await this.endpoints.count({
      where: [
        { [this.definition.scope]: this.scope.scopeId, guid: source },
        { [this.definition.scope]: this.scope.scopeId, guid: target },
      ],
    });
    if (count !== 2) this.notFound();

    return this.repository.save(
      this.repository.create({
        [this.definition.scope]: this.scope.scopeId,
        ...Object.fromEntries(
          this.definition.fields.map((field) => [
            field,
            this.requiredString(input, field),
          ]),
        ),
      } as never) as unknown as Entity,
    );
  }

  async updateEntity(
    conditions: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<Entity> {
    this.rejectUnknown(input, this.definition.mutableFields);
    const updates = Object.fromEntries(
      this.definition.mutableFields.map((field) => [
        field,
        this.requiredString(input, field),
      ]),
    );
    const result = await this.repository.update(
      {
        [this.definition.scope]: this.scope.scopeId,
        [this.definition.identity]: this.identity(conditions),
      } as never,
      updates as never,
    );
    if (!result.affected) this.notFound();
    return this.repository.findOneByOrFail({
      [this.definition.scope]: this.scope.scopeId,
      [this.definition.identity]: this.identity(conditions),
    } as never);
  }

  async deleteEntity(conditions: Record<string, unknown>): Promise<boolean> {
    const result = await this.repository.delete({
      [this.definition.scope]: this.scope.scopeId,
      [this.definition.identity]: this.identity(conditions),
    } as never);
    if (!result.affected) this.notFound();
    return true;
  }

  private identity(conditions: Record<string, unknown>): string {
    return this.requiredString(conditions, this.definition.identity);
  }

  private requiredString(
    input: Record<string, unknown>,
    field: string,
  ): string {
    if (typeof input[field] !== 'string' || input[field].length === 0) {
      throw this.events.errorBadRequest('scoped-relation.invalid-request', {
        response: { message: `${field} must be a non-empty string.` },
      });
    }
    return input[field] as string;
  }

  private rejectUnknown(
    input: Record<string, unknown>,
    allowed: readonly string[],
  ): void {
    for (const key of Object.keys(input)) {
      if (!allowed.includes(key)) {
        throw this.events.errorBadRequest('scoped-relation.invalid-request', {
          response: { message: `Relation field ${key} is not writable.` },
        });
      }
    }
  }

  private notFound(): never {
    throw this.events.errorNotFound('scoped-relation.not-found', {
      response: { message: 'Relation endpoint is outside this scope.' },
    });
  }
}
