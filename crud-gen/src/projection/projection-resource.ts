/**
 * Immutable, transport-neutral contract for a JSON-backed projected resource.
 *
 * A consumer declares logical fields here. Services and dialects receive field
 * definitions rather than JSON paths or driver-specific SQL.
 */
export type ProjectionCodec =
  | 'string'
  | 'uuid'
  | 'instant'
  | 'integer'
  | 'boolean'
  | 'json';

/** GraphQL Int and PostgreSQL integer share this portable signed range. */
export const PROJECTION_INTEGER_MIN = -(2 ** 31);
export const PROJECTION_INTEGER_MAX = 2 ** 31 - 1;

export type ProjectionStorage = 'column' | 'json';

export type ProjectionFilterOperator = 'eq' | 'range';

/**
 * Portable JSON paths are object-property paths only. Keeping the grammar
 * deliberately small lets both SQLite JSON1 and PostgreSQL jsonb compile a
 * path as a SQL literal without dialect-specific escaping rules.
 */
export const projectionPathSegmentPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * UUIDs use their canonical lowercase, hyphenated text representation. The
 * projection contract stores the same portable text on SQLite and PostgreSQL.
 */
export const projectionCanonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ProjectionIndexDefinition {
  name: string;
}

/** Portable scalar values accepted by a predicate unique constraint. */
export type ProjectionPredicateLiteral = string | number | boolean;

/**
 * A same-scope foreign key over promoted column fields. The resource scope is
 * always the first local column; the target scope is always the first remote
 * column, so applications cannot accidentally create cross-scope references.
 */
export interface ProjectionReferenceDefinition {
  name: string;
  fields: readonly string[];
  target: {
    tableName: string;
    scopeColumn: string;
    identityColumns: readonly string[];
  };
  onDelete: 'RESTRICT' | 'NO ACTION';
}

/**
 * A same-scope partial unique index over promoted column fields. Predicates
 * stay structural here and are compiled by the entity/table builder.
 */
export interface ProjectionPredicateUniqueConstraint {
  name: string;
  fields: readonly string[];
  /** Omit for a full unique index; provide a map for a portable partial one. */
  predicate?: Readonly<Record<string, ProjectionPredicateLiteral>>;
}

export interface ProjectionFieldDefinition {
  name: string;
  storage: ProjectionStorage;
  codec: ProjectionCodec;
  nullable: boolean;
  requiredOnCreate?: boolean;
  column?: string;
  path?: readonly string[];
  query?: {
    filter?: readonly ProjectionFilterOperator[];
    sort?: boolean;
  };
  index?: ProjectionIndexDefinition;
}

export interface ProjectionResourceDefinition {
  id: string;
  tableName: string;
  identity: {
    column: string;
    uniqueWithinScope: true;
  };
  scope: {
    column: string;
    serverOwned: true;
  };
  revision: {
    column: string;
  };
  payload: {
    column: string;
    allowCreate: boolean;
  };
  deletion: 'hard';
  fields: readonly ProjectionFieldDefinition[];
  references?: readonly ProjectionReferenceDefinition[];
  uniqueConstraints?: readonly ProjectionPredicateUniqueConstraint[];
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeDeep(child);
    }
    Object.freeze(value);
  }

  return value;
}

export function assertProjectionPath(
  path: readonly string[],
  fieldName = 'Projection JSON field',
): void {
  if (path.length === 0) {
    throw new TypeError(`${fieldName} requires a non-empty path.`);
  }

  for (const segment of path) {
    if (
      typeof segment !== 'string' ||
      !projectionPathSegmentPattern.test(segment)
    ) {
      throw new TypeError(
        `${fieldName} has an invalid path segment. Portable paths use /${projectionPathSegmentPattern.source}/.`,
      );
    }
  }
}

function assertIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty identifier.`);
  }
}

const projectionSchemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function assertSchemaIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !projectionSchemaIdentifierPattern.test(value)
  ) {
    throw new TypeError(
      `${label} must match /${projectionSchemaIdentifierPattern.source}/.`,
    );
  }
}

function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean.`);
  }
}

function pathsOverlap(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const length = Math.min(left.length, right.length);
  return left
    .slice(0, length)
    .every((segment, index) => segment === right[index]);
}

