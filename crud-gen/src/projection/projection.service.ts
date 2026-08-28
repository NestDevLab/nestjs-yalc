import type { CrudGenFindManyOptions } from '../api-graphql/crud-gen-gql.interface.js';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { FindOperator, type ObjectLiteral, type Repository } from 'typeorm';
import {
  assertProjectionPayloadValue,
  assertProjectionResourceDefinition,
  getProjectionField,
  getProjectionPathValue,
  normalizeProjectionCodecValue,
  PROJECTION_INTEGER_MAX,
  setProjectionPathValue,
  type ProjectionResourceDefinition,
} from './projection-resource.js';
import type {
  ProjectionDialect,
  ProjectionFilter,
  ProjectionPatch,
  ProjectionSort,
} from './projection-dialect.js';

export interface ProjectionScope {
  readonly scopeId: string;
  cacheKey(key: string): string;
}

type FindOperatorLike = {
  type: string;
  value: unknown;
};

function hasOwn(input: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
}

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
 * Generic scoped CRUD behavior for one projection definition. The consumer
 * supplies only immutable metadata, a trusted scope context and a repository;
 * JSON paths and dialect SQL stay inside the framework.
 */
export class ProjectionResourceService<Entity extends ObjectLiteral> {
  constructor(
    private readonly repository: Repository<Entity>,
    private readonly scope: ProjectionScope,
    private readonly dialect: ProjectionDialect,
    private readonly events: YalcEventService,
    private readonly definition: ProjectionResourceDefinition,
  ) {
    assertProjectionResourceDefinition(definition);
  }

  supportsStructuredGraphqlFilters(): boolean {
    // CrudGen's public filter input can model boolean trees, but this dialect
    // adapter only has one conjunctive ProjectionFilter list. Advertising the
    // capability remains correct for the documented AND-only subset; all
    // other shapes fail before query compilation.
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
    const guid = this.guidFromConditions(conditions);
    const record = await this.repository.findOne({
      where: {
        [this.definition.scope.column]: this.scope.scopeId,
        [this.definition.identity.column]: guid,
      } as any,
    });

    if (!record && options?.failOnNull) this.notFound();
    return record ? this.project(record) : null;
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<Entity> = {},
    withCount = false,
  ): Promise<Entity[] | [Entity[], number]> {
    const page = this.pageFromFindOptions(findOptions);
    const [records, count] = await this.dialect.findMany(
      this.repository,
      this.definition,
      this.scope.scopeId,
      this.filtersFromFindOptions(findOptions),
      this.sortingFromFindOptions(findOptions),
      page,
    );
    const projected = records.map((record) => this.project(record));
    return withCount ? [projected, count] : projected;
  }

  async createEntity(input: Record<string, unknown>): Promise<Entity> {
    this.rejectUnknownInput(input, true);

    const entity: Record<string, unknown> = {
      [this.definition.scope.column]: this.scope.scopeId,
      [this.definition.revision.column]: 1,
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
        entity[field.column ?? field.name] = this.normalizeValue(field, value);
      }
    }

