import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniCollectionKind,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import { TaskProject } from '@nestjs-yalc/task-system-module/src/task-project.entity';
import { DeepPartial, FindOperator, In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import {
  TaskProjectCreateInput,
  TaskProjectType,
} from '../projects/task-project.dto';

@Injectable()
export class TaskAppOmniProjectService {
  constructor(
    @InjectRepository(OmniCollectionEntity)
    private readonly collectionRepository: Repository<OmniCollectionEntity>,
    @InjectRepository(OmniRelationEntity)
    private readonly relationRepository: Repository<OmniRelationEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
  ) {}

  supportsStructuredGraphqlFilters() {
    return false;
  }

  async list(query: TaskOmniPageQuery = {}) {
    const { skip, startRow, take } = this.mapper.parsePageQuery(query);
    const [collections, count] = await this.collectionRepository.findAndCount({
      order: {
        createdAt: 'ASC',
      },
      skip,
      take,
      where: {
        collectionKind: OmniCollectionKind.Collection,
      },
    });

    return this.mapper.buildPage(
      collections.map((collection) =>
        this.mapper.mapOmniCollectionToProject(collection),
      ),
      startRow,
      count,
    );
  }

  async getById(guid: string): Promise<TaskProjectType> {
    return this.getTaskProjectOrFail(guid);
  }

  async create(
    input: Partial<TaskProjectCreateInput>,
  ): Promise<TaskProjectType> {
    return this.createEntity(input) as Promise<TaskProjectType>;
  }

  async update(
    guid: string,
    input: Partial<TaskProjectCreateInput>,
  ): Promise<TaskProjectType> {
    return this.updateEntity({ guid }, input) as Promise<TaskProjectType>;
  }

  async delete(guid: string) {
    await this.deleteEntity({ guid });
    return { deleted: true };
  }

  async getEntity(
    where: Partial<TaskProject> | Partial<TaskProject>[] | string,
    _fields?: (keyof TaskProject)[],
    _relations?: string[],
    _databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<TaskProjectType | null | undefined> {
    const collection = await this.collectionRepository.findOne({
      where: this.mapCrudGenWhereToOmniWhere(where),
    });

    if (!collection) {
      if (options?.failOnNull) {
        throw this.events.errorNotFound('projects.omni.not-found', {
          data: { conditions: where },
          response: { message: 'Project not found' },
        });
      }

      return null;
    }

    return this.mapper.mapOmniCollectionToProject(collection);
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskProject>,
    withCount?: false,
  ): Promise<TaskProjectType[]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskProject>,
    withCount: true,
  ): Promise<[TaskProjectType[], number]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskProject>,
    withCount = false,
  ): Promise<[TaskProjectType[], number] | TaskProjectType[]> {
    const skip = findOptions.skip ?? 0;
    const take = findOptions.take;
    const where = this.mapCrudGenWhereToOmniWhere(
      findOptions.where as Partial<TaskProject> | undefined,
    );
    const collections = await this.collectionRepository.find({
      order: (findOptions.order as any) ?? { createdAt: 'ASC' },
      skip,
      take,
      where,
    });

    if (!withCount) {
      return collections.map((collection) =>
        this.mapper.mapOmniCollectionToProject(collection),
      );
    }

    const count = await this.collectionRepository.count({ where });

    return [
      collections.map((collection) =>
        this.mapper.mapOmniCollectionToProject(collection),
      ),
      count,
    ];
  }

  async createEntity(
    input: DeepPartial<TaskProject>,
    _findOptions?: CrudGenFindManyOptions<TaskProject>,
    returnEntity = true,
  ): Promise<TaskProjectType | boolean> {
    if (!input.guid || !input.name) {
      throw this.events.errorBadRequest('projects.omni.create.invalid', {
        data: {
          guid: input.guid ?? null,
          name: input.name ?? null,
        },
        response: {
          message: 'Project guid and name are required',
        },
      });
    }

    const createInput: Partial<TaskProjectCreateInput> = {
      description: input.description,
      guid: input.guid,
      name: input.name,
      status: input.status,
    };

    const entity = this.collectionRepository.create(
      this.mapper.mapProjectToOmniCollection(createInput),
    );
    await this.collectionRepository.save(entity);

    if (!returnEntity) {
      return true;
    }

    return this.getTaskProjectOrFail(entity.guid);
  }

  async updateEntity(
    conditions: Partial<TaskProject>,
    input: DeepPartial<TaskProject>,
    _findOptions?: CrudGenFindManyOptions<TaskProject>,
    returnEntity = true,
  ): Promise<TaskProjectType | boolean> {
    const guid = this.requireGuid(conditions);
    const current = await this.getCollectionOrFail(guid);
    const merged: Partial<TaskProjectCreateInput> = {
      guid,
      description:
        input.description !== undefined
          ? input.description
          : current.summary ?? null,
      name: input.name ?? current.title,
      status:
        input.status ?? this.mapper.mapOmniCollectionToProject(current).status,
    };

    await this.collectionRepository.update(
      { guid },
      this.mapper.mapProjectToOmniCollection(merged),
    );

    if (!returnEntity) {
      return true;
    }

    return this.getTaskProjectOrFail(guid);
  }

  async deleteEntity(conditions: Partial<TaskProject>): Promise<boolean> {
    const guid = this.requireGuid(conditions);
    await this.getCollectionOrFail(guid);
    await this.relationRepository.delete({
      sourceRecordId: guid,
    });
    await this.relationRepository.delete({
      targetRecordId: guid,
    });
    await this.collectionRepository.delete({ guid });
    return true;
  }

  async ensureProjectExists(guid: string): Promise<void> {
    await this.getCollectionOrFail(guid);
  }

  private async getTaskProjectOrFail(guid: string) {
    const collection = await this.getCollectionOrFail(guid);
    return this.mapper.mapOmniCollectionToProject(collection);
  }

  private async getCollectionOrFail(guid: string) {
    const collection = await this.collectionRepository.findOne({
      where: {
        guid,
        kind: OmniCollectionKind.Collection,
      },
    });

    if (!collection) {
      throw this.events.errorNotFound('projects.omni.not-found', {
        data: {
          projectId: guid,
        },
        response: {
          message: 'Project not found',
        },
      });
    }

    return collection;
  }

  private requireGuid(conditions: Partial<TaskProject>) {
    if (!conditions.guid) {
      throw this.events.errorBadRequest('projects.omni.conditions.invalid', {
        response: { message: 'Project guid is required' },
      });
    }

    return conditions.guid;
  }

  private mapCrudGenWhereToOmniWhere(
    where?: Partial<TaskProject> | Partial<TaskProject>[] | string,
  ) {
    const baseWhere = {
      collectionKind: OmniCollectionKind.Collection,
    };

    if (!where) {
      return baseWhere;
    }

    if (typeof where === 'string') {
      return {
        ...baseWhere,
        guid: where,
      };
    }

    if (Array.isArray(where)) {
      return where.map((item) => this.mapCrudGenWhereToOmniWhere(item));
    }

    const guid = where.guid as string | FindOperator<string> | undefined;

    return {
      ...baseWhere,
      ...(guid instanceof FindOperator
        ? this.mapGuidFindOperator(guid)
        : guid
        ? { guid }
        : {}),
      ...(where.status ? { status: where.status } : {}),
    };
  }

  private mapGuidFindOperator(guid: FindOperator<string>) {
    if (guid.type === 'in' && Array.isArray(guid.value)) {
      return {
        guid: In(guid.value as string[]),
      };
    }

    return { guid };
  }
}
