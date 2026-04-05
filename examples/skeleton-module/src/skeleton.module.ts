import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as eventemitter2 from 'eventemitter2';
import { skeletonUserProvidersFactory } from './skeleton-user.resolver.js';
import { skeletonPhoneProvidersFactory } from './skeleton-phone.resolver.js';
import { SkeletonPhone } from './skeleton-phone.entity.js';
import { SkeletonUser } from './skeleton-user.entity.js';

@Module({})
export class SkeletonModule {
  static register(dbConnection: string): DynamicModule {
    const skeletonPhoneProviders = skeletonPhoneProvidersFactory(dbConnection);
    const skeletonUserProviders = skeletonUserProvidersFactory(dbConnection);

    return {
      module: SkeletonModule,
      imports: [
        TypeOrmModule.forFeature([SkeletonPhone, SkeletonUser], dbConnection),
      ],
      providers: [
        {
          provide: eventemitter2.EventEmitter2,
          useValue: new eventemitter2.EventEmitter2(),
        },
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
      exports: [
        eventemitter2.EventEmitter2,
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
    };
  }
}
