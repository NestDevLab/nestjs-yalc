import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import {
  SkeletonPhone,
  SkeletonPhoneCondition,
  SkeletonPhoneCreateInput,
  SkeletonPhoneType,
  SkeletonPhoneUpdateInput,
} from '@nestjs-yalc/skeleton-module';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';

export const phonesResource = CrudGenResourceFactory<SkeletonPhone>({
  entityModel: SkeletonPhone,
  backend: {
    service: { dbConnection: 'default' },
    dataloader: { databaseKey: 'phoneNumber', entityModel: SkeletonPhoneType },
  },
  graphql: {
    resolver: {
      dto: SkeletonPhoneType,
      input: {
        create: SkeletonPhoneCreateInput,
        update: SkeletonPhoneUpdateInput,
        conditions: SkeletonPhoneCondition,
      },
      prefix: 'SkeletonModule_',
    },
  },
  rest: {
    dto: SkeletonPhoneType,
    path: 'phones',
    idField: 'ID',
    mutations: {
      create: { decorators: [] },
      update: { decorators: [] },
    },
  },
});

export const PhonesController = phonesResource.controllers[0];
export const phonesResourceProviders = bindGeneratedDataloaderEventEmitter(
  phonesResource.providers,
);