function assertFieldQueryCapabilities(field: ProjectionFieldDefinition): void {
  const filters = field.query?.filter ?? [];
  if (
    !Array.isArray(filters) ||
    filters.some((filter) => filter !== 'eq' && filter !== 'range')
  ) {
    throw new TypeError(
      `Projection field ${field.name} has an unsupported filter.`,
    );
  }

  if (field.codec === 'json') {
    if (field.query?.filter?.length || field.query?.sort || field.index) {
      throw new TypeError(
        `Projection JSON field ${field.name} cannot be filtered, sorted, or indexed.`,
      );
    }
    return;
  }

  if (
    (field.codec === 'string' ||
      field.codec === 'uuid' ||
      field.codec === 'boolean') &&
    filters.includes('range')
  ) {
    throw new TypeError(
      `Projection ${field.codec} field ${field.name} cannot declare range filtering.`,
    );
  }
}

function promotedColumnField(
  definition: ProjectionResourceDefinition,
  fieldName: string,
  label: string,
): ProjectionFieldDefinition {
  assertSchemaIdentifier(fieldName, label);
  if (fieldName === definition.identity.column) {
    throw new TypeError(`${label} cannot use the projection identity field.`);
  }
  if (fieldName === definition.scope.column) {
    throw new TypeError(`${label} cannot use the projection scope field.`);
  }

  const field = definition.fields.find(
    (candidate) => candidate.name === fieldName,
  );
  if (!field) {
    throw new TypeError(`${label} is not a declared projection field.`);
  }
  if (field.storage !== 'column' || field.codec === 'json') {
    throw new TypeError(`${label} must use a promoted column field.`);
  }
  assertSchemaIdentifier(field.column, `${label} column`);
  return field;
}

function assertDistinctFieldNames(
  fields: readonly string[],
  label: string,
): void {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new TypeError(`${label} requires at least one promoted field.`);
  }
  if (new Set(fields).size !== fields.length) {
    throw new TypeError(`${label} cannot declare the same field twice.`);
  }
}

function assertProjectionReferences(
  definition: ProjectionResourceDefinition,
  indexNames: Set<string>,
): void {
  const references = definition.references ?? [];
  if (!Array.isArray(references)) {
    throw new TypeError('Projection references must be an array.');
  }

  const referenceNames = new Set<string>();
  for (const reference of references) {
    assertSchemaIdentifier(reference?.name, 'Projection reference name');
    if (referenceNames.has(reference.name)) {
      throw new TypeError(
        `Projection reference ${reference.name} is declared twice.`,
      );
    }
    referenceNames.add(reference.name);

    const childIndexName = getProjectionReferenceIndexName(reference);
    if (indexNames.has(childIndexName)) {
      throw new TypeError(
        `Projection reference ${reference.name} child index collides with another index.`,
      );
    }
    indexNames.add(childIndexName);

    assertDistinctFieldNames(
      reference.fields,
      `Projection reference ${reference.name}`,
    );
    const localFields = reference.fields.map((fieldName: string) =>
      promotedColumnField(
        definition,
        fieldName,
        `Projection reference ${reference.name} field ${fieldName}`,
      ),
    );
    assertSchemaIdentifier(
      reference.target?.tableName,
      `Projection reference ${reference.name} target table`,
    );
    assertSchemaIdentifier(
      reference.target?.scopeColumn,
      `Projection reference ${reference.name} target scope column`,
    );
    if (
      !Array.isArray(reference.target?.identityColumns) ||
      reference.target.identityColumns.length === 0
    ) {
      throw new TypeError(
        `Projection reference ${reference.name} requires target identity columns.`,
      );
    }
    if (reference.target.identityColumns.length !== localFields.length) {
      throw new TypeError(
        `Projection reference ${reference.name} local and target identity column counts must match.`,
      );
    }
    if (
      new Set(reference.target.identityColumns).size !==
      reference.target.identityColumns.length
    ) {
      throw new TypeError(
        `Projection reference ${reference.name} cannot repeat target identity columns.`,
      );
    }
    for (const targetColumn of reference.target.identityColumns) {
      assertSchemaIdentifier(
        targetColumn,
        `Projection reference ${reference.name} target identity column`,
      );
      if (targetColumn === reference.target.scopeColumn) {
        throw new TypeError(
          `Projection reference ${reference.name} target identity cannot use its scope column.`,
        );
      }
    }
    if (
      reference.onDelete !== 'RESTRICT' &&
      reference.onDelete !== 'NO ACTION'
    ) {
      throw new TypeError(
        `Projection reference ${reference.name} only supports RESTRICT or NO ACTION on delete.`,
      );
    }
  }
}

