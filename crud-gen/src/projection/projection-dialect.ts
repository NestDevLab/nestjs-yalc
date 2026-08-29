import type { DataSource, ObjectLiteral, Repository } from 'typeorm';
import {
  assertProjectionResourceDefinition,
  getProjectionField,
  normalizeProjectionCodecValue,
  type ProjectionFieldDefinition,
  type ProjectionFilterOperator,
  type ProjectionResourceDefinition,
} from './projection-resource.js';

export interface ProjectionFilter {
  field: ProjectionFieldDefinition;
  operator: ProjectionFilterOperator | 'in';
  values: readonly unknown[];
}

export interface ProjectionSort {
  field: ProjectionFieldDefinition;
  direction: 'ASC' | 'DESC';
}

export interface ProjectionPage {
  skip?: number;
  take?: number;
}

export interface ProjectionPatch {
  scopeId: string;
  guid: string;
  expectedRevision: number;
  columnValues: Record<string, unknown>;
  jsonValues: Array<{
    field: ProjectionFieldDefinition;
    value: unknown;
  }>;
}

/**
 * Applies projected values when optimistic concurrency is owned by a related
 * record rather than by the projection table itself. The dialect still owns
 * every JSON mutation; the caller owns the surrounding transaction and its
 * revision predicate.
 */
export interface ProjectionValuePatch {
  scopeId: string;
  guid: string;
  columnValues: Record<string, unknown>;
  jsonValues: Array<{
    field: ProjectionFieldDefinition;
    value: unknown;
  }>;
}

export interface ProjectionDialectEvidence {
  payloadStorage: string;
  indexes: string[];
  validJson: boolean;
}

export interface ProjectionQueryPlan {
  lines: string[];
  usesDeclaredIndex: boolean;
}

export interface ProjectionDialect {
  readonly name: 'sqlite' | 'postgres';
  readonly payloadColumnType: 'simple-json' | 'jsonb';
  compileIndexStatements(
    definition: ProjectionResourceDefinition,
  ): readonly string[];
  isScopedIdentityConflict(
    error: unknown,
    definition: ProjectionResourceDefinition,
  ): boolean;
  findMany<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    scopeId: string,
    filters: readonly ProjectionFilter[],
    sorting: readonly ProjectionSort[],
    page: ProjectionPage,
  ): Promise<[Entity[], number]>;
  patch<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    patch: ProjectionPatch,
  ): Promise<number>;
  patchValues<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    patch: ProjectionValuePatch,
  ): Promise<number>;
  inspect(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<ProjectionDialectEvidence>;
  explainIndexedEquality(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
    field: ProjectionFieldDefinition,
    scopeId: string,
    value: unknown,
  ): Promise<ProjectionQueryPlan>;
}

abstract class BaseProjectionDialect implements ProjectionDialect {
  abstract readonly name: 'sqlite' | 'postgres';
  abstract readonly payloadColumnType: 'simple-json' | 'jsonb';

  protected quote(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
  }

  protected reference(alias: string, column: string): string {
    return `${this.quote(alias)}.${this.quote(column)}`;
  }

  protected driverError(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') return {};
    const candidate = error as { driverError?: unknown };
    return candidate.driverError && typeof candidate.driverError === 'object'
      ? (candidate.driverError as Record<string, unknown>)
      : (error as Record<string, unknown>);
  }

  protected projectionValueExpression(
    field: ProjectionFieldDefinition,
    references: { payload: string; column?: string },
  ): string {
    const value =
      field.storage === 'column'
        ? references.column!
        : this.jsonValueExpression(references.payload, field.path ?? []);
    return this.codecExpression(value, field.codec);
  }

  protected columnExpression(
    alias: string,
    definition: ProjectionResourceDefinition,
    field: ProjectionFieldDefinition,
  ): string {
    return this.projectionValueExpression(field, {
      payload: this.reference(alias, definition.payload.column),
      column: this.reference(alias, field.column ?? field.name),
    });
  }

  protected definitionExpression(
    definition: ProjectionResourceDefinition,
    field: ProjectionFieldDefinition,
  ): string {
    return this.projectionValueExpression(field, {
      payload: this.quote(definition.payload.column),
      column: this.quote(field.column ?? field.name),
    });
  }

  protected abstract jsonValueExpression(
    payloadReference: string,
    path: readonly string[],
  ): string;

  protected codecExpression(
    expression: string,
    codec: ProjectionFieldDefinition['codec'],
  ): string {
    if (codec === 'integer') return `CAST(${expression} AS BIGINT)`;
    if (codec === 'boolean') return this.booleanExpression(expression);
    if (codec === 'string' || codec === 'uuid' || codec === 'instant')
      return `CAST(${expression} AS TEXT)`;
    throw new TypeError(
      'Projection JSON values cannot be used in SQL queries.',
    );
  }

