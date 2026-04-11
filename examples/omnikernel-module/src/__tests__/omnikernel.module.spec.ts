import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
const { OmniKernelQueryService } = await import('../omnikernel.query.service.js');

const omniNamedBackendProvidersFactory = jest.fn(() => ({
  providers: ['named-backend'],
}));
const omniNamedGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['named-graphql'],
}));
const omniRecordBackendProvidersFactory = jest.fn(() => ({
  providers: ['record-backend'],
}));
const omniRecordGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['record-graphql'],
}));
const omniRelationBackendProvidersFactory = jest.fn(() => ({
  providers: ['relation-backend'],
}));
const omniRelationGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['relation-graphql'],
}));
const omniCollectionBackendProvidersFactory = jest.fn(() => ({
  providers: ['collection-backend'],
}));
const omniCollectionGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['collection-graphql'],
}));
const omniDocumentBackendProvidersFactory = jest.fn(() => ({
  providers: ['document-backend'],
}));
const omniDocumentGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['document-graphql'],
}));
const omniExternalRefBackendProvidersFactory = jest.fn(() => ({
  providers: ['external-ref-backend'],
}));
const omniExternalRefGraphqlProvidersFactory = jest.fn(() => ({
  providers: ['external-ref-graphql'],
}));

jest.unstable_mockModule('../omni-named.resolver.js', () => ({
  omniNamedBackendProvidersFactory,
  omniNamedGraphqlProvidersFactory,
}));
jest.unstable_mockModule('../omni-record.resolver.js', () => ({
  omniRecordBackendProvidersFactory,
  omniRecordGraphqlProvidersFactory,
}));
jest.unstable_mockModule('../omni-relation.resolver.js', () => ({
  omniRelationBackendProvidersFactory,
  omniRelationGraphqlProvidersFactory,
}));
jest.unstable_mockModule('../omni-collection.resolver.js', () => ({
  omniCollectionBackendProvidersFactory,
  omniCollectionGraphqlProvidersFactory,
}));
jest.unstable_mockModule('../omni-document.resolver.js', () => ({
  omniDocumentBackendProvidersFactory,
  omniDocumentGraphqlProvidersFactory,
}));
jest.unstable_mockModule('../omni-external-ref.resolver.js', () => ({
  omniExternalRefBackendProvidersFactory,
  omniExternalRefGraphqlProvidersFactory,
}));

const { OmniKernelModule } = await import('../omnikernel.module.js');

describe('OmniKernelModule', () => {
  it('registers backend and GraphQL providers by default', () => {
    const module = OmniKernelModule.register('test');

    expect(module).toBeDefined();
    expect(omniNamedBackendProvidersFactory).toHaveBeenCalledWith('test');
    expect(omniNamedGraphqlProvidersFactory).toHaveBeenCalledWith({
      providers: ['named-backend'],
    });
    expect(module.providers).toEqual(
      expect.arrayContaining([
        'named-backend',
        'record-backend',
        'relation-backend',
        'collection-backend',
        'document-backend',
        'external-ref-backend',
        'named-graphql',
        'record-graphql',
        'relation-graphql',
        'collection-graphql',
        'document-graphql',
        'external-ref-graphql',
        expect.objectContaining({ provide: OmniKernelQueryService }),
      ]),
    );
  });

  it('can register the reusable substrate without GraphQL providers', () => {
    const module = OmniKernelModule.register('test', { graphql: false });

    expect(module.providers).toEqual(
      expect.arrayContaining([
        'named-backend',
        'record-backend',
        'relation-backend',
        'collection-backend',
        'document-backend',
        'external-ref-backend',
      ]),
    );
    expect(module.providers).not.toEqual(
      expect.arrayContaining(['named-graphql']),
    );
  });
});