function assertProjectionUniqueConstraints(
  definition: ProjectionResourceDefinition,
  indexNames: Set<string>,
): void {
  const constraints = definition.uniqueConstraints ?? [];
  if (!Array.isArray(constraints)) {
    throw new TypeError('Projection unique constraints must be an array.');
  }

  const constraintNames = new Set<string>();
  for (const constraint of constraints) {
    assertSchemaIdentifier(
      constraint?.name,
      'Projection unique constraint name',
    );
    if (
      constraintNames.has(constraint.name) ||
      indexNames.has(constraint.name)
    ) {
      throw new TypeError(
        `Projection unique constraint ${constraint.name} collides with another index or constraint.`,
      );
    }
    constraintNames.add(constraint.name);
    indexNames.add(constraint.name);

    assertDistinctFieldNames(
      constraint.fields,
      `Projection unique constraint ${constraint.name}`,
    );
    for (const fieldName of constraint.fields) {
      promotedColumnField(
        definition,
        fieldName,
        `Projection unique constraint ${constraint.name} field ${fieldName}`,
      );
    }

    if (constraint.predicate === undefined) continue;
    if (
      typeof constraint.predicate !== 'object' ||
      Array.isArray(constraint.predicate)
    ) {
      throw new TypeError(
        `Projection unique constraint ${constraint.name} requires a predicate map.`,
      );
    }
    const predicateEntries = Object.entries(constraint.predicate);
    if (predicateEntries.length === 0) {
      throw new TypeError(
        `Projection unique constraint ${constraint.name} requires at least one predicate field.`,
      );
    }
    for (const [fieldName, value] of predicateEntries) {
      const field = promotedColumnField(
        definition,
        fieldName,
        `Projection unique constraint ${constraint.name} predicate ${fieldName}`,
      );
      if (value === null || value === undefined) {
        throw new TypeError(
          `Projection unique constraint ${constraint.name} predicate ${fieldName} must be a scalar literal.`,
        );
      }
      assertProjectionCodecValue(field, value);
    }
  }
}

/**
 * Verifies the one metadata contract before it reaches a dialect. This is
 * exported so callers that receive structural data rather than a value from
 * defineProjectionResource can fail before executing SQL as well.
 */
