import { createParamDecorator, ExecutionContext, Type } from '@nestjs/common';
import { GqlExecutionContext, ReturnTypeFuncValue } from '@nestjs/graphql';
import {
  IFieldMapper,
  FieldMapperProperty,
} from '@nestjs-yalc/interfaces/maps.interface.js';
import {
  columnConversion,
  formatRawSelectionWithoutAlias,
  objectToFieldMapper,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { GraphQLResolveInfo } from 'graphql';
import { removeSymbolicSelection } from '../typeorm/crud-gen-args.helpers.js';
import { IModelFieldAndFilterMapper } from '../object.decorator.js';
import { IKeyMeta } from './crud-gen-gql.type.js';

export interface IGqlAgSingleParams {
  id: Type<any>;
}

export const GqlModelFieldsMapper = (
  data: IFieldMapper | ReturnTypeFuncValue | ClassType,
  info: GraphQLResolveInfo,
): { keys: string[]; keysMeta: { [key: string]: IKeyMeta } } => {
  const fieldMapper = objectToFieldMapper(data);

  /**
   * Selections
   */
  let keys: Array<string> = [];

  /**
   * Custom or Derived keys
   */
  const keysMeta: { [key: string]: IKeyMeta } = {};

  const processSubItems = (
    mapper: IModelFieldAndFilterMapper,
    item: any,
    prefix = '',
    path = '',
  ) => {
    if (path && !path.endsWith('.')) path += '.';

    /**
     * Do not process fields that are not actual fields (pageData etc)
     * @todo improve this logic by using metadata on these properties instead of the hardcoded name
     */
    if (item.name.value === 'pageData' && item.selectionSet) return;

    if (item.selectionSet) {
      const relationField = mapper.field[item.name.value] as
        | (FieldMapperProperty & {
            relation?: { sourceKey?: { dst: string; alias: string } };
          })
        | undefined;
      const sourceKey = relationField?.relation?.sourceKey;

      if (sourceKey) {
        const normalizedPath = path ? path : '';
        const relationKey = `${normalizedPath}${sourceKey.dst}`;

        if (!normalizedPath) {
          if (!keys.includes(relationKey)) {
            keys.push(relationKey);
          }
        } else if (!keys.includes(relationKey) && !keysMeta[relationKey]) {
          keysMeta[relationKey] = {
            fieldMapper: relationField,
            isNested: true,
            rawSelect: formatRawSelectionWithoutAlias(
              sourceKey.dst,
              normalizedPath.endsWith('.')
                ? normalizedPath.slice(0, -1)
                : normalizedPath,
            ),
          };
        }
      }

      item.selectionSet.selections.forEach((subItem: any) => {
        /**
         * if it's a nested item, then recurse
         */
        if (subItem.selectionSet) {
          const extraInfo = mapper.extraInfo?.[subItem.name.value];
          if (extraInfo) {
            const nestedMapper = objectToFieldMapper(extraInfo);

            if (item.name.value === 'nodes') {
              processSubItems(nestedMapper, subItem, prefix, path);
              return;
            }

            const _path = path + subItem.name.value;
            processSubItems(nestedMapper, subItem, subItem.name.value, _path);

            // add required fields that have not been selected by the client
            Object.keys(nestedMapper.field).forEach((k: string) => {
              const v: FieldMapperProperty = nestedMapper.field[k];
              const key = _path + '.' + v.dst;
              if (v.isRequired && !keysMeta[key]) {
                keysMeta[key] = {
                  fieldMapper: v,
                  isNested: true,
                  rawSelect: formatRawSelectionWithoutAlias(
                    v.dst,
                    subItem.name.value,
                  ),
                };
              }
            });
          }

          return;
        }

        if (item.name.value === 'nodes') {
          processSubItems(mapper, subItem, prefix, path);
          return;
        }

        // We have to set a prefix when the parent is a nested item different by "nodes"
        const _prefix = item.name.value;

        // const _path =
        //   item.name.value !== 'nodes' ? path + item.name.value + '.' : path;

        const dst = columnConversion(
          subItem.name.value,
          mapper.field,
        ).toString();

        const _path = !path ? path + item.name.value + '.' : path;

        const key = _path + dst;

        keysMeta[key] = {
          fieldMapper: mapper.field[subItem.name.value],
          isNested: true,
          rawSelect: formatRawSelectionWithoutAlias(dst, _prefix),
        };

        return;
      });
      return;
    }

    const dst = columnConversion(item.name.value, mapper.field).toString();
    const key = path + dst;
    const isNested = !!path;

    /**
     * If the field is derived we want to add it to the selection
     */

    if (isNested || mapper.field[item.name.value]?.mode === 'derived') {
      keysMeta[key] = {
        fieldMapper: mapper.field[item.name.value],
        isNested,
        rawSelect: formatRawSelectionWithoutAlias(dst, prefix),
      };

      return;
    }

    keys.push(key);
  };

  /**
   * START Process first level fields
   */

  /**
   * Process selected fields
   */
  info.fieldNodes?.[0].selectionSet?.selections.forEach((item: any) =>
    processSubItems(fieldMapper, item),
  );

  /**
   * Process required fields
   */
  // add required fields that have not been selected by the client
  Object.keys(fieldMapper.field).forEach((k: string) => {
    const v: FieldMapperProperty = fieldMapper.field[k];
    if (v.isRequired) {
      if (v.mode === 'derived') {
        if (keysMeta[v.dst]) return;

        keysMeta[v.dst] = {
          fieldMapper: v,
          isNested: false,
          rawSelect: formatRawSelectionWithoutAlias(v.dst, ''),
        };
        return;
      }

      keys.indexOf(v.dst) < 0 && keys.push(v.dst);
    }
  });

  /**
   * Remove symbolic fields that can't be used for the database
   */
  keys = removeSymbolicSelection(keys, fieldMapper.field, '');

  return { keys, keysMeta };
};

export const GqlInfoGenerator = (
  data: IFieldMapper | ReturnTypeFuncValue | ClassType = {},
  ctx: ExecutionContext,
): string[] => {
  const gqlCtx = GqlExecutionContext.create(ctx);
  const info = gqlCtx.getInfo();
  return GqlModelFieldsMapper(data, info).keys;
};

export const GqlFieldsMap = createParamDecorator(GqlInfoGenerator);
