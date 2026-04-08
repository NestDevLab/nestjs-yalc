import {
  ConditionsTooBroadError,
  NoResultsFoundError,
} from '../conditions.error.js';
import {
  CreateEntityError,
  DeleteEntityError,
  EntityError,
  UpdateEntityError,
} from '../entity.error.js';
import { getConnectionName } from '@nestjs-yalc/database/conn.helper.js';
import { FactoryProvider, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type.js';
import {
  DeepPartial,
  getConnection,
  ObjectLiteral,
  QueryFailedError,
} from 'typeorm';
import { FindManyOptions, FindOptionsWhere as FindConditions } from 'typeorm';
import {
  type CrudGenRepositoryCapabilities,
  type GenericTypeORMRepository,
  PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES,
} from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import {
  CrudGenFindManyOptions,
  ICrudGenSimpleParams,
} from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { getProviderToken } from '../crud-gen.helpers.js';
import { ReplicationMode } from '@nestjs-yalc/database/query-builder.helper.js';
import { isClass } from '@nestjs-yalc/utils/class.helper.js';
import {
  getModelFieldMetadataList,
  isDstExtended,
} from '../object.decorator.js';
import {
  mapPaginationParamsToTypeORM,
  mapSortingParamsToTypeORM,
} from './crud-gen-args.helpers.js';

/**
 *
 * @todo must be refactorized with better types
 *
 * Factory function, creates a Provider for the specified Service class, entity and connection
 * @param providedClass Service Class name or Type
 * @param entity TypeORM Entity
 * @param connectionName The Database connection name
 */
export function GenericServiceFactory<Entity extends ObjectLiteral>(
  entity: EntityClassOrSchema,
  connectionName: string,
  providedClass?: ClassType<GenericService<Entity>>,
  entityWrite?: EntityClassOrSchema,
  connectionNameWrite?: string,
): FactoryProvider {
  const serviceClass = providedClass ?? GenericService;

  return {
    provide:
      providedClass ??
      getServiceToken(
        typeof entity === 'function' ? entity.name : entity.toString(),
      ),
    useFactory: (
      repository: GenericTypeORMRepository<any>,
      repositoryWrite: GenericTypeORMRepository<any>,
    ) => {
      return new serviceClass(repository, repositoryWrite);
    },
    inject: [
      getRepositoryToken(entity, connectionName),
      getRepositoryToken(
        entityWrite ?? entity,
        connectionNameWrite ?? connectionName,
      ),
    ],
  };
}

export function getServiceToken(entity: ClassType | string) {
  return `${getProviderToken(entity)}GenericService`;
}

/**
 * Validates if the error generated is related to the TypeORM Create/Update/Delete operation and re-throw it as a custom error.
 * @param errorClass The custom error class to throw
 * @throws EntityError
 */
export function validateSupportedError(
  errorClass: new (error: Error) => EntityError,
) {
  return (error: Error) => {
    if (error instanceof QueryFailedError) {
      throw new errorClass(error);
    }
    throw error;
  };
}

/**
 * @todo must be refactorized with better types
 */
@Injectable()
export class GenericService<
  EntityRead extends ObjectLiteral,
  EntityWrite extends ObjectLiteral = EntityRead,
> {
  protected entityRead: EntityClassOrSchema;
  protected entityWrite: EntityClassOrSchema;
  protected repositoryWrite: GenericTypeORMRepository<EntityWrite>;

  /**
   *
   * @param repositoryRead the main repository, if you do not specify the repositoryWrite it is used as write repository too
   * @param repositoryWrite specify this repository when you have to write on another entity, this is useful when you read from a view but you
   * need to write on another source
   */
  constructor(
    protected repository: GenericTypeORMRepository<EntityRead>,
    repositoryWrite?: GenericTypeORMRepository<EntityWrite>,
  ) {
    this.repositoryWrite =
      repositoryWrite ??
      ((<unknown>this.repository) as GenericTypeORMRepository<EntityWrite>);

    // Extracts the target Entity from the CrudGenRepository
    this.entityRead = this.repository.target as EntityClassOrSchema;
    this.entityWrite = this.repositoryWrite.target as EntityClassOrSchema;
  }

  /**
   * Build a simple TypeORM where condition from primary key identifiers.
   * Used as a fallback when extended repository helpers are not available.
   */
  protected buildPrimaryKeyWhere(ids: any): FindConditions<EntityRead> {
    if (ids && typeof ids === 'object' && !Array.isArray(ids)) {
      return ids as FindConditions<EntityRead>;
    }

    const repositoryAny: any = this.repository as any;
    const primaryColumns = repositoryAny.metadata?.primaryColumns ?? [];
    const primaryColumnName =
      primaryColumns[0]?.propertyName ?? ('id' as keyof EntityRead);

    return { [primaryColumnName]: ids } as FindConditions<EntityRead>;
  }

  /**
   * Switches this Service database connection to a new specified database
   * @param dbName The database name
   */
  public switchDatabaseConnection(dbName: string): void {
    const connectionName = getConnectionName(dbName);
    const connection = getConnection(connectionName);
    this.setRepositoryRead(
      connection.getRepository(
        this.entityRead,
      ) as GenericTypeORMRepository<EntityRead>,
    );

    this.setRepositoryWrite(
      connection.getRepository(
        this.entityWrite,
      ) as GenericTypeORMRepository<EntityWrite>,
    );
  }

  /**
   * Changes the Service repository (both write and read)
   * @param repository
   */
  protected setRepository(
    repository: GenericTypeORMRepository<EntityRead | EntityWrite>,
  ): void {
    this.setRepositoryRead(repository as GenericTypeORMRepository<EntityRead>);
    this.setRepositoryWrite(
      repository as GenericTypeORMRepository<EntityWrite>,
    );
  }

  /**
   * Changes the Service repository for read operations
   * @param repository
   */
  protected setRepositoryRead(
    repository: GenericTypeORMRepository<EntityRead>,
  ): void {
    this.repository = repository;
  }

  /**
   * Changes the Service repository for read operations
   * @param repository
   */
  protected setRepositoryWrite(
    repository: GenericTypeORMRepository<EntityWrite>,
  ): void {
    this.repositoryWrite = repository;
  }

  /**
   * Returns the Service repository (read)
   */
  getRepository(): GenericTypeORMRepository<EntityRead> {
    return this.repository;
  }

  /**
   * Returns the Service repository (write)
   */
  getRepositoryWrite(): GenericTypeORMRepository<EntityWrite> {
    return this.repositoryWrite;
  }

  /**
   * Returns a List of entities based in the provided options.
   * @param findOptions Filter options - partially implemented
   * @param withCount whether or not the number results should be returned
   * @param relations Related entities to load as part of the results
   * @param databaseName The database name, to open a new database connection
   */
  async getEntityList(
    findOptions: ICrudGenSimpleParams,
    withCount?: false,
    databaseName?: string,
  ): Promise<EntityRead[]>;
  async getEntityList(
    findOptions: ICrudGenSimpleParams,
    withCount: true,
    databaseName?: string,
  ): Promise<[EntityRead[], number]>;
  async getEntityList(
    findOptions: ICrudGenSimpleParams,
    withCount = false,
    databaseName?: string,
  ): Promise<[EntityRead[], number] | EntityRead[]> {
    if (databaseName) this.switchDatabaseConnection(databaseName);
    const { sorting, startRow, endRow, select, ...rest } = findOptions;

    const { skip, take } = mapPaginationParamsToTypeORM(startRow, endRow);

    /**
     * @todo mapping the find options to the TypeORM FindManyOptions
     */

    const mappedFindOptions: FindManyOptions<EntityRead> = {
      ...rest,
      order: sorting ? mapSortingParamsToTypeORM(sorting) : undefined,
      skip,
      take,
    };

    return withCount
      ? this.repository.findAndCount(mappedFindOptions)
      : this.repository.find(mappedFindOptions);
  }

  /**
   * Shortcut of getEntity with  failOnNull = true
   * @see {@link getEntity} for further information
   */
  async getEntityOrFail(
    where:
      | FindConditions<EntityRead>[]
      | FindConditions<EntityRead>
      | ObjectLiteral
      | string,
    fields?: (keyof EntityRead)[],
    relations?: string[],
    databaseName?: string,
  ): Promise<EntityRead> {
    return this.getEntity(where, fields, relations, databaseName, {
      failOnNull: true,
    });
  }

  /**
   * Returns an entity, or entity fields, based in the filters provided
   * @param where Filter options
   * @param fields Specific Entity fields to retrieve
   * @param relations Related entities to load as part of the Entity
   * @param databaseName The database name, to open a new database connection
   */
  async getEntity(
    where:
      | FindConditions<EntityRead>[]
      | FindConditions<EntityRead>
      | ObjectLiteral
      | string,
    fields?: (keyof EntityRead)[],
    relations?: string[],
    databaseName?: string,
    options?: {
      failOnNull: false;
    },
  ): Promise<EntityRead | undefined>;
  async getEntity(
    where:
      | FindConditions<EntityRead>[]
      | FindConditions<EntityRead>
      | ObjectLiteral
      | string,
    fields?: (keyof EntityRead)[],
    relations?: string[],
    databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<EntityRead>;
  async getEntity(
    where: FindConditions<EntityRead>[] | FindConditions<EntityRead>,
    fields?: (keyof EntityRead)[],
    relations?: string[],
    databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<EntityRead | null | undefined> {
    // Allows to switch to a different database connection
    if (databaseName) this.switchDatabaseConnection(databaseName);

    return options?.failOnNull !== true
      ? this.repository.findOne({
          where,
          select: fields,
          relations,
          comment: 'Generic service getEntity',
        })
      : this.repository.findOneOrFail({
          where,
          select: fields,
          relations,
          comment: 'Generic service getEntity failOnNull: true',
        });
  }

  /**
   * Creates an entity based in the provided data and returns it
   * @param entity
   * @throws CreateEntityError
   */
  async createEntity(
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity?: true,
  ): Promise<EntityRead>;
  async createEntity(
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity?: boolean,
  ): Promise<EntityRead | boolean>;
  async createEntity(
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity = true,
  ): Promise<EntityRead | boolean> {
    /**
     * This is needed to keep the prototype of the
     * entity in order to allow the beforeInsert to be executed
     */
    let entityHydrated = this.mapEntityR2W(input);
    const entity = this.entityWrite;
    if (isClass(entity)) {
      const inputValues = entityHydrated;
      entityHydrated = new entity();
      Object.assign(entityHydrated, inputValues);
    }

    const newEntity = this.repositoryWrite.create(entityHydrated);
    const { identifiers } = await this.repositoryWrite
      .insert(newEntity)
      .catch(validateSupportedError(CreateEntityError));
    /**
     * Create where condition for the identifiers
     * @todo maybe conversion is needed here as well
     */
    const ids = identifiers[0];
    const repoAny: any = this.repository as any;

    if (
      typeof repoAny.generateFilterOnPrimaryColumn === 'function' &&
      typeof repoAny.getOneExtended === 'function'
    ) {
      const filters = repoAny.generateFilterOnPrimaryColumn(ids);

      return !returnEntity
        ? true
        : repoAny.getOneExtended(
            { ...findOptions, where: { filters } },
            true,
            ReplicationMode.MASTER,
          );
    }

    if (!returnEntity) {
      return true;
    }

    const where = this.buildPrimaryKeyWhere(ids);

    return this.repository.findOneOrFail({
      where,
    } as FindManyOptions<EntityRead>);
  }

  /**
   * Updates an entity based in the provided conditions and return the updated entity
   * @param conditions The conditions to update
   * @param input The data to update
   * @throws UpdateEntityError
   * @throws NoResultsForConditions
   * @throws ConditionsTooBroadError
   */
  async updateEntity(
    conditions: FindConditions<EntityRead>,
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity?: true,
  ): Promise<EntityRead>;
  async updateEntity(
    conditions: FindConditions<EntityRead>,
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity?: boolean,
  ): Promise<EntityRead | boolean>;
  async updateEntity(
    conditions: FindConditions<EntityRead>,
    input: DeepPartial<EntityRead>,
    findOptions?: CrudGenFindManyOptions<EntityRead>,
    returnEntity = true,
  ): Promise<EntityRead | boolean> {
    const result = await this.validateConditions(conditions);

    /**
     * This is needed to keep the prototype of the
     * entity in order to allow the beforeUpdate to be executed
     */
    let entityHydrated = this.mapEntityR2W(input);
    const entity = this.entityWrite;
    if (isClass(entity)) {
      const _inputValues = entityHydrated;
      entityHydrated = new entity();
      Object.assign(entityHydrated, _inputValues);
    }

    const mappedConditions = this.mapEntityR2W(conditions);

    await this.repositoryWrite
      .update(mappedConditions, entityHydrated)
      .catch(validateSupportedError(UpdateEntityError));

    /**
     * Create where condition for the the identifiers
     */
    const ids = this.repository.getId(Object.assign(result, entityHydrated));
    const repoAny: any = this.repository as any;

    if (
      typeof repoAny.generateFilterOnPrimaryColumn === 'function' &&
      typeof repoAny.getOneExtended === 'function'
    ) {
      const filters = repoAny.generateFilterOnPrimaryColumn(ids);

      return !returnEntity
        ? true
        : repoAny.getOneExtended(
            { ...findOptions, where: { filters } },
            true,
            ReplicationMode.MASTER,
          );
    }

    if (!returnEntity) {
      return true;
    }

    const where = this.buildPrimaryKeyWhere(ids);

    return this.repository.findOneOrFail({
      where,
    } as FindManyOptions<EntityRead>);
  }

  /**
   * Deletes an entity based in the provided conditions and returns wether or not the resource was deleted
   * @param conditions The conditions to delete
   * @throws DeleteEntityError
   * @throws NoResultsForConditions
   * @throws ConditionsTooBroadError
   */
  async deleteEntity(conditions: FindConditions<EntityRead>): Promise<boolean> {
    await this.validateConditions(conditions);

    const mappedConditions = this.mapEntityR2W(conditions);

    const result = await this.repositoryWrite
      .delete(mappedConditions)
      .catch(validateSupportedError(DeleteEntityError));

    return !!result.affected && result.affected > 0;
  }

  /**
   * Makes sure that the conditions will affect a single record
   * @param conditions
   * @throws NoResultsForConditions
   * @throws ConditionsTooBroadError
   */
  async validateConditions(
    conditions: FindConditions<EntityRead>,
  ): Promise<EntityRead> {
    const results = await this.repository.find({
      where: conditions,
      take: 2, // Prevent finding more records than we need for the validation
    });

    if (results.length === 0) {
      throw new NoResultsFoundError(conditions);
    }
    if (results.length > 1) {
      throw new ConditionsTooBroadError(conditions);
    }
    return results[0];
  }

  /**   * Returns a List of entities based in the provided options.
   * @param findOptions Filter options
   * @param withCount whether or not the number results should be returned
   * @param relations Related entities to load as part of the results
   * @param databaseName The database name, to open a new database connection
   */
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<EntityRead>,
    withCount?: false,
    relations?: string[],
    databaseName?: string,
  ): Promise<EntityRead[]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<EntityRead>,
    withCount: true,
    relations?: string[],
    databaseName?: string,
  ): Promise<[EntityRead[], number]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<EntityRead>,
    withCount = false,
    relations?: string[],
    databaseName?: string,
  ): Promise<[EntityRead[], number] | EntityRead[]> {
    // Allows to switch to a different database connection
    if (databaseName) this.switchDatabaseConnection(databaseName);
    if (relations) findOptions.relations = relations;

    const repo: any = this.repository as any;
    const capabilities = this.getCrudGenRepositoryCapabilities();

    if (capabilities.extendedQueries) {
      if (
        typeof repo.getManyAndCountExtended !== 'function' ||
        typeof repo.getManyExtended !== 'function'
      ) {
        throw new ReferenceError(
          'Repository declares extended query support but does not implement the required extended query methods.',
        );
      }

      return withCount
        ? repo.getManyAndCountExtended(findOptions)
        : repo.getManyExtended(findOptions);
    }

    // Fallback for plain TypeORM repositories (no extended helpers):
    // keep support minimal, but sanitize internal helper artifacts such as
    // empty `where.filters` before delegating to TypeORM.
    const { where, info, extra, subQueryFilters, ...typeormOptions } =
      findOptions;

    const sanitizedWhere =
      where && typeof where === 'object' && !Array.isArray(where)
        ? (() => {
            const clone = { ...(where as any) };
            if ('filters' in clone) {
              delete clone.filters;
            }
            return Object.keys(clone).length ? clone : undefined;
          })()
        : (where as any);

    const mappedFindOptions: FindManyOptions<EntityRead> = {
      ...(typeormOptions as FindManyOptions<EntityRead>),
      where: sanitizedWhere as any,
    };

    return withCount
      ? this.repository.findAndCount(mappedFindOptions)
      : this.repository.find(mappedFindOptions);
  }

  getCrudGenRepositoryCapabilities(): CrudGenRepositoryCapabilities {
    const repo: any = this.repository as any;

    if (typeof repo.getCrudGenCapabilities === 'function') {
      const explicitCapabilities = repo.getCrudGenCapabilities();

      if (explicitCapabilities && typeof explicitCapabilities === 'object') {
        return {
          ...PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES,
          ...explicitCapabilities,
        };
      }
    }

    const legacyExtendedSupport =
      typeof repo.supportsExtendedRepository === 'function'
        ? !!repo.supportsExtendedRepository()
        : typeof repo.getManyAndCountExtended === 'function' &&
          typeof repo.getManyExtended === 'function';

    return {
      extendedQueries: legacyExtendedSupport,
      structuredGraphqlFilters: legacyExtendedSupport,
    };
  }

  supportsExtendedRepository(): boolean {
    return this.getCrudGenRepositoryCapabilities().extendedQueries;
  }

  supportsStructuredGraphqlFilters(): boolean {
    return this.getCrudGenRepositoryCapabilities().structuredGraphqlFilters;
  }

  protected mapEntityR2W(
    entityRead: FindConditions<EntityRead>,
  ): FindConditions<EntityWrite>;
  protected mapEntityR2W(
    entityRead: EntityRead | DeepPartial<EntityRead>,
  ): EntityWrite;
  protected mapEntityR2W(
    entityRead:
      | EntityRead
      | DeepPartial<EntityRead>
      | FindConditions<EntityRead>,
  ): EntityWrite | FindConditions<EntityWrite> {
    const entity = this.entityWrite;

    if (!isClass(entity) || !isClass(this.entityRead))
      return entityRead as EntityWrite;

    const newEntityWrite = new entity();

    const fieldMetadataList = getModelFieldMetadataList(this.entityRead);

    for (const propertyName of Object.keys(entityRead)) {
      const fieldMetadata = fieldMetadataList?.[propertyName];

      if (!fieldMetadata?.dst || !isDstExtended(fieldMetadata.dst)) {
        (newEntityWrite as any)[propertyName] = (entityRead as any)[
          propertyName as any
        ];
        continue;
      }

      const dst = fieldMetadata.dst;

      (newEntityWrite as any)[propertyName] = dst.transformerDst?.(
        newEntityWrite,
        (entityRead as any)[propertyName as any],
      );
    }

    return newEntityWrite;
  }
}
