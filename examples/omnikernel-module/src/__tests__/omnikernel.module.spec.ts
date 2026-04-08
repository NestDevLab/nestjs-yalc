import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';

const omniNamedProvidersFactory = jest.fn(() => ({ providers: ['named'] }));
const omniRecordProvidersFactory = jest.fn(() => ({ providers: ['record'] }));
const omniRelationProvidersFactory = jest.fn(() => ({
  providers: ['relation'],
}));
const omniDocumentProvidersFactory = jest.fn(() => ({
  providers: ['document'],
}));
const omniExternalRefProvidersFactory = jest.fn(() => ({
  providers: ['external-ref'],
}));

jest.unstable_mockModule('../omni-named.resolver.js', () => ({
  omniNamedProvidersFactory,
}));
jest.unstable_mockModule('../omni-record.resolver.js', () => ({
  omniRecordProvidersFactory,
}));
jest.unstable_mockModule('../omni-relation.resolver.js', () => ({
  omniRelationProvidersFactory,
}));
jest.unstable_mockModule('../omni-document.resolver.js', () => ({
  omniDocumentProvidersFactory,
}));
jest.unstable_mockModule('../omni-external-ref.resolver.js', () => ({
  omniExternalRefProvidersFactory,
}));

const { OmniKernelModule } = await import('../omnikernel.module.js');

describe('OmniKernelModule', () => {
  it('registers the module and invokes all provider factories', () => {
    const module = OmniKernelModule.register('test');

    expect(module).toBeDefined();
    expect(omniNamedProvidersFactory).toHaveBeenCalledWith('test');
    expect(omniRecordProvidersFactory).toHaveBeenCalledWith('test');
    expect(omniRelationProvidersFactory).toHaveBeenCalledWith('test');
    expect(omniDocumentProvidersFactory).toHaveBeenCalledWith('test');
    expect(omniExternalRefProvidersFactory).toHaveBeenCalledWith('test');
    expect(module.providers).toEqual(
      expect.arrayContaining([
        'named',
        'record',
        'relation',
        'document',
        'external-ref',
      ]),
    );
  });
});
