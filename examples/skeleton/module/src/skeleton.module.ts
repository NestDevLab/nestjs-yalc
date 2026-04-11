import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
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
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
      exports: [
        EventEmitter2,
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
    };
  }
}