  protected abstract booleanExpression(expression: string): string;

  protected abstract jsonPatchExpression(
    payloadColumn: string,
    changes: ProjectionPatch['jsonValues'],
  ): { expression: string; parameters: Record<string, string> };

  abstract inspect(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<ProjectionDialectEvidence>;

  abstract isScopedIdentityConflict(
    error: unknown,
    definition: ProjectionResourceDefinition,
  ): boolean;

  compileIndexStatements(
    definition: ProjectionResourceDefinition,
  ): readonly string[] {
    assertProjectionResourceDefinition(definition);
    return definition.fields.flatMap((field) => {
      if (!field.index) return [];
      const expression = this.definitionExpression(definition, field);
      return [
        `CREATE INDEX ${this.quote(field.index.name)} ON ${this.quote(
          definition.tableName,
        )} (${this.quote(definition.scope.column)}, ${expression}, ${this.quote(
          definition.identity.column,
        )})`,
      ];
    });
  }

  async findMany<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    scopeId: string,
    filters: readonly ProjectionFilter[],
    sorting: readonly ProjectionSort[],
    page: ProjectionPage,
  ): Promise<[Entity[], number]> {
    assertProjectionResourceDefinition(definition);
    const alias = 'projection';
    const query = repository.createQueryBuilder(alias);
    query.where(
      `${this.reference(alias, definition.scope.column)} = :projection_scope_id`,
      { projection_scope_id: scopeId },
    );

    filters.forEach((filter, index) => {
      const field = getProjectionField(definition, filter.field.name);
      const expression = this.columnExpression(alias, definition, field);
      const parameter = `projection_filter_${index}`;
      const values = filter.values.map((value) =>
        normalizeProjectionCodecValue(field, value),
      );
      if (filter.operator === 'eq') {
        query.andWhere(`${expression} = :${parameter}`, {
          [parameter]: values[0],
        });
      } else if (filter.operator === 'range') {
        query.andWhere(
          `${expression} BETWEEN :${parameter}_from AND :${parameter}_to`,
          {
            [`${parameter}_from`]: values[0],
            [`${parameter}_to`]: values[1],
          },
        );
      } else {
        query.andWhere(`${expression} IN (:...${parameter})`, {
          [parameter]: values,
        });
      }
    });

    const sorted = new Set<string>();
    for (const sort of sorting) {
      const field = getProjectionField(definition, sort.field.name);
      query.addOrderBy(
        this.columnExpression(alias, definition, field),
        sort.direction,
      );
      sorted.add(field.name);
    }
    if (!sorted.has(definition.identity.column)) {
      query.addOrderBy(
        this.reference(alias, definition.identity.column),
        'ASC',
      );
    }

    if (page.skip !== undefined) query.skip(page.skip);
    if (page.take !== undefined) query.take(page.take);

    // PostgreSQL drivers do not permit concurrent operations on the same
    // query runner connection. Keep the grid and count reads sequential so
    // this dialect contract is safe inside an ambient transaction as well.
    const records = await query.getMany();
    const count = await query.clone().getCount();
    return [records, count];
  }

