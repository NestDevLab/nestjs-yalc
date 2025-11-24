import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryFailedError } from 'typeorm';
import {
  validateSupportedError,
  GenericService,
  GenericServiceFactory,
} from '../typeorm/generic.service.js';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('validateSupportedError', () => {
  it('should wrap QueryFailedError and rethrow others', () => {
    const handler = validateSupportedError(Error);
    expect(() => handler(new QueryFailedError('q', [], new Error('boom')))).toThrow(
      Error,
    );
    expect(() => handler(new Error('generic'))).toThrow('generic');
  });
});

describe('GenericService', () => {
  const repositoryRead: any = { target: class Read {}, find: jest.fn() };
  const repositoryWrite: any = { target: class Write {}, find: jest.fn() };

  it('should set and retrieve repositories', () => {
    const service = new GenericService(repositoryRead, repositoryWrite);
    expect(service.getRepository()).toBe(repositoryRead);
    expect(service.getRepositoryWrite()).toBe(repositoryWrite);

    const newRepo: any = { target: class New {}, find: jest.fn() };
    service['setRepository'](newRepo);
    expect(service.getRepository()).toBe(newRepo);
    expect(service.getRepositoryWrite()).toBe(newRepo);
  });

  it('GenericServiceFactory should create provider with custom class', () => {
    class CustomService extends GenericService<any> {}
    const provider = GenericServiceFactory(class Entity {}, 'default', CustomService);
    const instance = (provider as any).useFactory(repositoryRead, repositoryWrite);

    expect((provider as any).provide).toBe(CustomService);
    expect(instance).toBeInstanceOf(CustomService);
  });
});