    let saved: Entity;
    try {
      saved = await this.repository.save(
        this.repository.create(entity as any) as unknown as Entity,
      );
    } catch (error) {
      if (this.dialect.isScopedIdentityConflict(error, this.definition)) {
        throw this.events.errorConflict('projection.identity.conflict', {
          response: {
            message: 'Projection identity already exists in this scope.',
          },
        });
      }
      throw error;
    }
    return this.project(saved);
  }

  async updateEntity(
    conditions: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<Entity> {
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

    const patch: ProjectionPatch = {
      scopeId: this.scope.scopeId,
      guid,
      expectedRevision,
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

    const affected = await this.dialect.patch(
      this.repository,
      this.definition,
      patch,
    );
    if (affected === 0) {
      const current = await this.repository.findOne({
        where: {
          [this.definition.scope.column]: this.scope.scopeId,
          [this.definition.identity.column]: guid,
        } as any,
      });
      if (!current) this.notFound();
      throw this.events.errorConflict('projection.revision.conflict', {
        response: { message: 'Projection resource revision is stale.' },
      });
    }

    const updated = await this.repository.findOneOrFail({
      where: {
        [this.definition.scope.column]: this.scope.scopeId,
        [this.definition.identity.column]: guid,
      } as any,
    });
    return this.project(updated);
  }

  async deleteEntity(conditions: Record<string, unknown>): Promise<boolean> {
    const result = await this.repository.delete({
      [this.definition.scope.column]: this.scope.scopeId,
      [this.definition.identity.column]: this.guidFromConditions(conditions),
    } as any);
    if (!result.affected) this.notFound();
    return true;
  }

  private createPayload(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const initial = input.payload;
    if (initial !== undefined) {
      try {
        assertProjectionPayloadValue(initial);
      } catch (error) {
        this.invalid(
          error instanceof Error
            ? error.message
            : 'Projection payload must be a JSON object.',
        );
      }
    }
    let payload = (initial ? structuredClone(initial) : {}) as Record<
      string,
      unknown
    >;

    for (const field of this.definition.fields) {
      if (field.storage !== 'json' || input[field.name] === undefined) continue;
      if (getProjectionPathValue(payload, field.path ?? []) !== undefined) {
        this.invalid(
          `Projection field ${field.name} cannot be supplied both in payload and as a projected input.`,
        );
      }
      payload = setProjectionPathValue(
        payload,
        field.path ?? [],
        this.normalizeValue(field, input[field.name]),
      );
    }

    for (const field of this.definition.fields) {
      if (field.storage !== 'json') continue;
      const value = getProjectionPathValue(payload, field.path ?? []);
      if (value === undefined) continue;
      payload = setProjectionPathValue(
        payload,
        field.path ?? [],
        this.normalizeValue(field, value),
      );
    }
    return payload;
  }

  private project(record: Entity): Entity {
    const projected = {
      ...(record as Record<string, unknown>),
      [this.definition.payload.column]:
        (record as Record<string, unknown>)[this.definition.payload.column] ??
        {},
    };
    const payload = projected[this.definition.payload.column] as Record<
      string,
      unknown
    >;
    for (const field of this.definition.fields) {
      if (field.storage !== 'json') continue;
      const value = getProjectionPathValue(payload, field.path ?? []);
      projected[field.name] =
        value === undefined && field.nullable ? null : value;
    }
    return projected as Entity;
  }

  private filtersFromFindOptions(
    findOptions: CrudGenFindManyOptions<Entity>,
  ): ProjectionFilter[] {
    const where = findOptions.where;
    if (where === undefined) return [];
    const filters: ProjectionFilter[] = [];
    const visit = (current: unknown): void => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        this.invalid('Projection filters must use an AND-only expression.');
      }

      const candidate = current as {
        operator?: unknown;
        filters?: unknown;
        childExpressions?: unknown;
      };
      const supportedKeys = new Set([
        'operator',
        'filters',
        'childExpressions',
      ]);
      if (Object.keys(candidate).some((key) => !supportedKeys.has(key))) {
        this.invalid('Projection filters must use an AND-only expression.');
      }
      if (candidate.operator !== undefined && candidate.operator !== 'AND') {
        this.invalid('Projection filters must use an AND-only expression.');
      }
      if (
        candidate.filters !== undefined &&
        (!candidate.filters ||
          typeof candidate.filters !== 'object' ||
          Array.isArray(candidate.filters))
      ) {
        this.invalid('Projection filters must use an AND-only expression.');
      }

      for (const [name, condition] of Object.entries(candidate.filters ?? {})) {
        const field = this.projectionField(name, 'filter');
        if (isFindOperator(condition)) {
          if (condition.type === 'equal') {
            this.assertFilterAllowed(field, 'eq');
            filters.push({
              field,
              operator: 'eq',
              values: this.normalizeFilterValues(field, [condition.value]),
            });
          } else if (condition.type === 'between') {
            this.assertFilterAllowed(field, 'range');
            filters.push({
              field,
              operator: 'range',
              values: this.normalizeFilterValues(
                field,
                condition.value as unknown[],
                2,
              ),
            });
          } else if (
            condition.type === 'in' &&
            name === this.definition.identity.column
          ) {
            filters.push({
              field,
              operator: 'in',
              values: this.normalizeFilterValues(
                field,
                condition.value as unknown[],
                null,
              ),
            });
          } else {
            this.invalid(`Unsupported projection filter for ${name}.`);
          }
        } else {
          this.assertFilterAllowed(field, 'eq');
          filters.push({
            field,
            operator: 'eq',
            values: this.normalizeFilterValues(field, [condition]),
          });
        }
      }

      if (candidate.childExpressions === undefined) return;
      if (!Array.isArray(candidate.childExpressions)) {
        this.invalid('Projection filters must use an AND-only expression.');
      }
      candidate.childExpressions.forEach((child) => visit(child));
    };

    visit(where);
    return filters;
  }

  private sortingFromFindOptions(
    findOptions: CrudGenFindManyOptions<Entity>,
  ): ProjectionSort[] {
    return Object.entries(findOptions.order ?? {}).map(([name, direction]) => {
      const field = this.projectionField(name, 'sort');
      if (!field.query?.sort)
        this.invalid(`Projection field ${name} is not sortable.`);
      if (direction !== 'ASC' && direction !== 'DESC') {
        this.invalid(`Projection field ${name} has an invalid sort direction.`);
      }
      return { field, direction };
    });
  }

  private pageFromFindOptions(findOptions: CrudGenFindManyOptions<Entity>): {
    skip?: number;
    take?: number;
  } {
    const { skip, take } = findOptions;
    if (
      skip !== undefined &&
      (!Number.isSafeInteger(skip) || Number(skip) < 0)
    ) {
      this.invalid('Projection skip must be a non-negative safe integer.');
    }
    if (
      take !== undefined &&
      (!Number.isSafeInteger(take) || Number(take) < 1)
    ) {
      this.invalid('Projection take must be a positive safe integer.');
    }
    return { skip, take };
  }

  private projectionField(
    name: string,
    purpose: 'filter' | 'sort',
  ): ProjectionResourceDefinition['fields'][number] {
    try {
      return getProjectionField(this.definition, name);
    } catch {
      this.invalid(`Projection ${purpose} field ${name} is not declared.`);
    }
  }

  private assertFilterAllowed(
    field: ProjectionResourceDefinition['fields'][number],
    operator: 'eq' | 'range',
  ): void {
    if (!field.query?.filter?.includes(operator)) {
      this.invalid(
        `Projection field ${field.name} does not allow ${operator}.`,
      );
    }
  }

  private normalizeFilterValues(
    field: ProjectionResourceDefinition['fields'][number],
    values: readonly unknown[],
    expectedLength: number | null = 1,
  ): unknown[] {
    if (expectedLength !== null && values.length !== expectedLength) {
      this.invalid(
        `Projection field ${field.name} requires ${expectedLength} filter value${expectedLength === 1 ? '' : 's'}.`,
      );
    }
    if (values.length === 0) {
      this.invalid(`Projection field ${field.name} requires filter values.`);
    }
    if (values.some((value) => value === null || value === undefined)) {
      this.invalid(
        `Projection field ${field.name} does not support null filters.`,
      );
    }
    return values.map((value) => this.normalizeValue(field, value));
  }

  private normalizeValue(
    field: ProjectionResourceDefinition['fields'][number],
    value: unknown,
  ): unknown {
    try {
      return normalizeProjectionCodecValue(field, value);
    } catch (error) {
      this.invalid(
        error instanceof Error
          ? error.message
          : `Projection field ${field.name} has an invalid value.`,
      );
    }
  }

  private guidFromConditions(conditions: Record<string, unknown>): string {
    const identity = this.definition.identity.column;
    if (
      Reflect.ownKeys(conditions).length !== 1 ||
      !hasOwn(conditions, identity) ||
      typeof conditions[identity] !== 'string'
    ) {
      this.invalid(
        `Projection resource conditions require only a ${identity}.`,
      );
    }
    return conditions[identity] as string;
  }

  private rejectUnknownInput(
    input: Record<string, unknown>,
    creating: boolean,
  ): void {
    const identity = this.definition.identity.column;
    if (!creating && hasOwn(input, identity)) {
      this.invalid(`Projection identity ${identity} is immutable.`);
    }
    const allowed = new Set([
      ...this.definition.fields
        .filter((field) => creating || field.name !== identity)
        .map((field) => field.name),
      ...(creating && this.definition.payload.allowCreate ? ['payload'] : []),
      ...(!creating ? ['expectedRevision'] : []),
    ]);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key))
        this.invalid(`Projection input field ${key} is not writable.`);
    }
  }

  private invalid(message: string): never {
    throw this.events.errorBadRequest('projection.invalid-request', {
      response: { message },
    });
  }

  private notFound(): never {
    throw this.events.errorNotFound('projection.resource.not-found', {
      response: { message: 'Projection resource not found.' },
    });
  }
}
