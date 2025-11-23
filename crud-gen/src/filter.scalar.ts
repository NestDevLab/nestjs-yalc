import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import {
  isCombinedFilterModel,
  isFilterModel,
  isMulticolumnJoinOptions,
} from './crud-gen-type-checker.utils.js';
import { CustomWhereKeys } from './crud-gen.enum.js';
import { CrudGenBadFilterTypeError } from './crud-gen.error.js';
import {
  FilterInput,
  IFilterInputOld,
  IMultiColumnJoinOptions,
} from './api-graphql/crud-gen-gql.interface.js';

@Scalar('FilterInput')
export class FilterScalar implements CustomScalar<string, FilterInput> {
  description = 'CrudGen Filter scalar type';

  resultMemoize = new Map();
  resultMemoizeInverse = new WeakMap();

  parseValue(value: string | unknown): FilterInput {
    // value from the client
    const cached = this.resultMemoize.get(value);
    if (cached) return cached;

    const parsedValue = JSON.parse(typeof value === 'string' ? value : '{}');

    const normalizeInput = (
      input: IFilterInputOld | IMultiColumnJoinOptions,
    ): FilterInput => {
      const _normalizedInput: FilterInput = {
        expressions: [],
      };

      Object.keys(input).forEach((key) => {
        const field = input[key];
        if (
          key === CustomWhereKeys.MULTICOLUMNJOINOPTIONS &&
          isMulticolumnJoinOptions(field)
        ) {
          _normalizedInput.childExpressions = [
            {
              ...normalizeInput(field),
              operator: field.multiColumnJoinOperator,
            },
          ];
          return;
        }

        if (
          _normalizedInput.expressions &&
          (isFilterModel(field) || isCombinedFilterModel(field))
        ) {
          _normalizedInput.expressions.push({
            [field.filterType]: {
              ...field,
              field: key,
              filterType: field.filterType,
            },
          });
        }
      });

      return _normalizedInput;
    };

    const filter = normalizeInput(parsedValue);

    this.resultMemoize.set(value, filter);
    this.resultMemoizeInverse.set(filter, value);

    return filter;
  }

  serialize(value: FilterInput | string | unknown): string {
    if (typeof value === 'string') return value;

    if (typeof value !== 'object' || value === null) {
      return String(value ?? '');
    }

    const memoized = this.resultMemoizeInverse.get(value);
    if (typeof memoized === 'string') {
      return memoized;
    }

    throw new CrudGenBadFilterTypeError();
  }

  parseLiteral(ast: ValueNode): FilterInput {
    if (ast.kind === Kind.STRING) {
      return this.parseValue(ast.value);
    }
    throw new CrudGenBadFilterTypeError();
  }
}
