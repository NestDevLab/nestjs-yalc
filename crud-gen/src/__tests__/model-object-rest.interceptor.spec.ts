import { describe, expect, it } from '@jest/globals';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ModelField, ModelObject } from '../object.decorator.js';
import { modelFieldMapperInterceptor } from '../model-object/model-object-rest.interceptor.js';

@ModelObject()
class RequestModel {
  @ModelField({ dst: 'field' })
  source!: string;
}

class ResponseModel {
  static field = '';
  field = '';
}

const buildHttpContext = (body: any) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  }) as unknown as ExecutionContext;

describe('modelFieldMapperInterceptor', () => {
  it('should map request body and response using model metadata', async () => {
    (RequestModel as any).source = 'from-request';
    const Interceptor = modelFieldMapperInterceptor(RequestModel, ResponseModel);
    const interceptor = new Interceptor();
    const context = buildHttpContext({});
    const next: CallHandler = {
      handle: () => of(RequestModel as any),
    };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBeInstanceOf(Object);
  });
});
