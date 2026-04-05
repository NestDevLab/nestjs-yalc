# API Creation with CrudGen system

This project is backed by NestJS therefore the creation of a REST endpoint and GraphQL operations can be generally done by following the NestJS documentation creating the providers and injecting them into the related app (this is also explained in our legacy endpoint creation guide).
Generally speaking, a CRUD endpoint is always composed by the following components:

- Resolver (GraphQL API layer)
- Controller (REST and generic API layer)
  - DTO (The Data Transfer Object that defines the structure of what you expose)
  - Dataloader
- Service (where the business logic resides)
- Repository (where to handle the connection with the datastores)
- Entity (The class used for your ORM)

**However**, since most of the time the codebase of the providers mentioned above is similar between all the CRUD endpoints, we have created
a collection of libraries called NestJS-Yalc that allows us to generate the generic logic of a CRUD endpoint
by using a factory pattern. It helps to reduce the boilerplate code exponentially and avoid to unit test the same code multiple time, allowing you to
focus only on the specific business logic that shouldn't/can't be generalized.

For more insights about this concept you can have a look at this slides:

https://drive.google.com/file/d/1h2Te2SZhuIp-PxElkW99YquYa_VChfH3/view?usp=sharing

## Creation of CRUD operations with our Resolver factory function

### Getting started

**DISCLAIMERS**:

- In the code snippets below the `imports` are not included since they could change overtime.

- The examples below do not include the documentation about how to create a NestJS app, how to establish a TypeORM database connection and all the steps to setup
  a working NestJS application. Please refer to the NestJS documentation for it.

- The code below needs the `@nestjs/graphql` plugin installed with the following configurations:

- **All the examples below are contained in `examples/skeleton-module` folder available in this repo.** It's a fully working module that you can import in your system to test it.

This is used to avoid defining graphql `@Field` decorators on property types that can be detected automatically (read the NestJS doc to know more about it)

```json
"plugins": [
      {
        "name": "@nestjs/graphql",
        "options": {
          "typeFileNameSuffix": [
            ".input.ts",
            ".entity.ts",
            ".type.ts"
          ],
          "introspectComments": true
        }
      }
```

To create a simple MySQL CRUD API you need 2 files: the Entity and the Resolver Factory (The DTO file is optional but strongly suggested)

The bare minimum configuration to create a CRUD is by setting up an entity and generating the needed components by using the `CrudGenDependencyFactory` method.

So if we want to implement a CRUD API to manage a collection of phone numbers we can use the following code.

First create the entity `user-phone.entity.ts`

```typescript
@Entity('user-phone')
@Index('unique_phone', ['phoneNumber', 'userId'], { unique: true })
@ObjectType()
@ModelObject()
export class UserPhone extends EntityWithTimestamps(BaseEntity) {
  // if not specified elsewhere
  // ID field name will be used by default from the single
  // resource get query as argument to use to select the resource
  @PrimaryGeneratedColumn('increment')
  ID: number;

  @Column('varchar', { length: 20 })
  phoneNumber: string;

  // this will be used as a foreign key of the user table in a following example
  @Column('varchar', { length: 36 })
  userId: string;
}
```

Then create the related resolver `user-phone.resolver.ts`

```typescript
export const userPhoneProvidersDeps = CrudGenDependencyFactory<UserPhone>({
  // if DTOs are not configured, the entity will be used to
  // define the graphql types
  entityModel: UserPhone,
  // if you have a different db connection than the default one, you can set this value accordingly
  service: { dbConnection: 'default' },
  // what's the primary key used by the dataloader to load the resource when not specified
  // elsewhere
  dataloader: { databaseKey: 'ID' },
});
```

The `CrudGenDependencyFactory` will generate at runtime the Resolver, the Service, the Dataloader, the Repository and, in this case,
the DTOs injecting them within the `userPhoneProvidersDeps`variable that has this interface:

```typescript
export interface IDependencyObject<Entity> {
  providers: Array<FactoryProvider | Provider>;
  repository: ClassType<CrudGenRepository<Entity>>;
}
```