export function assertProjectionResourceDefinition(
  definition: ProjectionResourceDefinition,
): void {
  assertIdentifier(definition.id, 'Projection resource id');
  assertIdentifier(definition.tableName, 'Projection table name');
  assertIdentifier(definition.identity.column, 'Projection identity column');
  assertIdentifier(definition.scope.column, 'Projection scope column');
  assertIdentifier(definition.revision.column, 'Projection revision column');
  assertIdentifier(definition.payload.column, 'Projection payload column');
  if (definition.payload.column !== 'payload') {
    throw new TypeError(
      'Projection payload column must be named payload to match the public payload field.',
    );
  }

  const reservedColumns = [
    definition.scope.column,
    definition.identity.column,
    definition.revision.column,
    definition.payload.column,
  ];
  if (new Set(reservedColumns).size !== reservedColumns.length) {
    throw new TypeError(
      'Projection scope, identity, revision, and payload columns must be distinct.',
    );
  }
  if (definition.scope.serverOwned !== true) {
    throw new TypeError('Projection scope must be server-owned.');
  }
  if (definition.deletion !== 'hard') {
    throw new TypeError('Projection resource only supports hard deletion.');
  }
  assertBoolean(
    definition.payload.allowCreate,
    'Projection payload allowCreate',
  );
  if ('allowPatch' in (definition.payload as object)) {
    throw new TypeError('Projection raw payload updates are not supported.');
  }
  if (!definition.identity.uniqueWithinScope) {
    throw new TypeError(
      'Projection identity must declare uniqueness within its server-owned scope.',
    );
  }

  const names = new Set<string>();
  const columns = new Set<string>();
  const indexNames = new Set<string>();
  const jsonFields: ProjectionFieldDefinition[] = [];
  const reservedPublicNames = new Set([
    definition.scope.column,
    definition.revision.column,
    'payload',
    'expectedRevision',
  ]);
  const scopedIdentityIndexName = `${definition.tableName}_scope_${definition.identity.column}_unique`;

  for (const field of definition.fields) {
    assertIdentifier(field.name, 'Projection field name');
    if (names.has(field.name)) {
      throw new TypeError(`Projection field ${field.name} is declared twice.`);
    }
    if (reservedPublicNames.has(field.name)) {
      throw new TypeError(
        `Projection field ${field.name} collides with a reserved public field.`,
      );
    }
    names.add(field.name);

    assertBoolean(field.nullable, `Projection field ${field.name} nullable`);
    if (
      field.requiredOnCreate !== undefined &&
      typeof field.requiredOnCreate !== 'boolean'
    ) {
      throw new TypeError(
        `Projection field ${field.name} requiredOnCreate must be a boolean.`,
      );
    }
    if (field.requiredOnCreate && field.nullable) {
      throw new TypeError(
        `Projection field ${field.name} cannot be both required on create and nullable.`,
      );
    }
    if (!field.nullable && field.requiredOnCreate !== true) {
      throw new TypeError(
        `Non-null projection field ${field.name} must be required on create.`,
      );
    }

    if (field.storage === 'column') {
      assertIdentifier(field.column, `Projection field ${field.name} column`);
      if (field.path) {
        throw new TypeError(
          `Column projection field ${field.name} cannot declare a JSON path.`,
        );
      }
      const column = field.column!;
      const isIdentityField =
        field.name === definition.identity.column &&
        column === definition.identity.column;
      if (!isIdentityField && reservedColumns.includes(column)) {
        throw new TypeError(
          `Projection field ${field.name} collides with a reserved column.`,
        );
      }
      if (columns.has(column)) {
        throw new TypeError(`Projection column ${column} is declared twice.`);
      }
      columns.add(column);
    }
    if (field.storage === 'json') {
      if (field.column) {
        throw new TypeError(
          `JSON projection field ${field.name} cannot declare a column.`,
        );
      }
      assertProjectionPath(field.path ?? [], `Projection field ${field.name}`);
      for (const existing of jsonFields) {
        if (pathsOverlap(existing.path ?? [], field.path ?? [])) {
          throw new TypeError(
            `Projection JSON path for ${field.name} overlaps ${existing.name}.`,
          );
        }
      }
      jsonFields.push(field);
    }
    if (field.storage !== 'column' && field.storage !== 'json') {
      throw new TypeError(
        `Projection field ${field.name} has an unsupported storage mode.`,
      );
    }
    if (
      !['string', 'uuid', 'instant', 'integer', 'boolean', 'json'].includes(
        field.codec,
      )
    ) {
      throw new TypeError(
        `Projection field ${field.name} has an unsupported codec.`,
      );
    }
    if (field.codec === 'json' && field.storage !== 'json') {
      throw new TypeError(
        `Projection JSON field ${field.name} must use JSON storage.`,
      );
    }
    assertFieldQueryCapabilities(field);
    if (
      field.query?.sort !== undefined &&
      typeof field.query.sort !== 'boolean'
    ) {
      throw new TypeError(
        `Projection field ${field.name} sort capability must be a boolean.`,
      );
    }

    if (field.index) {
      assertIdentifier(
        field.index.name,
        `Projection field ${field.name} index`,
      );
      if (field.index.name === scopedIdentityIndexName) {
        throw new TypeError(
          `Projection field ${field.name} index collides with the scoped identity index.`,
        );
      }
      if (indexNames.has(field.index.name)) {
        throw new TypeError(
          `Projection index ${field.index.name} is declared twice.`,
        );
      }
      indexNames.add(field.index.name);
    }
  }

  const identityField = definition.fields.find(
    (field) => field.name === definition.identity.column,
  );
  if (
    !identityField ||
    identityField.storage !== 'column' ||
    identityField.column !== definition.identity.column ||
    (identityField.codec !== 'string' && identityField.codec !== 'uuid') ||
    identityField.nullable ||
    !identityField.requiredOnCreate
  ) {
    throw new TypeError(
      `Projection identity ${definition.identity.column} must be a required non-null string or UUID column field.`,
    );
  }

  assertProjectionReferences(definition, indexNames);
  assertProjectionUniqueConstraints(definition, indexNames);
  const declaredConstraintNames = [
    ...(definition.references ?? []).map((reference) => reference.name),
    ...(definition.uniqueConstraints ?? []).map(
      (constraint) => constraint.name,
    ),
  ];
  if (
    new Set(declaredConstraintNames).size !== declaredConstraintNames.length
  ) {
    throw new TypeError(
      'Projection reference and unique constraint names must be distinct.',
    );
  }
}

