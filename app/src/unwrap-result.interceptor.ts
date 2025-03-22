import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class UnwrapResultInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        if (result && result.isErr && result.isOk) {
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
