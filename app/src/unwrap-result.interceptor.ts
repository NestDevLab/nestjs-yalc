import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ResultAsync } from 'neverthrow';
import { map, Observable } from 'rxjs';

@Injectable()
export class UnwrapResultInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        if (
          result instanceof ResultAsync ||
          (typeof result === 'object' &&
            typeof result.isOk === 'function' &&
            typeof result.isErr === 'function')
        ) {
          if (result.isOk()) {
            return result.value;
          } else {
            throw result.error;
          }
        }
        return result;
      }),
    );
  }
}
