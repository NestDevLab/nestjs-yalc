import {
  sortModelFactory,
  filterExpressionInputFactory,
  SortModel,
} from '../../api-graphql/crud-gen.input.js';
import {
  crudGenParamsFactory,
  crudGenParamsNoPaginationFactory,
} from '../../crud-gen.args.js';
import {
  FilterType,
  GeneralFilters,
  SortDirection,
} from '../../crud-gen.enum.js';

class User {
  id!: string;
  name!: string;
}

const Sort = sortModelFactory(User);
const sort = new Sort();
sort.colId = 'name';
// @ts-expect-error Unknown entity keys must not disappear through an any-typed cache.
sort.colId = 'unknown';

const Filter = filterExpressionInputFactory(User);
const filter = new Filter();
filter.childExpressions = [
  {
    expressions: [
      {
        text: {
          field: 'name',
          filterType: FilterType.TEXT,
          type: GeneralFilters.EQUALS,
        },
      },
    ],
  },
];
filter.childExpressions = [
  {
    expressions: [
      {
        text: {
          // @ts-expect-error Recursive filter fields retain the entity-key constraint.
          field: 'unknown',
          filterType: FilterType.TEXT,
          type: GeneralFilters.EQUALS,
        },
      },
    ],
  },
];

for (const Factory of [
  crudGenParamsFactory,
  crudGenParamsNoPaginationFactory,
]) {
  const Params = Factory(undefined, User);
  const params = new Params();
  params.sorting = [{ colId: 'id', sort: SortDirection.ASC }];
  // @ts-expect-error Entity-aware args preserve the sort factory's field constraint.
  params.sorting = [{ colId: 'unknown', sort: SortDirection.ASC }];
  params.filters = {
    childExpressions: [
      {
        expressions: [
          {
            set: {
              // @ts-expect-error Entity-aware args preserve nested filter field constraints.
              field: 'unknown',
              values: [],
              filterType: FilterType.SET,
            },
          },
        ],
      },
    ],
  };
  const LegacyParams = Factory();
  new LegacyParams().sorting = [{ colId: 'applicationDefinedField' }];
}
new SortModel().colId = 'applicationDefinedField';
