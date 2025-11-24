import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AppBootstrap } from '../app-bootstrap.helper.js';
import { SYSTEM_LOGGER_SERVICE } from '../def.const.js';
import { UnwrapResultInterceptor } from '../unwrap-result.interceptor.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

jest.mock('class-validator', () => ({
  useContainer: jest.fn(),
}));

jest.mock('@fastify/cookie', () => jest.fn());

describe('AppBootstrap.applyBootstrapGlobals', () => {
  const logger = { log: jest.fn(), debug: jest.fn() };
  const customFilter = { handle: jest.fn() };
  const createDocumentMock = jest.fn().mockReturnValue({ doc: true });
  const setupSwaggerMock = jest.fn();
  const setTitleMock = jest.fn().mockReturnThis();
  const setDescriptionMock = jest.fn().mockReturnThis();
  const buildMock = jest.fn().mockReturnValue({ swagger: true });

  const fakeApp = {
    useGlobalPipes: jest.fn(),
    setGlobalPrefix: jest.fn(),
    register: jest.fn(),
    useGlobalInterceptors: jest.fn(),
    useGlobalFilters: jest.fn(),
    useLogger: jest.fn(),
    get: jest.fn().mockImplementation((token) =>
      token === SYSTEM_LOGGER_SERVICE ? logger : undefined,
    ),
    select: jest.fn().mockReturnValue({}),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(SwaggerModule, 'createDocument').mockImplementation((...args: any[]) =>
      createDocumentMock(...args),
    );
    jest.spyOn(SwaggerModule, 'setup').mockImplementation((...args: any[]) =>
      setupSwaggerMock(...args),
    );
    jest
      .spyOn(DocumentBuilder.prototype, 'setTitle')
      .mockImplementation(function (...args: any[]) {
        setTitleMock(...args);
        return this;
      });
    jest
      .spyOn(DocumentBuilder.prototype, 'setDescription')
      .mockImplementation(function (...args: any[]) {
        setDescriptionMock(...args);
        return this;
      });
    jest.spyOn(DocumentBuilder.prototype, 'build').mockImplementation((...args: any[]) =>
      buildMock(...args),
    );
  });

  it('should set up pipes, filters, interceptors and swagger', async () => {
    const bootstrap = new AppBootstrap(
      'app',
      class Dummy {},
      { skipMultiServerCheck: true } as any,
    );

    bootstrap['app'] = fakeApp as any;
    bootstrap['loggerService'] = logger as any;
    bootstrap.getConf = jest.fn().mockReturnValue({
      apiPrefix: 'api',
      host: 'localhost',
      port: 3000,
    }) as any;
    bootstrap.getModule = jest.fn().mockReturnValue({}) as any;

    await bootstrap.applyBootstrapGlobals({
      enableSwagger: true,
      apiPrefix: 'api',
      filters: [customFilter as any],
      validationPipeOptions: { transformOptions: { enableImplicitConversion: true } },
    });

    expect(fakeApp.useGlobalPipes).toHaveBeenCalled();
    expect(fakeApp.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(fakeApp.register).toHaveBeenCalled();
    expect(fakeApp.useGlobalInterceptors).toHaveBeenCalledWith(
      expect.any(UnwrapResultInterceptor),
    );
    expect(fakeApp.useGlobalFilters).toHaveBeenCalled();
    expect(createDocumentMock).toHaveBeenCalled();
    expect(setTitleMock).toHaveBeenCalled();
    expect(setDescriptionMock).toHaveBeenCalled();
    expect(setupSwaggerMock).toHaveBeenCalled();
  });
});
