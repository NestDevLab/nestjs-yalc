import {
  QueryBuilderHelper,
  ReplicationMode,
} from '@nestjs-yalc/database/query-builder.helper.js';
import { IFieldMapper } from '@nestjs-yalc/interfaces/maps.interface.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type.js';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  applySelectOnFind,
  objectToFieldMapper,
  whereObjectToSqlString,
} from '../crud-gen.helpers.js';
import { CrudGenFindManyOptions } from '../api-graphql/crud-gen-gql.interface.js';
import { IWhereFilters } from '../api-graphql/crud-gen-gql.type.js';
import { IModelFieldMetadata } from '../object.decorator.js';
import '../query-builder.helpers.js'; // must be imported here

export const AG_GRID_MAIN_ALIAS = 'CrudGenMainAlias';

export interface CrudGenRepositoryCapabilities {
  extendedQueries: boolean;
  structuredGraphqlFilters: boolean;
}

export const PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES: CrudGenRepositoryCapabilities =
  {
    extendedQueries: false,
    structuredGraphqlFilters: false,
  };

export class GenericTypeORMRepository<
  Entity extends ObjectLiteral,
> extends Repository<Entity> {
  protected entity!: EntityClassOrSchema;

  getCrudGenCapabilities(): CrudGenRepositoryCapabilities {
    return {
      extendedQueries: true,
      structuredGraphqlFilters: true,
    };
  }

  supportsExtendedRepository(): boolean {
    return this.getCrudGenCapabilities().extendedQueries;
  }

  /**
   * @todo we should create a class helper/adapter for the findOptions and move this method there
   */
  public getActualLimits(findOptions: CrudGenFindManyOptions<Entity>): {
    skip?: number;
    take?: number;
  } {
    if (findOptions.subQueryFilters) {
      // findOptions limits take precedence over subQuery limits
      return {
        skip: findOptions.skip ?? findOptions.subQueryFilters.skip,
        take: findOptions.take ?? findOptions.subQueryFilters.take,
      };
    }

    return { skip: findOptions.skip, take: findOptions.take };
  }

  public getFormattedCrudGenQueryBuilder(
    findOptions: CrudGenFindManyOptions<Entity>,
    fieldMap?: {
      parent: IFieldMapper;
      joined: IFieldMapper | { [key: string]: IFieldMapper };
    },
    qb?: SelectQueryBuilder<Entity>,
  ): SelectQueryBuilder<Entity> {
    //We will use functions to apply sorting and filters
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      order,
      where,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      info,
      skip,
      take,
      extra,
      join,
      ...strippedFindOptions
    } = findOptions;

    /**
     * We need at least one property in this object
     */
    if (!findOptions.select) {
      strippedFindOptions.select = [];
    }

    const queryBuilder = qb ?? this.createQueryBuilder(extra?._aliasType);

    const connection = queryBuilder.connection;

    const rawSelection: string[] = [];
    const joinSelection: string[] = [];
    const customSel = extra?._keysMeta;
    if (customSel) {
      Object.values(customSel).forEach((v) => {
        const meta = v;

        const _mapper = meta?.fieldMapper;

        const isNested = meta?.isNested;
        const isDerived = _mapper?.mode === 'derived';

        if (meta && isDerived) {
          const selPart = `${meta.rawSelect} AS ${connection.driver.escape(
            `${queryBuilder.alias}_${meta.fieldMapper._propertyName}`,
          )}`;

          if (isNested) {
            joinSelection.push(selPart);
          } else {
            rawSelection.push(selPart);
          }
        }
      });
    }

    /**
     * Add join where conditions from CrudGen decorator relation property
     */

    let joinCopy;
    const customJoinToApply: {
      (queryBuilder: SelectQueryBuilder<Entity>): void;
    }[] = [];
    if (join) {
      joinCopy = { ...join };
      const processRelationExtraConditions = (
        joinType: 'left' | 'inner',
        joinInfo?: Record<string, string>,
      ) => {
        if (!joinInfo) return;

        /**
         * when fieldInfo?.relation we need to execute
         * join by using the queryBuilder functions directly
         * in order to apply the extra conditions
         */
        Object.keys(joinInfo).forEach((key) => {
          const fieldInfo = extra?._fieldMapper?.[key] as IModelFieldMetadata;

          if (!fieldInfo?.relation) return;

          const relation = fieldInfo.relation;

          const type: 'leftJoinAndSelect' | 'innerJoinAndSelect' =
            joinType === 'left' ? 'leftJoinAndSelect' : 'innerJoinAndSelect';

          // store joins to apply later
          customJoinToApply.push((qb: SelectQueryBuilder<Entity>) => {
            /* istanbul ignore next */
            const alias = extra?._aliasType ?? '';
            qb[type](
              `${alias}.${key}`,
              `${key}`,
              `${key}.${relation.targetKey.dst} = ${relation.sourceKey.dst}`,
            );
          });

          delete joinInfo[key];
        });
      };

      processRelationExtraConditions('inner', joinCopy.innerJoinAndSelect);
      processRelationExtraConditions('left', joinCopy.leftJoinAndSelect);
    }

    queryBuilder.setFindOptions({ ...strippedFindOptions, join: joinCopy });

    rawSelection.length > 0 && queryBuilder.addSelect(rawSelection);

    if (join) {
      joinSelection.length > 0 && queryBuilder.addSelect(joinSelection);
      // apply custom joins
      customJoinToApply.forEach((fn) => fn(queryBuilder));
    }

    if (extra && extra.rawLimit === true) {
      // .take() and .skip() methods create
      // a not limited subquery on joined tables
      // which reduces the performance, while offset() and limit()
      // do not create any subquery, however, the amount of data retrieved could
      // not be consistent (less than the one expected) because of duplicated rows
      // therefore, use rawLimit option especially with 1:1 relations
      queryBuilder.offset(skip).limit(take);
    } else {
      queryBuilder.skip(skip).take(take);
    }

    if (where) {
      const stringWhere = whereObjectToSqlString(
        queryBuilder,
        where,
        queryBuilder.alias,
        fieldMap,
      );

      //Let's convert the filterObject into an sql string
      queryBuilder.where(stringWhere);
    }

    //We do the same with sorting
    const sortingColumns = QueryBuilderHelper.applyOrderToJoinedQueryBuilder(
      findOptions,
      queryBuilder.alias,
      fieldMap,
    );
    sortingColumns.forEach((v: any) => {
      queryBuilder.addOrderBy(v.key, v.operator);
    });
    return queryBuilder;
  }

  public getCrudGenQueryBuilder(
    findOptions: CrudGenFindManyOptions<Entity>,
    fieldMap?: {
      parent: IFieldMapper;
      joined: IFieldMapper | { [key: string]: IFieldMapper };
    },
  ) {
    const queryBuilder = this.createQueryBuilder(findOptions.extra?._aliasType);

    if (findOptions.subQueryFilters) {
      const joinQueryBuilder = queryBuilder.connection.createQueryBuilder();

      const subQuery = this.getFormattedCrudGenQueryBuilder(
        findOptions.subQueryFilters,
        fieldMap,
      ).select('*');

      joinQueryBuilder.from(`(${subQuery.getQuery()})`, queryBuilder.alias);

      // bug: https://github.com/typeorm/typeorm/issues/4015
      // hack: https://github.com/typeorm/typeorm/issues/4015#issuecomment-691030543
      if (
        joinQueryBuilder.expressionMap.mainAlias &&
        queryBuilder.expressionMap.mainAlias?.metadata
      )
        joinQueryBuilder.expressionMap.mainAlias.metadata =
          queryBuilder.expressionMap.mainAlias.metadata;

      return this.getFormattedCrudGenQueryBuilder(
        findOptions,
        fieldMap,
        joinQueryBuilder,
      );
    }

    return this.getFormattedCrudGenQueryBuilder(
      findOptions,
      fieldMap,
      queryBuilder,
    );
  }

  public async processQueryBuilderWithCount(
    queryBuilder: SelectQueryBuilder<Entity>,
    findOptions: CrudGenFindManyOptions<Entity>,
  ): Promise<[Entity[], number]> {
    const { skip = 0, take } = this.getActualLimits(findOptions);

    // skip count select with no limit is specified or when skipCount is true
    const skipCount =
      findOptions.extra?.skipCount === true || !findOptions.take;

    if (skipCount) {
      const result = await queryBuilder.getMany();

      // when no limit specified we are asking for all available resources, hence we already know the total amount
      // therefore, no SELECT COUNT is needed
      const knownLimit = !take || result.length < take;
      // we still try to return a counter when we know that the requested limit
      // is higher than the resources available. Otherwise we return -1 (unkown limit)
      return [result, knownLimit ? result.length + skip : -1];
    } else {
      //getManyAndCount in unefficient because is sequential, instead we can run the 2 queries in parallel
      return Promise.all([queryBuilder.getMany(), queryBuilder.getCount()]);
    }
  }

  /**
   * Returns a List of entities based in the provided options.
   * @param findOptions Filter options
   */
  public async getManyAndCountExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    fieldMap?: {
      parent: IFieldMapper;
      joined: IFieldMapper | { [key: string]: IFieldMapper };
    },
  ): Promise<[Entity[], number]> {
    // console.log('==========START QUERY==============');
    const queryBuilder = this.getCrudGenQueryBuilder(findOptions, fieldMap);

    return this.processQueryBuilderWithCount(queryBuilder, findOptions);
  }

  /**
   * Returns a List of entities based in the provided options.
   * @param findOptions Filter options
   */
  public async getManyExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    fieldMap?: {
      parent: IFieldMapper;
      joined: IFieldMapper | { [key: string]: IFieldMapper };
    },
  ): Promise<Entity[]> {
    const queryBuilder = this.getCrudGenQueryBuilder(findOptions, fieldMap);

    return queryBuilder.getMany();
  }

  public async countExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    fieldMap?: {
      parent: IFieldMapper;
      joined: IFieldMapper | { [key: string]: IFieldMapper };
    },
  ): Promise<number> {
    const queryBuilder = this.getCrudGenQueryBuilder(findOptions, fieldMap);

    return queryBuilder.getCount();
  }

  /**
   * @param findOptions All we need to select, filter, order and join the data
   * @param withFail If true ignore the fail, if false when u don't find a entity it'll trhow an error
   * @param mode Set it to true to query data after a mutation
   */
  async getOneExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    withFail?: boolean,
    mode?: ReplicationMode,
  ): Promise<Entity>;
  async getOneExtended(
    findOptions: CrudGenFindManyOptions<Entity>,
    withFail?: boolean,
    mode: ReplicationMode = ReplicationMode.SLAVE,
  ): Promise<Entity | undefined> {
    const queryBuilder = this.getFormattedCrudGenQueryBuilder(findOptions);
    const returnFunction = this.getOneOrFail(withFail);
    return QueryBuilderHelper.applyOperationToQueryBuilder(
      queryBuilder,
      mode,
      returnFunction,
    );
  }

  private getOneOrFail(withFail?: boolean) {
    return (qb: SelectQueryBuilder<Entity>) => {
      return withFail ? qb.getOne() : qb.getOneOrFail();
    };
  }

  /**
   *
   * @param ids Could be either a object map between entity primaryColumn name and value or a single value of the primaryColumn
   * @returns where filter with conditions on entity primaryColumn
   */
  public generateFilterOnPrimaryColumn(ids: any) {
    const filters: IWhereFilters<Entity> = {};
    const entityPrimaryColumn = this.metadata.primaryColumns.map(
      (x) => x.propertyName,
    );
    entityPrimaryColumn.map((key: keyof Entity) => {
      filters[key] = ` = '${ids[key] ?? ids}'`;
    });

    return filters;
  }

  public generateSelectOnFind(
    fields: (keyof Entity)[],
    gqlType: ClassType<Entity>,
  ) {
    const findOptions: CrudGenFindManyOptions = {};
    const fieldMapper = objectToFieldMapper(gqlType);

    fields.forEach((field) =>
      applySelectOnFind(findOptions, field, fieldMapper.field),
    );
    return findOptions;
  }
}

const repositoryMap = new WeakMap();

export function CGExtendedRepositoryFactory<Entity extends ObjectLiteral>(
  entity: ClassType<Entity>,
): ClassType<GenericTypeORMRepository<Entity>> {
  let cached;
  if ((cached = repositoryMap.get(entity))) return cached;

  const dynamicClass = (name: string) =>
    ({ [name]: class extends GenericTypeORMRepository<Entity> {} }[name]);

  const repo: ClassType<GenericTypeORMRepository<Entity>> = dynamicClass(
    `${entity.name}Repository`,
  );

  repositoryMap.set(entity, repo);

  return repo;
}

// Backwards-compatible alias
export { GenericTypeORMRepository as CGExtendedRepository };
