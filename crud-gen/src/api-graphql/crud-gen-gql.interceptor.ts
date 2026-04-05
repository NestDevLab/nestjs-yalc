import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { IFieldMapper } from '@nestjs-yalc/interfaces/maps.interface.js';
import { GqlExecutionContext } from '@nestjs/graphql';

export function crudGenGqlInterceptorWorker<T>(
  startRow: number,
  endRow: number,
) {
  return (value: [T, number] | T) => {
    if (!Array.isArray(value) || value.length !== 2 || typeof value[1] !== 'number') {
      return value;
    }

    const [page, count] = value;
    return {
      nodes: page,
      pageData: { count, startRow: startRow ?? 0, endRow: endRow ?? count },
    };
  };
}
@Injectable()
export class CrudGenGqlInterceptor<T = IFieldMapper>
  implements NestInterceptor<T>
{
  intercept(context: ExecutionContext, next: CallHandler) {
    const gqlCtx = GqlExecutionContext.create(context);
    const { startRow, endRow } = (gqlCtx?.getArgs?.() as any) ?? {};
    return next
      .handle()
      .pipe(map(crudGenGqlInterceptorWorker(startRow, endRow)));
  }
}
