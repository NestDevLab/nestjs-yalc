import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  AppConfigService,
  createAppConfigProvider,
  getAppConfigToken,
  getAppEventToken,
  getAppLoggerToken,
} from '../app-config.service.js';

describe('AppConfigService', () => {
  it('should expose config values', () => {
    const config = { appName: 'demo' };
    const configService = {
      get: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService;

    const service = new AppConfigService(configService, 'demoAlias');

    expect(service.values).toBe(config);
    expect(service.get()).toBe(config);
    expect(configService.get).toHaveBeenCalledWith('demoAlias');
  });

  it('should throw when config is missing', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new AppConfigService(configService, 'missing')).toThrow(
      "AppConfigService: No config found for app alias 'missing'",
    );
  });
});

describe('AppConfigService tokens', () => {
  it('should generate token names', () => {
    expect(getAppConfigToken('alias')).toBe('aliasConfig');
    expect(getAppEventToken('alias')).toBe('aliasEvent');
    expect(getAppLoggerToken('alias')).toBe('aliasLogger');
  });

  it('should build a provider that resolves AppConfigService', () => {
    const provider = createAppConfigProvider('alias');
    const config = { foo: 'bar' };
    const configService = { get: jest.fn().mockReturnValue(config) };

    const instance = (provider as any).useFactory(
      configService as ConfigService,
    ) as AppConfigService;

    expect(provider.inject).toEqual([ConfigService]);
    expect(instance.values).toBe(config);
  });
});
