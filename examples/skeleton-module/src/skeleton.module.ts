import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const eventEmitter2Token = () => require('eventemitter2').EventEmitter2;
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
          provide: eventEmitter2Token(),
          useFactory: () => {
            const EventEmitter2 = eventEmitter2Token();
            return new EventEmitter2();
          },
        },
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
      exports: [
        eventEmitter2Token(),
        ...skeletonPhoneProviders.providers,
        ...skeletonUserProviders.providers,
      ],
    };
  }
}
