import {
  DynamicModule,
  FactoryProvider,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CHANGE_REQUEST_ADAPTERS,
  ChangeRequestAdapterRegistry,
} from './registry.js';
import { ChangeRequestEntity, ChangeRequestItemEntity } from './entities.js';
import { ChangeRequestService } from './service.js';
import type { ChangeRequestAdapter } from './types.js';

export interface ChangeRequestModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: FactoryProvider['inject'];
  useFactory: (
    ...args: any[]
  ) => ChangeRequestAdapter[] | Promise<ChangeRequestAdapter[]>;
}

@Module({})
export class ChangeRequestModule {
  static forRoot(
    adapters: ChangeRequestAdapter[] = [],
    imports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    return this.build(
      { provide: CHANGE_REQUEST_ADAPTERS, useValue: adapters },
      imports,
    );
  }

  static forRootAsync(options: ChangeRequestModuleAsyncOptions): DynamicModule {
    return this.build(
      {
        provide: CHANGE_REQUEST_ADAPTERS,
        useFactory: options.useFactory,
        inject: options.inject,
      },
      options.imports,
    );
  }

  private static build(
    provider: Provider,
    imports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    return {
      module: ChangeRequestModule,
      imports: [
        ...imports,
        TypeOrmModule.forFeature([
          ChangeRequestEntity,
          ChangeRequestItemEntity,
        ]),
      ],
      providers: [provider, ChangeRequestAdapterRegistry, ChangeRequestService],
      exports: [ChangeRequestAdapterRegistry, ChangeRequestService],
    };
  }
}