/** The stable child-supporting index generated for a declarative reference. */
export function getProjectionReferenceIndexName(
  reference: ProjectionReferenceDefinition,
): string {
  return `${reference.name}_idx`;
}

/** Returns the scope-prefixed local columns for a declarative reference. */
export function getProjectionReferenceColumnNames(
  definition: ProjectionResourceDefinition,
  reference: ProjectionReferenceDefinition,
): string[] {
  assertProjectionResourceDefinition(definition);
  return [
    definition.scope.column,
    ...reference.fields.map(
      (fieldName) =>
        promotedColumnField(
          definition,
          fieldName,
          `Projection reference ${reference.name} field ${fieldName}`,
        ).column!,
    ),
  ];
}

/** Returns the scope-prefixed target columns for a declarative reference. */
export function getProjectionReferenceTargetColumnNames(
  reference: ProjectionReferenceDefinition,
): string[] {
  return [reference.target.scopeColumn, ...reference.target.identityColumns];
}

/** Returns the scope-prefixed columns covered by a partial unique constraint. */
export function getProjectionUniqueConstraintColumnNames(
  definition: ProjectionResourceDefinition,
  constraint: ProjectionPredicateUniqueConstraint,
): string[] {
  assertProjectionResourceDefinition(definition);
  return [
    definition.scope.column,
    ...constraint.fields.map(
      (fieldName) =>
        promotedColumnField(
          definition,
          fieldName,
          `Projection unique constraint ${constraint.name} field ${fieldName}`,
        ).column!,
    ),
  ];
}

function quoteProjectionIdentifier(identifier: string): string {
  assertSchemaIdentifier(identifier, 'Projection SQL identifier');
  return `"${identifier}"`;
}

function compileProjectionPredicateLiteral(
  field: ProjectionFieldDefinition,
  value: ProjectionPredicateLiteral,
  dialect: 'sqlite' | 'postgres',
): string {
  if (field.codec === 'boolean') {
    return value
      ? dialect === 'sqlite'
        ? '1'
        : 'TRUE'
      : dialect === 'sqlite'
        ? '0'
        : 'FALSE';
  }
  if (field.codec === 'integer') return String(value);
  if (
    field.codec === 'string' ||
    field.codec === 'uuid' ||
    field.codec === 'instant'
  ) {
    return `'${String(value).replaceAll("'", "''")}'`;
  }
  throw new TypeError(
    `Projection unique predicates cannot use ${field.codec} field ${field.name}.`,
  );
}

/**
 * Compiles a structural partial-index predicate without accepting raw SQL.
 * Identifiers are validated and quoted; values are first checked against their
 * declared field codecs and then emitted as dialect-specific scalar literals.
 */
export function compileProjectionUniqueConstraintPredicate(
  definition: ProjectionResourceDefinition,
  constraint: ProjectionPredicateUniqueConstraint,
  dialect: 'sqlite' | 'postgres',
): string | undefined {
  assertProjectionResourceDefinition(definition);
  if (dialect !== 'sqlite' && dialect !== 'postgres') {
    throw new TypeError(`Unsupported projection predicate dialect ${dialect}.`);
  }
  const declared = definition.uniqueConstraints?.find(
    (candidate) => candidate.name === constraint.name,
  );
  if (!declared) {
    throw new TypeError(
      `Projection unique constraint ${constraint.name} is not declared by the resource.`,
    );
  }
  if (declared.predicate === undefined) return undefined;

  return Object.entries(declared.predicate)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fieldName, value]) => {
      const field = promotedColumnField(
        definition,
        fieldName,
        `Projection unique constraint ${declared.name} predicate ${fieldName}`,
      );
      assertProjectionCodecValue(field, value);
      return `${quoteProjectionIdentifier(field.column!)} = ${compileProjectionPredicateLiteral(
        field,
        value,
        dialect,
      )}`;
    })
    .join(' AND ');
}