  async patch<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    patch: ProjectionPatch,
  ): Promise<number> {
    assertProjectionResourceDefinition(definition);
    const setValues = this.patchSetValues(definition, patch);
    const parameters: Record<string, unknown> = {
      projection_scope_id: patch.scopeId,
      projection_guid: patch.guid,
      projection_expected_revision: patch.expectedRevision,
    };

    Object.assign(parameters, this.patchParameters(definition, patch));

    setValues[definition.revision.column] = () =>
      `${this.quote(definition.revision.column)} + 1`;

    const result = await repository
      .createQueryBuilder()
      .update()
      .set(setValues as any)
      .where(
        `${this.quote(definition.scope.column)} = :projection_scope_id AND ${this.quote(
          definition.identity.column,
        )} = :projection_guid AND ${this.quote(
          definition.revision.column,
        )} = :projection_expected_revision`,
      )
      .setParameters(parameters)
      .execute();

    return result.affected ?? 0;
  }

  async patchValues<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    definition: ProjectionResourceDefinition,
    patch: ProjectionValuePatch,
  ): Promise<number> {
    assertProjectionResourceDefinition(definition);
    const result = await repository
      .createQueryBuilder()
      .update()
      .set(this.patchSetValues(definition, patch) as any)
      .where(
        `${this.quote(definition.scope.column)} = :projection_scope_id AND ${this.quote(
          definition.identity.column,
        )} = :projection_guid`,
      )
      .setParameters({
        projection_scope_id: patch.scopeId,
        projection_guid: patch.guid,
        ...this.patchParameters(definition, patch),
      })
      .execute();

    return result.affected ?? 0;
  }

  private patchSetValues(
    definition: ProjectionResourceDefinition,
    patch: Pick<ProjectionValuePatch, 'columnValues' | 'jsonValues'>,
  ): Record<string, unknown> {
    const setValues: Record<string, unknown> = { ...patch.columnValues };
    const jsonValues = this.normalizedJsonValues(definition, patch);
    if (jsonValues.length > 0) {
      const jsonPatch = this.jsonPatchExpression(
        this.quote(definition.payload.column),
        jsonValues,
      );
      setValues[definition.payload.column] = () => jsonPatch.expression;
    }
    return setValues;
  }

  private patchParameters(
    definition: ProjectionResourceDefinition,
    patch: Pick<ProjectionValuePatch, 'columnValues' | 'jsonValues'>,
  ): Record<string, string> {
    const jsonValues = this.normalizedJsonValues(definition, patch);
    return jsonValues.length > 0
      ? this.jsonPatchExpression(
          this.quote(definition.payload.column),
          jsonValues,
        ).parameters
      : {};
  }

  private normalizedJsonValues(
    definition: ProjectionResourceDefinition,
    patch: Pick<ProjectionValuePatch, 'jsonValues'>,
  ): ProjectionPatch['jsonValues'] {
    return patch.jsonValues.map((change) => {
      const field = getProjectionField(definition, change.field.name);
      if (field.storage !== 'json') {
        throw new TypeError(
          `Projection field ${field.name} cannot be patched as JSON.`,
        );
      }
      return {
        ...change,
        field,
        value: normalizeProjectionCodecValue(field, change.value),
      };
    });
  }

  async explainIndexedEquality(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
    field: ProjectionFieldDefinition,
    scopeId: string,
    value: unknown,
  ): Promise<ProjectionQueryPlan> {
    assertProjectionResourceDefinition(definition);
    const declaredField = getProjectionField(definition, field.name);
    if (!declaredField.index) {
      throw new TypeError(
        `Projection field ${declaredField.name} has no declared index.`,
      );
    }

    await this.analyze(dataSource, definition);
    const expression = this.definitionExpression(definition, declaredField);
    const rows = await this.explain(
      dataSource,
      `SELECT ${this.quote(definition.identity.column)} FROM ${this.quote(
        definition.tableName,
      )} WHERE ${this.quote(definition.scope.column)} = :projection_scope_id AND ${expression} = :projection_value ORDER BY ${this.quote(
        definition.identity.column,
      )} ASC`,
      {
        projection_scope_id: scopeId,
        projection_value: normalizeProjectionCodecValue(declaredField, value),
      },
    );
    const lines = rows.map((row) => Object.values(row).join(' '));
    return {
      lines,
      usesDeclaredIndex: lines.some((line) =>
        line.includes(declaredField.index!.name),
      ),
    };
  }

  protected abstract analyze(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<void>;

  protected abstract explain(
    dataSource: DataSource,
    select: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>;
}

class SqliteProjectionDialect extends BaseProjectionDialect {
  readonly name = 'sqlite' as const;
  readonly payloadColumnType = 'simple-json' as const;

  protected jsonValueExpression(
    payloadReference: string,
    path: readonly string[],
  ): string {
    return `json_extract(${payloadReference}, '${this.jsonPath(path)}')`;
  }

  protected booleanExpression(expression: string): string {
    return `CAST(${expression} AS INTEGER)`;
  }

  protected jsonPatchExpression(
    payloadColumn: string,
    changes: ProjectionPatch['jsonValues'],
  ): { expression: string; parameters: Record<string, string> } {
    let expression = `COALESCE(${payloadColumn}, '{}')`;
    const parameters: Record<string, string> = {};

    changes.forEach((change, index) => {
      const parameter = `projection_json_${index}`;
      parameters[parameter] = JSON.stringify(change.value);
      expression = `json_set(${expression}, '${this.jsonPath(
        change.field.path ?? [],
      )}', json(:${parameter}))`;
    });

    return { expression, parameters };
  }

  private jsonPath(path: readonly string[]): string {
    return `$.${path.join('.')}`;
  }

  isScopedIdentityConflict(
    error: unknown,
    definition: ProjectionResourceDefinition,
  ): boolean {
    const driverError = this.driverError(error);
    const message = String(driverError.message ?? '');
    return (
      driverError.code === 'SQLITE_CONSTRAINT' &&
      message.includes(`${definition.tableName}.${definition.scope.column}`) &&
      message.includes(`${definition.tableName}.${definition.identity.column}`)
    );
  }

  async inspect(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<ProjectionDialectEvidence> {
    assertProjectionResourceDefinition(definition);
    const indexes = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?",
      [definition.tableName],
    );
    const validJson = await dataSource.query(
      `SELECT json_valid(${this.quote(definition.payload.column)}) AS valid_json FROM ${this.quote(definition.tableName)}`,
    );
    return {
      payloadStorage: 'sqlite-json1',
      indexes: indexes.map((row: { name: string }) => row.name),
      validJson: validJson.every(
        (row: { valid_json: number }) => row.valid_json === 1,
      ),
    };
  }

  protected async analyze(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<void> {
    await dataSource.query(`ANALYZE ${this.quote(definition.tableName)}`);
  }

  protected explain(
    dataSource: DataSource,
    select: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    return dataSource.query(
      `EXPLAIN QUERY PLAN ${select
        .replace(':projection_scope_id', '?')
        .replace(':projection_value', '?')}`,
      [parameters.projection_scope_id, parameters.projection_value],
    );
  }
}

class PostgresProjectionDialect extends BaseProjectionDialect {
  readonly name = 'postgres' as const;
  readonly payloadColumnType = 'jsonb' as const;

  protected jsonValueExpression(
    payloadReference: string,
    path: readonly string[],
  ): string {
    return `(${payloadReference} #>> '${this.postgresPath(path)}')`;
  }

  protected booleanExpression(expression: string): string {
    return `CAST(${expression} AS BOOLEAN)`;
  }

  protected jsonPatchExpression(
    payloadColumn: string,
    changes: ProjectionPatch['jsonValues'],
  ): { expression: string; parameters: Record<string, string> } {
    let expression = `COALESCE(${payloadColumn}, '{}'::jsonb)`;
    expression = `CASE WHEN jsonb_typeof(${expression}) = 'object' THEN ${expression} ELSE '{}'::jsonb END`;
    const parameters: Record<string, string> = {};

    changes.forEach((change, index) => {
      const parameter = `projection_json_${index}`;
      parameters[parameter] = JSON.stringify(change.value);
      const path = change.field.path ?? [];
      for (let depth = 1; depth < path.length; depth += 1) {
        expression = this.jsonObjectAtPath(expression, path.slice(0, depth));
      }
      expression = `jsonb_set(${expression}, '${this.postgresPath(
        path,
      )}', CAST(:${parameter} AS jsonb), true)`;
    });

    return { expression, parameters };
  }

  private postgresPath(path: readonly string[]): string {
    return `{${path.join(',')}}`;
  }

  private jsonObjectAtPath(
    expression: string,
    path: readonly string[],
  ): string {
    const postgresPath = this.postgresPath(path);
    const existing = `(${expression} #> '${postgresPath}')`;
    return `jsonb_set(${expression}, '${postgresPath}', CASE WHEN jsonb_typeof(${existing}) = 'object' THEN ${existing} ELSE '{}'::jsonb END, true)`;
  }

  isScopedIdentityConflict(
    error: unknown,
    definition: ProjectionResourceDefinition,
  ): boolean {
    const driverError = this.driverError(error);
    return (
      driverError.code === '23505' &&
      driverError.constraint ===
        `${definition.tableName}_scope_${definition.identity.column}_unique`
    );
  }

  async inspect(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<ProjectionDialectEvidence> {
    assertProjectionResourceDefinition(definition);
    const columns = await dataSource.query(
      'SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
      [definition.tableName, definition.payload.column],
    );
    const indexes = await dataSource.query(
      'SELECT indexname FROM pg_indexes WHERE tablename = $1',
      [definition.tableName],
    );
    return {
      payloadStorage: columns[0]?.data_type ?? 'missing',
      indexes: indexes.map((row: { indexname: string }) => row.indexname),
      validJson: columns[0]?.data_type === 'jsonb',
    };
  }

  protected async analyze(
    dataSource: DataSource,
    definition: ProjectionResourceDefinition,
  ): Promise<void> {
    await dataSource.query(`ANALYZE ${this.quote(definition.tableName)}`);
  }

  protected explain(
    dataSource: DataSource,
    select: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    return dataSource.query(
      `EXPLAIN ${select
        .replace(':projection_scope_id', '$1')
        .replace(':projection_value', '$2')}`,
      [parameters.projection_scope_id, parameters.projection_value],
    );
  }
}

export function createProjectionDialect(driver: string): ProjectionDialect {
  if (driver === 'sqlite') return new SqliteProjectionDialect();
  if (driver === 'postgres') return new PostgresProjectionDialect();
  throw new TypeError(`Unsupported projection dialect ${driver}.`);
}

/**
 * Executes compiled index DDL only for an isolated bootstrap or test database.
 * Production applications should put `compileIndexStatements()` output into a
 * reviewed migration rather than synchronizing projection indexes at runtime.
 */
export async function applyProjectionIndexesForBootstrap(
  dataSource: DataSource,
  dialect: ProjectionDialect,
  definition: ProjectionResourceDefinition,
): Promise<void> {
  for (const statement of dialect.compileIndexStatements(definition)) {
    await dataSource.query(statement);
  }
}
