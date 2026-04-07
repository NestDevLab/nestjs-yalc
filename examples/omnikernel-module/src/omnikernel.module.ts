import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniNamedEntity } from './base/omni-named.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { omniExternalRefProvidersFactory } from './omni-external-ref.resolver.js';
import { omniNamedProvidersFactory } from './omni-named.resolver.js';
import { omniRecordProvidersFactory } from './omni-record.resolver.js';
import { omniRelationProvidersFactory } from './omni-relation.resolver.js';

@Global()
@Module({})
export class OmniKernelModule {
  static register(dbConnection: string): DynamicModule {
    const omniNamedProviders = omniNamedProvidersFactory(dbConnection);
    const omniRecordProviders = omniRecordProvidersFactory(dbConnection);
    const omniRelationProviders = omniRelationProvidersFactory(dbConnection);
    const omniExternalRefProviders =
      omniExternalRefProvidersFactory(dbConnection);

    return {
      module: OmniKernelModule,
      imports: [
        TypeOrmModule.forFeature(
          [
            OmniNamedEntity,
            OmniRecordEntity,
            OmniRelationEntity,
            OmniExternalRefEntity,
          ],
          dbConnection,
        ),
      ],
      providers: [
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        ...omniNamedProviders.providers,
        ...omniRecordProviders.providers,
        ...omniRelationProviders.providers,
        ...omniExternalRefProviders.providers,
      ],
      exports: [
        EventEmitter2,
        ...omniNamedProviders.providers,
        ...omniRecordProviders.providers,
        ...omniRelationProviders.providers,
        ...omniExternalRefProviders.providers,
      ],
    };
  }
}
