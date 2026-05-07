import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import { OmniExternalRefEntity } from '@nestjs-yalc/omnikernel-module';
import { TaskAppOmniExternalRefService } from '../omni-task-app/task-app-omni-external-ref.service';
import {
  TaskExternalRefCondition,
  TaskExternalRefCreateInput,
  TaskExternalRefType,
  TaskExternalRefUpdateInput,
} from './task-external-ref.dto';

export const taskExternalRefProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    resolver: {
      dto: TaskExternalRefType,
      input: {
        create: TaskExternalRefCreateInput,
        update: TaskExternalRefUpdateInput,
        conditions: TaskExternalRefCondition,
      },
      prefix: 'TaskSystem_',
    },
    service: {
      dbConnection,
      entityModel: OmniExternalRefEntity,
      provider: {
        provide: 'TaskExternalRefGenericService',
        useExisting: TaskAppOmniExternalRefService,
      },
    },
    dataloader: { databaseKey: 'guid' },
  });

const taskExternalRefProviderSet = taskExternalRefProvidersFactory('default');

export const taskExternalRefProviders = taskExternalRefProviderSet.providers;
export const taskExternalRefDataloaderEventEmitterToken =
  (taskExternalRefProviders.find((provider) => {
    const providerDef = provider as any;
    const token =
      typeof providerDef.provide === 'function'
        ? providerDef.provide.name
        : providerDef.provide;
    return typeof token === 'string'
      ? token.includes('Dataloader')
      : token === 'OmniExternalRefEntityDataloader';
  }) as any)?.inject?.[1];