/**
 * Projection codec values have deliberately portable semantics:
 * - string: a JavaScript string; equality and sorting are textual.
 * - uuid: a canonical lowercase hyphenated UUID string; equality, sorting,
 *   and indexes compare its validated text representation.
 * - instant: a canonical Date#toISOString UTC timestamp; equality, range,
 *   sorting and indexes compare the canonical text representation.
 * - integer: a signed 32-bit integer; equality, range, sorting and indexes
 *   use a signed SQL integer expression.
 * - json: a JSON-compatible value; it is transport-only and has no query or
 *   index capability.
 */
export function assertProjectionCodecValue(
  field: ProjectionFieldDefinition,
  value: unknown,
): void {
  if (value === null) {
    if (!field.nullable) {
      throw new TypeError(`Projection field ${field.name} cannot be null.`);
    }
    return;
  }

  if (field.codec === 'string') {
    if (typeof value !== 'string') {
      throw new TypeError(
        `Projection string field ${field.name} must be a string.`,
      );
    }
    return;
  }

  if (field.codec === 'uuid') {
    if (
      typeof value !== 'string' ||
      !projectionCanonicalUuidPattern.test(value)
    ) {
      throw new TypeError(
        `Projection UUID field ${field.name} must be a canonical UUID.`,
      );
    }
    return;
  }

  if (field.codec === 'instant') {
    if (
      typeof value !== 'string' ||
      Number.isNaN(Date.parse(value)) ||
      new Date(value).toISOString() !== value
    ) {
      throw new TypeError(
        `Projection instant field ${field.name} must be a canonical UTC ISO timestamp.`,
      );
    }
    return;
  }

  if (field.codec === 'integer') {
    if (
      !Number.isInteger(value) ||
      (value as number) < PROJECTION_INTEGER_MIN ||
      (value as number) > PROJECTION_INTEGER_MAX
    ) {
      throw new TypeError(
        `Projection integer field ${field.name} must be a signed 32-bit integer.`,
      );
    }
    return;
  }

  if (field.codec === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new TypeError(
        `Projection boolean field ${field.name} must be a boolean.`,
      );
    }
    return;
  }

  if (value === undefined || !isJsonCompatible(value, new Set<object>())) {
    throw new TypeError(
      `Projection JSON field ${field.name} must contain a JSON-compatible value.`,
    );
  }
}

/** Normalizes the only non-JSON runtime representation accepted by a codec. */
export function normalizeProjectionCodecValue(
  field: ProjectionFieldDefinition,
  value: unknown,
): unknown {
  if (field.codec === 'instant' && value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(
        `Projection instant field ${field.name} must be a valid Date.`,
      );
    }
    value = value.toISOString();
  }
  assertProjectionCodecValue(field, value);
  return value;
}

function isJsonCompatible(value: unknown, seen: Set<object>): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.every((item) => isJsonCompatible(item, seen));
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== null &&
    (typeof prototype.constructor !== 'function' ||
      prototype.constructor.name !== 'Object')
  ) {
    return false;
  }
  seen.add(value);
  return Object.values(value as Record<string, unknown>).every((item) =>
    isJsonCompatible(item, seen),
  );
}

/** Validates the opaque payload object before it reaches the JSON column. */
export function assertProjectionPayloadValue(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Projection payload must be a JSON object.');
  }
  if (!isJsonCompatible(value, new Set<object>())) {
    throw new TypeError('Projection payload must be JSON-compatible.');
  }
}

export function defineProjectionResource<
  TDefinition extends ProjectionResourceDefinition,
>(definition: TDefinition): Readonly<TDefinition> {
  assertProjectionResourceDefinition(definition);
  return freezeDeep(definition);
}

export function getProjectionField(
  definition: ProjectionResourceDefinition,
  name: string,
): ProjectionFieldDefinition {
  const field = definition.fields.find((candidate) => candidate.name === name);
  if (!field) {
    throw new TypeError(`Unknown projection field ${name}.`);
  }

  return field;
}

export function getProjectionPathValue(
  payload: Record<string, unknown> | null | undefined,
  path: readonly string[],
): unknown {
  let current: unknown = payload;

  for (const part of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function setProjectionPathValue(
  payload: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): Record<string, unknown> {
  assertProjectionPath(path);
  const clone = structuredClone(payload);
  let current = clone;

  for (const part of path.slice(0, -1)) {
    const existing = current[part];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[path[path.length - 1]] = value;
  return clone;
}