These 2 properties are used differently:

- `providers` should be added to your NestJS module providers list.
- `repository` is the repository class returned by the factory and is mainly useful as a token/reference for advanced customization.

For the normal TypeORM module wiring shown in the live examples, register the **entity classes** with `TypeOrmModule.forFeature(...)`, not the factory-returned repository class.

Example:

```typescript
import { userPhoneProvidersDeps } from './user-phone.resolver.ts';

@Module({})
export class AppModule {
  static register(dbConnection: string): DynamicModule {
    return {
      module: UserModule,
      imports: [TypeOrmModule.forFeature([UserPhone], dbConnection)],
      providers: [...userPhoneProvidersDeps.providers],
      exports: [...userPhoneProvidersDeps.providers],
    };
  }
}
```

**NOTE:** Also remember to add the `UserPhone` entity to the entity list of your TypeORM configuration.

That's it! This is the bare minimum code to create a full featured GraphQL CRUD based on a single entity, the operations generated are the following:

#### Queries:

- `getUserPhone(ID):` returns a single `UserPhone` resource selected by the ID.
- `getUserPhoneGrid(sorting, filters, startRow, endRow, join):` returns a GraphQL **connection-style wrapper** with `nodes` and `pageData`, not a raw list.

At the GraphQL schema level, generated grid queries are the place where pagination args such as `startRow` / `endRow` belong.

#### Mutations:

- `createUserPhone(input):` create a single UserPhone by specifying its own values within the input
- `updateUserPhone(input, conditions):` update a single UserPhone by passing the input and the conditions to select the resource to update
- `deleteUserPhone(conditions):` delete a single UserPhone by passing the conditions needed to select the resource to delete

Please refer to the documentation on how to use NestJS-Yalc CrudGen library to learn how to configure the query and mutation parameters properly.

**NOTE:** You can use our library based on **graphq-sofa** in order to expose RestAPI endpoints based on the queries and mutations generated above, or you can combine GraphQL and REST the way the SQLite **skeleton app** does (see `examples/skeleton-app`), using:

- `CrudGenDependencyFactory` for resolvers/services/dataloaders,
- `crudRestControllerFactory` for REST controllers on top of the same `GenericService`,
- EventManager + DefaultError for consistent error handling,
- ApiStrategy for HTTP/local calls between services.

However, this is a very basic and non real-world example just to show you that the system is able to generate everything on his
own with just a TypeORM entity.

### A more advanced approach

To make the endpoints complete, we want to define more configurations to:

- Define GraphQL nested resource with Join and Resolve Fields (Dataloader)
- Define DTO with field visibility, graphql parameters, validation, mapping and value manipulation
- Define endpoint authorization and decorators
- Define options, custom names and graphql parameters for auto-generated queries/mutations
- Define Extra arguments/input for autogenerated queries/mutations
- Define default values for query/mutation arguments
- Define Custom Queries and Mutations

Every single piece of the `CrudGenDependencyFactory` is extremely configurable.

In the following example we are going to create a `skeleton-user.resolver.ts` file to show you all the configurations available
on this system and connect this resource

#### Define GraphQL nested resource with Join and Resolve Fields (Dataloader)

To complete the `UserPhone` entity, we need to create the relationship with an User entity where we can define the owner of the
phone number.

The NestJS-Yalc system integrates a feature to convert an entity property to a nested resource (ResolveField) that can be resolved
via 2 strategies:

1. **Dataloader fetching:** high performance and cache possibility, no data intersection available
2. **Join:** lower performance but data intersection available.

To define a field as a relationship and enable the 2 features above, we should use both the TypeORM and the CrudGen decorators.

Example (`skeleton-user.entity.ts`):

