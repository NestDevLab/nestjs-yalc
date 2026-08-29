import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { type DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import { OmniApiModule } from './omni-api.module';

export type OmniKernelB2Dialect = 'sqlite' | 'postgres';

export interface OmniKernelB2TestAppOptions {
  dialect: OmniKernelB2Dialect;
  postgresUrl?: string;
}

type OmniKernelB2Request = {
  headers?: { authorization?: string };
};

const scopeFromAuthenticatedRequest = (
  request: unknown,
): string | undefined => {
  const authorization = (request as OmniKernelB2Request | undefined)?.headers
    ?.authorization;
  return /^Bearer omnikernel-b2:(scope-(?:alpha|bravo))$/.exec(
    authorization ?? '',
  )?.[1];
};

@Module({})
export class OmniKernelB2TestAppModule {
  static register(options: OmniKernelB2TestAppOptions): DynamicModule {
    if (options.dialect === 'postgres' && !options.postgresUrl) {
      throw new TypeError(
        'A PostgreSQL URL is required for the postgres test dialect.',
      );
    }

    const dataSourceOptions =
      options.dialect === 'postgres'
        ? { type: 'postgres' as const, url: options.postgresUrl }
        : { type: 'sqlite' as const, database: ':memory:' };

    return {
      module: OmniKernelB2TestAppModule,
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          path: '/graphql',
          context: ({ req }) => ({ req }),
        }),
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          ...dataSourceOptions,
          dropSchema: true,
          synchronize: true,
          autoLoadEntities: true,
        }),
        OmniApiModule.register({
          dbConnection: 'default',
          resolveScope: scopeFromAuthenticatedRequest,
          relationKinds: ['blocks'],
        }),
      ],
      providers: [UUIDScalar],
    };
  }
}
