import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service.js';
import { SkeletonUser } from './skeleton-user.entity.js';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { Injectable } from '@nestjs/common';
import returnValue from '@nestjs-yalc/utils/returnValue.js';

export interface SkeletonUserService extends GenericService<SkeletonUser> {
  resetPassword(guid: string): Promise<string>;
}

// We are using a factory function to be able to pass the connection name dynamically
export const skeletonUserServiceFactory = (
  dbConnection: string,
): ClassType<SkeletonUserService> => {
  @Injectable()
  class SkeletonUserService
    extends GenericService<SkeletonUser>
    implements SkeletonUserService
  {
    constructor(
      @InjectRepository(SkeletonUser, dbConnection)
      protected repository: GenericTypeORMRepository<SkeletonUser>,
    ) {
      super(repository);
    }

    async resetPassword(guid: string) {
      // create a new random password
      const newPass = Array(12)
        .fill('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
        .map(function (x) {
          return x[crypto.randomInt(0, 10_000) % x.length];
        })
        .join('');

      // update the selected user with the new password
      await this.getRepositoryWrite().update(
        { guid },
        { password: returnValue<string>(newPass) },
      );

      // send it back to the client
      return newPass;
    }
  }

  return SkeletonUserService;
};
