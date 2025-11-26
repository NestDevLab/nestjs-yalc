import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { SkeletonPhone, SkeletonPhoneType } from '@nestjs-yalc/skeleton-module/src/skeleton-phone.dto';

export const PhonesController = crudRestControllerFactory<SkeletonPhone>({
  entityModel: SkeletonPhone,
  dto: SkeletonPhoneType,
  path: 'phones',
  idField: 'ID',
  serviceToken: 'SkeletonPhoneGenericService',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
