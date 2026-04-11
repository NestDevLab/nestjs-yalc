import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
const { OmniKernelQueryService } = await import('../omnikernel.query.service.js');

const omniNamedBackendProvidersFactory = jest.fn(() => ({
  providers: ['named-backend'],
}));
const omniRecordBackendProvidersFactory = jest.fn(() => ({
  providers: ['record-backend'],
}));
const omniRelationBackendProvidersFactory = jest.fn(() => ({
  providers: ['relation-backend'],
}));
const omniCollectionBackendProvidersFactory = jest.fn(() => ({
  providers: ['collection-backend'],
}));
const omniDocumentBackendProvidersFactory = jest.fn(() => ({
  providers: ['document-backend'],
}));
const omniExternalRefBackendProvidersFactory = jest.fn(() => ({
  providers: ['external-ref-backend'],
}));

jest.unstable_mockModule('../omni-named.backend.js', () => ({
  omniNamedBackendProvidersFactory,
}));
jest.unstable_mockModule('../omni-record.backend.js', () => ({
  omniRecordBackendProvidersFactory,
}));
jest.unstable_mockModule('../omni-relation.backend.js', () => ({
  omniRelationBackendProvidersFactory,
}));
jest.unstable_mockModule('../omni-collection.backend.js', () => ({
  omniCollectionBackendProvidersFactory,
}));
jest.unstable_mockModule('../omni-document.backend.js', () => ({
  omniDocumentBackendProvidersFactory,
}));
jest.unstable_mockModule('../omni-external-ref.backend.js', () => ({
  omniExternalRefBackendProvidersFactory,
}));

const { OmniKernelModule } = await import('../omnikernel.module.js');

describe('OmniKernelModule', () => {
  it('registers only backend substrate providers', () => {
    const module = OmniKernelModule.register('test');

    expect(module).toBeDefined();
    expect(omniNamedBackendProvidersFactory).toHaveBeenCalledWith('test');
    expect(module.providers).toEqual(
      expect.arrayContaining([
        'named-backend',
        'record-backend',
        'relation-backend',
        'collection-backend',
        'document-backend',
        'external-ref-backend',
        expect.objectContaining({ provide: OmniKernelQueryService }),
      ]),
    );
    expect(module.controllers).toBeUndefined();
  });
});
