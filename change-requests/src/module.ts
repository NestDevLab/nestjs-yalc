import {
  DynamicModule,
  FactoryProvider,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import {
  CHANGE_REQUEST_ADAPTERS,
  ChangeRequestAdapterRegistry,
} from './registry.js';
import { ChangeRequestEntity, ChangeRequestItemEntity } from './entities.js';
import { ChangeRequestService } from './service.js';
import {
  CHANGE_REQUEST_ITEM_REPOSITORY,
  CHANGE_REQUEST_REPOSITORY,
} from './tokens.js';
import type { ChangeRequestAdapter } from './types.js';

export interface ChangeRequestModuleOptions {
  adapters?: ChangeRequestAdapter[];
  imports?: ModuleMetadata['imports'];
  dataSource?: string;
}

export interface ChangeRequestModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: FactoryProvider['inject'];
  dataSource?: string;
  useFactory: (
    ...args: any[]
  ) => ChangeRequestAdapter[] | Promise<ChangeRequestAdapter[]>;
}

@Module({})
export class ChangeRequestModule {
  static forRoot(
    adaptersOrOptions: ChangeRequestAdapter[] | ChangeRequestModuleOptions = [],
    imports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    const options = Array.isArray(adaptersOrOptions)
      ? { adapters: adaptersOrOptions, imports }
      : adaptersOrOptions;
    return this.build(
      { provide: CHANGE_REQUEST_ADAPTERS, useValue: options.adapters ?? [] },
      options.imports,
      options.dataSource,
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
      options.dataSource,
    );
  }

  private static build(
    provider: Provider,
    imports: ModuleMetadata['imports'] = [],
    dataSource?: string,
  ): DynamicModule {
    return {
      module: ChangeRequestModule,
      imports: [
        ...imports,
        TypeOrmModule.forFeature(
          [ChangeRequestEntity, ChangeRequestItemEntity],
          dataSource,
        ),
      ],
      providers: [
        provider,
        {
          provide: CHANGE_REQUEST_REPOSITORY,
          useExisting: getRepositoryToken(ChangeRequestEntity, dataSource),
        },
        {
          provide: CHANGE_REQUEST_ITEM_REPOSITORY,
          useExisting: getRepositoryToken(ChangeRequestItemEntity, dataSource),
        },
        ChangeRequestAdapterRegistry,
        ChangeRequestService,
      ],
      exports: [ChangeRequestAdapterRegistry, ChangeRequestService],
    };
  }
}
