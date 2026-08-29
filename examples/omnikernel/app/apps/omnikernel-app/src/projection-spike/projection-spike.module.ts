import {
  type DynamicModule,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestMiddleware,
  type NestModule,
  Scope,
} from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule, Field, InputType, ObjectType } from '@nestjs/graphql';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import {
  createProjectionGraphqlTypes,
  CrudGenResourceFactory,
  getServiceToken,
  ModelField,
  ModelObject,
  ProjectionResourceService,
} from '@nestjs-yalc/crud-gen';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { EventModule, YalcEventService } from '@nestjs-yalc/event-manager';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import { type DataSource } from 'typeorm';
import {
  projectionRecordDefinition,
  projectionRelationDefinition,
} from './projection-spike.definition';
import {
  createProjectionRelationSchema,
  createProjectionRecordSchema,
  createProjectionSpikeDialect,
  ProjectionRecord,
  ProjectionRelation,
} from './projection-spike.entities';
import {
  ProjectionScopeContext,
  ProjectionSpikeRelationService,
} from './projection-spike.services';

export type ProjectionSpikeDialect = 'sqlite' | 'postgres';

export interface ProjectionSpikeModuleOptions {
  dialect: ProjectionSpikeDialect;
  postgresUrl?: string;
}

export const PROJECTION_SPIKE_DIALECT = Symbol('PROJECTION_SPIKE_DIALECT');

type ProjectionRequest = {
  headers: { authorization?: string };
  projectionScopeId?: string;
};

@Injectable()
class ProjectionSpikeAuthenticationMiddleware implements NestMiddleware {
  use(request: ProjectionRequest, _response: unknown, next: () => void): void {
    const match = /^Bearer projection-spike:(scope-(?:alpha|bravo))$/.exec(
      request.headers.authorization ?? '',
    );
    if (match) request.projectionScopeId = match[1];
    next();
  }
}

@ObjectType('ProjectionRelation')
@ModelObject()
class ProjectionRelationType {
  constructor(data?: Partial<ProjectionRelation>) {
    Object.assign(this, data);
  }

  @Field(() => String)
  @ModelField({})
  guid!: string;

  @Field(() => String)
  @ModelField({})
  sourceGuid!: string;

  @Field(() => String)
  @ModelField({})
  targetGuid!: string;

  @Field(() => String)
  @ModelField({})
  kind!: string;
}

@InputType('ProjectionRelationCreateInput')
@ModelObject()
class ProjectionRelationCreateInput {
  @Field(() => String)
  guid!: string;

  @Field(() => String)
  sourceGuid!: string;

  @Field(() => String)
  targetGuid!: string;

  @Field(() => String)
  kind!: string;
}

@InputType('ProjectionRelationPatchInput')
@ModelObject()
class ProjectionRelationPatchInput {
  @Field(() => String)
  kind!: string;
}

@InputType('ProjectionRelationCondition')
@ModelObject()
class ProjectionRelationCondition {
  @Field(() => String)
  guid!: string;
}

const projectionRecordTypes = createProjectionGraphqlTypes(
  projectionRecordDefinition,
  {
    object: 'ProjectionRecord',
    create: 'ProjectionRecordCreateInput',
    patch: 'ProjectionRecordPatchInput',
    conditions: 'ProjectionRecordCondition',
  },
);

const projectionRecordResource = CrudGenResourceFactory<ProjectionRecord>({
  entityModel: ProjectionRecord,
  backend: false,
  graphql: {
    resolver: {
      dto: projectionRecordTypes.object,
      input: {
        create: projectionRecordTypes.create,
        update: projectionRecordTypes.patch,
        conditions: projectionRecordTypes.conditions,
      },
      queries: {
        getResource: {
          idName: 'guid',
          queryParams: { name: 'getProjectionRecord' },
        },
        getResourceGrid: { queryParams: { name: 'getProjectionRecordGrid' } },
      },
      mutations: {
        createResource: { queryParams: { name: 'createProjectionRecord' } },
        updateResource: { queryParams: { name: 'updateProjectionRecord' } },
        deleteResource: { queryParams: { name: 'deleteProjectionRecord' } },
      },
    },
    serviceToken: getServiceToken(ProjectionRecord),
    dataLoaderToken: getDataloaderToken(ProjectionRecord),
  },
  rest: {
    dto: projectionRecordTypes.object,
    serialize: true,
    path: 'projection-records',
    idField: 'guid',
    serviceToken: getServiceToken(ProjectionRecord),
  },
});

