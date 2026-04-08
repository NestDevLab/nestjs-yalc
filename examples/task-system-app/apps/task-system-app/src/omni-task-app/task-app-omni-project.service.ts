import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniCollectionKind,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import { TaskProject, TaskProjectType } from '@nestjs-yalc/task-system-module';
import { Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';

@Injectable()
export class TaskAppOmniProjectService {
  constructor(
    @InjectRepository(OmniCollectionEntity)
    private readonly collectionRepository: Repository<OmniCollectionEntity>,
    @InjectRepository(OmniRelationEntity)
    private readonly relationRepository: Repository<OmniRelationEntity>,
    @InjectRepository(TaskProject)
    private readonly legacyProjectRepository: Repository<TaskProject>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
  ) {}

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
    const collection = await this.getCollectionOrFail(guid);
    return this.mapper.mapOmniCollectionToProject(collection);
  }

  async create(input: Partial<TaskProject>): Promise<TaskProjectType> {
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

    const entity = this.collectionRepository.create(
      this.mapper.mapProjectToOmniCollection(input),
    );
    await this.collectionRepository.save(entity);
    await this.legacyProjectRepository.save(
      this.legacyProjectRepository.create({
        description: input.description ?? null,
        guid: input.guid,
        name: input.name,
        status: input.status ?? 'active',
      }),
    );
    return this.getById(entity.guid);
  }

  async update(
    guid: string,
    input: Partial<TaskProject>,
  ): Promise<TaskProjectType> {
    const current = await this.getCollectionOrFail(guid);
    const merged: Partial<TaskProject> = {
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
    await this.legacyProjectRepository.update(
      { guid },
      {
        description: merged.description ?? null,
        name: merged.name,
        status: merged.status,
      },
    );

    return this.getById(guid);
  }

  async delete(guid: string) {
    await this.getCollectionOrFail(guid);
    await this.relationRepository.delete({
      sourceRecordId: guid,
    });
    await this.relationRepository.delete({
      targetRecordId: guid,
    });
    await this.collectionRepository.delete({ guid });
    await this.legacyProjectRepository.delete({ guid });
    return { deleted: true };
  }

  async ensureProjectExists(guid: string): Promise<void> {
    await this.getCollectionOrFail(guid);
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
}