```typescript
@Entity('user')
@ObjectType()
@ModelObject()
export class SkeletonUser extends EntityWithTimestamps(BaseEntity) {
  // guid should be always required in SQL queries to make sure that the relation
  // is always resolved, and it should be exposed as a UUID Scalar to GraphQL
  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar')
  firstName: string;

  @Column('varchar')
  lastName: string;

  @Column('varchar', { unique: true })
  email: string;

  @Column('varchar')
  password: string;

  @ModelField({
    dst: `CONCAT(firstName,' ', lastName)`,
    mode: 'derived',
    isSymbolic: true,
    gqlOptions: {
      description: "It's the combination of firstName and lastName",
    },
    denyFilter: true,
  })
  // virtual column, not selectable
  // handled by the @ModelField
  @Column({
    select: false,
    insert: false,
    update: false,
    type: 'varchar',
  })
  fullName: string;

  @ModelField<UserPhone>({
    relation: {
      type: () => UserPhone,
      relationType: 'one-to-many',
      sourceKey: { dst: 'guid', alias: 'guid' },
      targetKey: { dst: 'userId', alias: 'userId' },
    },
  })
  @OneToMany(() => UserPhone, (meta) => meta.SkeletonUser)
  @JoinColumn([{ name: 'guid', referencedColumnName: 'userId' }])
  UserPhone?: UserPhone[];
}
```

while in the `UserPhone` entity (`user-phone.entity.ts`):

```typescript
@Entity('user-phone')
@Index('unique_phone', ['phoneNumber', 'userId'], { unique: true })
@ObjectType()
@ModelObject()
export class UserPhone extends EntityWithTimestamps(BaseEntity) {
  // if not specified elsewhere
  // ID field name will be used by default from the single
  // resource get query as argument to use to select the resource
  @PrimaryGeneratedColumn('increment')
  ID: number;

  @Column('varchar', { length: 20 })
  phoneNumber: string;

  // this will be used as a foreign key of the user table in a following example
  @Column('varchar', { length: 36 })
  userId: string;

  @ModelField<SkeletonUser>({
    relation: {
      type: () => SkeletonUser,
      relationType: 'many-to-one',
      sourceKey: { dst: 'userId', alias: 'userId' },
      targetKey: { dst: 'guid', alias: 'guid' },
    },
  })
  @ManyToOne(() => SkeletonUser, (meta) => meta.UserPhone)
  @JoinColumn([{ name: 'userId', referencedColumnName: 'guid' }])
  SkeletonUser?: SkeletonUser;
}
```

**NOTE 1:** basic TypeORM relation decorators are often enough for very simple cases, but `@ModelField` is no longer just an optional hint. In practice it becomes part of the execution contract when you need:
- custom GraphQL names/types
- explicit `sourceKey` / `targetKey` aliases
- reliable dataloader token resolution via `relation.type`
- relation fields declared on DTOs rather than entities

**NOTE 2:** Prefer defining `@ModelField` on DTOs / GraphQL types rather than on entities. The examples above use entities for brevity, but real applications should usually separate persistence concerns from GraphQL exposure.

#### Define DTO with field visibility, validation, mapping, and value manipulation

So far, we've seen how to generate CRUD Graphql operations by using the `CrudGenDependencyFactory` and an `Entity`. However, we do not want to couple the
persistence layer with the presentation layer. Therefore, we should create a DTO class to define what's the structure of the data we want to expose.

In GraphQL DTOs are represented by the GraphQL Types (response payload) and Inputs (argument payload). To define a DTO we normally want to reuse
what should not be changed from the entity and redefine some properties instead (DRY approach).

We can create a `skeleton-user.type.ts` with the following code and move all the GraphQL related decorators within this file.

Also change the entity GraphQL decoration to `@ObjectType({ isAbstract: true })` if the DTO/type becomes the public GraphQL object. Keep `@ModelObject` metadata where needed for CRUD-Gen mapping reuse.

Example:

