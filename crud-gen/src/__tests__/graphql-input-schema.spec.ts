import { expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  Args,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import {
  crudGenParamsFactory,
  crudGenParamsNoPaginationFactory,
} from '../crud-gen.args.js';
import { ModelField } from '../object.decorator.js';
import { FilterScalar } from '../filter.scalar.js';
import {
  filterExpressionInputFactory,
  sortModelFactory,
} from '../api-graphql/crud-gen.input.js';

class InputContractEntity {
  @ModelField({ gqlType: () => String })
  name!: string;
  undecorated!: string;
}
const EntityArgs = crudGenParamsFactory(undefined, InputContractEntity);
const EntityNoPageArgs = crudGenParamsNoPaginationFactory(
  undefined,
  InputContractEntity,
);
const LegacyArgs = crudGenParamsFactory();
const LegacyNoPageArgs = crudGenParamsNoPaginationFactory();

@Resolver()
class InputContractResolver {
  @Query(() => Boolean)
  entity(@Args() _args: InstanceType<typeof EntityArgs>) {
    return true;
  }
  @Query(() => Boolean)
  entityNoPage(@Args() _args: InstanceType<typeof EntityNoPageArgs>) {
    return true;
  }
  @Query(() => Boolean)
  legacy(@Args() _args: InstanceType<typeof LegacyArgs>) {
    return true;
  }
  @Query(() => Boolean)
  legacyNoPage(@Args() _args: InstanceType<typeof LegacyNoPageArgs>) {
    return true;
  }
}
// Runtime decorator metadata needs the actual generated classes, rather than erased aliases.
for (const [method, type] of [
  ['entity', EntityArgs],
  ['entityNoPage', EntityNoPageArgs],
  ['legacy', LegacyArgs],
  ['legacyNoPage', LegacyNoPageArgs],
] as const) {
  Reflect.defineMetadata(
    'design:paramtypes',
    [type],
    InputContractResolver.prototype,
    method,
  );
}

it('builds enum-backed entity inputs and retains model-less scalar/string inputs', async () => {
  const module = await Test.createTestingModule({
    imports: [GraphQLSchemaBuilderModule],
  }).compile();
  try {
    const schema = await module
      .get(GraphQLSchemaFactory)
      .create([InputContractResolver], [FilterScalar]);
    const sdl = printSchema(schema);
    expect(sdl).toContain('enum InputContractEntityFieldEnum {\n  name\n}');
    expect(sdl).not.toContain('undecorated');
    expect(sdl).toContain('colId: InputContractEntityFieldEnum!');
    expect(sdl.match(/field: InputContractEntityFieldEnum!/g)).toHaveLength(4);
    expect(sdl).toContain('input SortModel {\n  colId: String!');
    for (const query of ['entity', 'entityNoPage']) {
      const args = schema.getQueryType()!.getFields()[query].args;
      expect(String(args.find((arg) => arg.name === 'sorting')!.type)).toBe(
        '[InputContractEntitySortModel!]',
      );
      expect(String(args.find((arg) => arg.name === 'filters')!.type)).toBe(
        'InputContractEntityFilterExpressionInput',
      );
    }
    for (const query of ['legacy', 'legacyNoPage']) {
      const args = schema.getQueryType()!.getFields()[query].args;
      expect(String(args.find((arg) => arg.name === 'sorting')!.type)).toBe(
        '[SortModel!]',
      );
      expect(String(args.find((arg) => arg.name === 'filters')!.type)).toBe(
        'FilterInput',
      );
    }
    expect(sortModelFactory(InputContractEntity)).toBe(
      sortModelFactory(InputContractEntity),
    );
    expect(filterExpressionInputFactory(InputContractEntity)).toBe(
      filterExpressionInputFactory(InputContractEntity),
    );
  } finally {
    await module.close();
  }
});
