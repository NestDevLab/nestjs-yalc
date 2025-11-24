import { describe, expect, it, jest } from '@jest/globals';
import { BaseAppBootstrap } from '../app-bootstrap-base.helper.js';

class DummyModule {}

class TestBootstrap extends BaseAppBootstrap<any> {
  constructor() {
    super('test-app', DummyModule as any, {
      globalsOptions: { skipMultiServerCheck: true },
    });
  }
}

describe('BaseAppBootstrap', () => {
  it('should monkey patch app init/close and update flags', async () => {
    const bootstrap = new TestBootstrap();

    const closeFn = jest.fn().mockResolvedValue(undefined);
    const initFn = jest.fn().mockResolvedValue(undefined);

    const fakeApp: any = {
      close: closeFn,
      init: initFn,
      get: jest.fn(),
      useLogger: jest.fn(),
    };

    bootstrap.setApp(fakeApp);

    expect(bootstrap.isAppClosed()).toBe(false);
    await fakeApp.init();
    expect(bootstrap.isAppClosed()).toBe(false);

    await bootstrap.closeApp();
    expect(closeFn).toHaveBeenCalled();
    expect(bootstrap.isAppClosed()).toBe(true);
  });
});