```typescript
@ObjectType()
@ModelObject()
export class SkeletonUserType extends SkeletonUser {
  @ModelField<UserPhone>({
    relation: {
      type: () => UserPhone,
      relationType: 'one-to-many',
      sourceKey: { dst: 'guid', alias: 'guid' },
      targetKey: { dst: 'userId', alias: 'userId' },
    },
  })
  UserPhone?: UserPhone[];

  @HideField()
  password: string;

  // guid should be always required in SQL queries to make sure that the relation
  // is always resolved, and it should be exposed as a UUID Scalar to GraphQL
  @ModelField({
    gqlType: returnValue(UUIDScalar),
    gqlOptions: {
      name: 'ID',
      description: 'The user ID generated with UUID',
    },
    isRequired: true,
  })
  guid: string;

  @ModelField({
    gqlOptions: {
      description: "It's the combination of firstName and lastName",
    },
    denyFilter: true,
  })
  fullName: string;
}

/**
 * Here all the input type for Graphql
 */
@InputType()
@ModelObject()
export class SkeletonUserCreateInput extends OmitType(
  SkeletonUserType,
  ['SkeletonPhone'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: SkeletonUserType })
export class SkeletonUserCondition extends PartialType(
  SkeletonUserCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: SkeletonUserType })
export class SkeletonUserUpdateInput extends OmitType(
  SkeletonUserType,
  ['guid', 'SkeletonPhone'] as const,
  InputType,
) {}
```

In the example above we've achieved the following:

1. We've moved most of the `@ModelField` into the DTO, since they are decorators related to GraphQL. Only the configurations related to TypeORM remained in the entity.
2. We're hiding the information about the user `password` because we do not want to expose such information to the final user.
3. We're exposing the `guid` database field as `ID` in GraphQL and added the description for the graphql playground. Our system will automatically map it.
4. We're creating some input types that will be used to define the parameters needed for our mutations, notice that we use PartialType/OmitType from the
   nestjs/graphql library to remove properties from the extended type that we do not need

There are many other features available NestJS-Yalc/crud-gen, including JSON field handling, middlewares, default values and many other. Please, refer
to the documentation of the `@ModelField` and `@ModelObject` decorator to know more.

As last step, we have to define our DTO and the entity within the `CrudGenDependencyFactory`, hence the `skeleton-user.resolver.ts` will look like this (see also `examples/skeleton-module` and the SQLite skeleton app in `examples/skeleton-app` for a complete, runnable version):

```typescript
export const skeletonUserProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<SkeletonUser>({
    // The model used for TypeORM
    entityModel: SkeletonUser,
    resolver: {
      dto: SkeletonUserType,
      input: {
        create: SkeletonUserCreateInput,
        update: SkeletonUserUpdateInput,
        conditions: SkeletonUserCondition,
      },
    },
    service: { dbConnection },
    dataloader: { databaseKey: 'guid' },
  });
```

#### How to define authorization and decorators on autogenerated operations

One of the features that can't miss in a system with user login is the authorization of the endpoints.