const projectionRelationResource = CrudGenResourceFactory<ProjectionRelation>({
  entityModel: ProjectionRelation,
  backend: false,
  graphql: {
    resolver: {
      dto: ProjectionRelationType,
      input: {
        create: ProjectionRelationCreateInput,
        update: ProjectionRelationPatchInput,
        conditions: ProjectionRelationCondition,
      },
      queries: {
        getResource: {
          idName: 'guid',
          queryParams: { name: 'getProjectionRelation' },
        },
        getResourceGrid: { queryParams: { name: 'getProjectionRelationGrid' } },
      },
      mutations: {
        createResource: { queryParams: { name: 'createProjectionRelation' } },
        updateResource: { queryParams: { name: 'updateProjectionRelation' } },
        deleteResource: { queryParams: { name: 'deleteProjectionRelation' } },
      },
    },
    serviceToken: getServiceToken(ProjectionRelation),
    dataLoaderToken: getDataloaderToken(ProjectionRelation),
  },
  rest: {
    dto: ProjectionRelationType,
    serialize: true,
    path: 'projection-relations',
    idField: 'guid',
    serviceToken: getServiceToken(ProjectionRelation),
  },
});

@Module({})
export class ProjectionSpikeAppModule implements NestModule {
  static register(options: ProjectionSpikeModuleOptions): DynamicModule {
    const dialect = createProjectionSpikeDialect(options.dialect);
    const recordSchema = createProjectionRecordSchema(dialect);
    const relationSchema = createProjectionRelationSchema();
    const dataSourceOptions =
      options.dialect === 'postgres'
        ? {
            type: 'postgres' as const,
            url: options.postgresUrl,
          }
        : {
            type: 'sqlite' as const,
            database: ':memory:',
          };

    return {
      module: ProjectionSpikeAppModule,
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          path: '/graphql',
          context: ({ req }) => {
            const match =
              /^Bearer projection-spike:(scope-(?:alpha|bravo))$/.exec(
                req.headers.authorization ?? '',
              );
            if (match) req.projectionScopeId = match[1];
            return { req };
          },
        }),
        EventEmitterModule.forRoot(),
        EventModule.forRootAsync(),
        TypeOrmModule.forRoot({
          ...dataSourceOptions,
          dropSchema: true,
          synchronize: true,
          autoLoadEntities: true,
        }),
        TypeOrmModule.forFeature([recordSchema, relationSchema]),
      ],
      controllers: [
        ...projectionRecordResource.controllers,
        ...projectionRelationResource.controllers,
      ],
      providers: [
        UUIDScalar,
        ProjectionSpikeAuthenticationMiddleware,
        ProjectionScopeContext,
        { provide: PROJECTION_SPIKE_DIALECT, useValue: dialect },
        {
          provide: getServiceToken(ProjectionRecord),
          scope: Scope.REQUEST,
          useFactory: (
            dataSource: DataSource,
            scope: ProjectionScopeContext,
            projectionDialect: ReturnType<typeof createProjectionSpikeDialect>,
            events: YalcEventService,
          ) =>
            new ProjectionResourceService(
              dataSource.getRepository(ProjectionRecord),
              scope,
              projectionDialect,
              events,
              projectionRecordDefinition,
            ),
          inject: [
            getDataSourceToken(),
            ProjectionScopeContext,
            PROJECTION_SPIKE_DIALECT,
            YalcEventService,
          ],
        },
        {
          provide: getServiceToken(ProjectionRelation),
          scope: Scope.REQUEST,
          useFactory: (
            dataSource: DataSource,
            scope: ProjectionScopeContext,
            events: YalcEventService,
          ) =>
            new ProjectionSpikeRelationService(
              dataSource.getRepository(ProjectionRelation),
              dataSource.getRepository(ProjectionRecord),
              scope,
              events,
              projectionRelationDefinition,
            ),
          inject: [
            getDataSourceToken(),
            ProjectionScopeContext,
            YalcEventService,
          ],
        },
        {
          provide: getDataloaderToken(ProjectionRecord),
          scope: Scope.REQUEST,
          useFactory: (
            service: ProjectionResourceService<ProjectionRecord>,
            scope: ProjectionScopeContext,
          ) =>
            new GQLDataLoader(getFn(service as any), 'guid', undefined, {
              cacheKeyFn: (key) => scope.cacheKey(key),
            }),
          inject: [getServiceToken(ProjectionRecord), ProjectionScopeContext],
        },
        {
          provide: getDataloaderToken(ProjectionRelation),
          scope: Scope.REQUEST,
          useFactory: (
            service: ProjectionSpikeRelationService<ProjectionRelation>,
            scope: ProjectionScopeContext,
          ) =>
            new GQLDataLoader(getFn(service as any), 'guid', undefined, {
              cacheKeyFn: (key) => scope.cacheKey(key),
            }),
          inject: [getServiceToken(ProjectionRelation), ProjectionScopeContext],
        },
        ...projectionRecordResource.providers,
        ...projectionRelationResource.providers,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ProjectionSpikeAuthenticationMiddleware).forRoutes('*');
  }
}