You can implement a NestJS [Role Guard](https://docs.nestjs.com/guards#role-based-authentication) to authorize your endpoint

This is an example of how to implement a basic Role Guard assuming that you pass the role of the user within the request context

```typescript
export enum RoleEnum {
  PUBLIC,
  USER,
  ADMIN,
}

export function RoleAuth(requiredRoles: RoleEnum[]): ClassType<CanActivate> {
  @Injectable()
  class RolesGuard implements CanActivate {
    public roles: RoleEnum[] = [];
    public userId = '';

    canActivate(context: ExecutionContext): boolean {
      const ctx = GqlExecutionContext.create(context);
      const role = ctx.getContext().req.role;

      return (
        !requiredRoles.length ||
        requiredRoles.some(
          (requiredRole) =>
            requiredRole === RoleEnum.PUBLIC || requiredRole === role,
        )
      );
    }
  }

  return RolesGuard;
}
```

Then you can use the `RoleAuth` factory method to define the role needed to execute a graphql operation on your
resolver file.

Example on how to apply the RoleAuth on the query:

```typescript
export const skeletonUserProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<SkeletonUser>({
    // The model used for TypeORM
    entityModel: SkeletonUser,
    resolver: {
      dto: SkeletonUserType,
      input: {
        create: SkeletonUserCreateInput,
        update: SkeletonUserUpdateInput,
        conditions: SkeletonUserCondition,
      },
      queries: {
        // SkeletonModule_getSkeletonUser
        getResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          idName: 'guid',
        },
        getResourceGrid: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
        },
      },
      mutations: {
        createResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
        },
        updateResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
        },
        deleteResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
        },
      },
    },
    service: { dbConnection },
    dataloader: { databaseKey: 'guid' },
  });
```

#### Define custom names and graphql parameters for auto-generated queries/mutations

In the example above we've seen how to specify some options for both the autogenerated queries and the mutations.
By using the same properties you can define graphql parameters and many other options for each operation.

For instance:

```typescript
    updateResource: {
      queryParams: {
        name: 'editUser', // instead of `updateSkeletonUser`
        description: 'Role: user. Update an existing user',
      },
    },
    deleteResource: {
      queryParams: {
        name: 'removeUser', // insted of `deleteSkeletonUser`
        description: 'Role: user. Delete an existing user',
      },
    },
```

The code above allows you to define a different name for every operation instead of the autogenerated one.
Moreover, it specifies the description to show inside the graphql playground

Play a little bit with the available options to properly configure your operations accordingly to your needs.

Some of the available features:

- You can set a prefix to the name of every operation by defining the `prefix` parameter at the first level of the `resolver` object.
- You can set the `readonly` property to disable all the mutations or set any operations on `disabled` to not generate it automatically.

#### Define Extra arguments/input for autogenerated queries/mutations

The generated CRUD operations are already providing the default arguments to filter resources via CrudGen rules, however, there are cases where you want to define
required filters or extra inputs.

To do so you can add extraArgs to queries and extraInputs to mutations

##### extraArgs

the extraArgs option is used to define extra filters for every query based on a strategy.

Let's say for example that we want to force to filter the list of the users by `firstName` or `lastName` (but not without any of them), we can configure
the `getResourceGrid` in this way:

```typescript
getResourceGrid: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      extraArgs: {
        firstName: {
          filterCondition: GeneralFilters.CONTAINS,
          filterType: FilterType.TEXT,
          options: {
            type: returnValue(String),
            nullable: true,
          },
        },
        lastName: {
          filterCondition: GeneralFilters.CONTAINS,
          filterType: FilterType.TEXT,
          options: {
            type: returnValue(String),
            nullable: true,
          },
        },
      },
      extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
      queryParams: {
        // name: 'getSkeletonUserGrid',
        description: 'Get a list of users',
      },
    },
  },
```

As you can see in this example we're instructing the system to create 2 extra args: `lastName` and `firstName` applying the strategy `AT_LEAST_ONE`
that means you're forced to specify at least one of the filters.

There are many more options that you can use to configure your extra arguments, including default values, hidden pre-set filters etc.
Play around with the configuration to learn how to use them.

##### extraInputs

Similar to extraArgs, the extraInputs add arguments to your mutations but in this case they are used to extend the input arguments with extra information with the possibility
as well to manipulate the default `input`

Example:

```typescript
    createResource: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      extraInputs: {
        lowerCaseEmail: {
          gqlOptions: {
            description: 'Force the email to be in lowercase',
            type: returnValue(Boolean),
            defaultValue: true,
            nullable: true,
          },
          middleware: (_ctx, input: SkeletonUserType, value: boolean) => {
            if (value === true) {
              input.email = input.email.toLowerCase();
            }
          },
        },
      },
      queryParams: {
        description: 'Create a new user',
      },
    },
```

In this example you can see that we've created an extra input called `lowerCaseEmail` that when it's set to `true` it forces
the email to be in a lowercase mode by applying a middleware. The `lowerCaseEmail` value is also accessible by service if you need to use this value in that layer of the application (check the section below to learn how to do it)

NOTE: Obviously, this is just an example to show the potentialities.

#### Define Custom Queries and Mutations

So far, we've learned that `CrudGenDependencyFactory` is able to generate highly configurable GraphQL operations.
But there are cases where you can't avoid writing your own resolver or services.

Although, is always suggested to check if there's the possibility to solve your problem by using one of the available decorators or
creating a custom one, in this section we will learn how to implement our own mutations and queries by using the `CrudGenDependencyFactory`.

As stated at the beginning of this documentation, the `CrudGenDependencyFactory` is a very flexible system, in fact you can literally replace
every dependency with your own implementation of the `Resolver`, `Service`, `Dataloader` and `Repository`.

It's also important to know that NestJS-yalc/Crud-Gen provides factory methods for every of the above elements, it means that you can
create your own class while still automatically generate the base to extend.

In the following example, we will create:

- `SkeletonUserService`: to define some extra business logic
- `SkeletonUserResolver`: to define the mutation that will use the extra business logic

Example:

```typescript
export interface SkeletonUserService extends GenericService<SkeletonUser> {
  resetPassword(guid: string): Promise<string>;
}

// We are using a factory function to be able to pass the connection name dynamically
export const skeletonUserServiceFactory = (
  dbConnection: string,
): ClassType<GenericService<SkeletonUser>> => {
  @Injectable()
  class SkeletonUserService
    extends GenericService<SkeletonUser>
    implements SkeletonUserService
  {
    constructor(
      @InjectRepository(SkeletonUser, dbConnection)
      protected repository: CrudGenRepository<SkeletonUser>,
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
        { password: () => newPass },
      );

      // send it back to the client
      return newPass;
    }
  }

  return SkeletonUserService;
};
```

and then the resolver:

```typescript
@Resolver(returnValue(SkeletonUserType))
export class SkeletonUserResolver extends resolverFactory({
  entityModel: SkeletonUser,
  dto: SkeletonUserType,
  input: {
    create: SkeletonUserCreateInput,
    update: SkeletonUserUpdateInput,
    conditions: SkeletonUserCondition,
  },
  prefix: 'SkeletonModule_',
  queries: {
    // SkeletonModule_getSkeletonUser
    getResource: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      idName: 'guid',
      queryParams: {
        // name: 'getSkeletonUser',
        description: 'Get a specific user',
      },
    },
    getResourceGrid: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      queryParams: {
        // name: 'getSkeletonUserGrid',
        description: 'Get a list of users',
      },
    },
  },
  mutations: {
    createResource: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      queryParams: {
        // name: 'createSkeletonUser',
        description: 'Create a new user',
      },
    },
    updateResource: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      queryParams: {
        // name: 'updateSkeletonUser',
        description: 'Update an existing user',
      },
    },
    deleteResource: {
      decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
      queryParams: {
        // name: 'deleteSkeletonUser',
        description: 'Delete an existing user',
      },
    },
  },
}) {
  constructor(
    protected service: SkeletonUserService,
    protected dataloader: GQLDataLoader,
    protected moduleRef: ModuleRef,
  ) {
    super(service, dataloader, moduleRef);
  }

  @UseGuards(RoleAuth([RoleEnum.PUBLIC]))
  @Mutation(returnValue(String), {
    description:
      'Reset user password with a random one and send the new value back.',
  })
  public async generateRandomPassword(
    @InputArgs({
      _name: 'ID',
    })
    ID: string,
  ): Promise<string> {
    return this.service.resetPassword(ID);
  }
}
```

lastly, we need to update the `CrudGenDependencyFactory` in this way to inject the newly created service and resolver:

```typescript
export const skeletonUserProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<SkeletonUser>({
    // The model used for TypeORM
    entityModel: SkeletonUser,
    resolver: {
      provider: SkeletonUserResolver,
    },

    service: {
      dbConnection: dbConnection,
      entityModel: SkeletonUser,
      provider: {
        provide: 'SkeletonUserGenericService',
        useClass: skeletonUserServiceFactory(dbConnection),
      },
    },
    dataloader: { databaseKey: 'guid' },
  });
```

As you've noticed, the `CrudGenDependencyFactory` is very extensible and allows you to fulfill any needs.
