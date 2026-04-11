import { describe, expect, it } from '@jest/globals';

const { OmniCollectionKind } = await import('../omni-collection-kind.enum.js');
const { OmniDocumentKind } = await import('../omni-document-kind.enum.js');
const { OmniRelationKind } = await import('../omni-relation-kind.enum.js');
const {
  OMNI_COLLECTION_MEMBERSHIP_RELATION_KIND,
  isAllowedOmniRelation,
  isCanonicalCollectionMembershipRelation,
  isOmniCollectionRecordKind,
  isOmniDocumentRecordKind,
} = await import('../omni-relation-semantics.js');

describe('Omni relation semantics', () => {
  it('treats collection contains as the canonical collection membership edge', () => {
    expect(OMNI_COLLECTION_MEMBERSHIP_RELATION_KIND).toBe(
      OmniRelationKind.Contains,
    );
    expect(
      isCanonicalCollectionMembershipRelation({
        sourceKind: OmniCollectionKind.Collection,
        relationKind: OmniRelationKind.Contains,
      }),
    ).toBe(true);
    expect(
      isCanonicalCollectionMembershipRelation({
        sourceKind: OmniDocumentKind.Document,
        relationKind: OmniRelationKind.Contains,
      }),
    ).toBe(false);
  });

  it('recognizes the current concrete record families', () => {
    expect(isOmniCollectionRecordKind(OmniCollectionKind.Collection)).toBe(
      true,
    );
    expect(isOmniCollectionRecordKind(OmniDocumentKind.Document)).toBe(false);
    expect(isOmniDocumentRecordKind(OmniDocumentKind.Document)).toBe(true);
    expect(isOmniDocumentRecordKind(OmniCollectionKind.Collection)).toBe(false);
  });

  it('allows collection-to-document contains links and rejects the reversed organization edge', () => {
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniCollectionKind.Collection,
        targetKind: OmniDocumentKind.Document,
        relationKind: OmniRelationKind.Contains,
      }),
    ).toBe(true);
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniDocumentKind.Document,
        targetKind: OmniCollectionKind.Collection,
        relationKind: OmniRelationKind.Contains,
      }),
    ).toBe(false);
  });

  it('limits derived_from to document lineage', () => {
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniDocumentKind.Document,
        targetKind: OmniDocumentKind.Document,
        relationKind: OmniRelationKind.DerivedFrom,
      }),
    ).toBe(true);
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniCollectionKind.Collection,
        targetKind: OmniDocumentKind.Document,
        relationKind: OmniRelationKind.DerivedFrom,
      }),
    ).toBe(false);
  });

  it('keeps references and related_to flexible for cross-record graph links', () => {
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniDocumentKind.Document,
        targetKind: OmniCollectionKind.Collection,
        relationKind: OmniRelationKind.References,
      }),
    ).toBe(true);
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniCollectionKind.Collection,
        targetKind: OmniDocumentKind.Document,
        relationKind: OmniRelationKind.RelatedTo,
      }),
    ).toBe(true);
  });

  it('returns false for unexpected relation values at runtime', () => {
    expect(
      isAllowedOmniRelation({
        sourceKind: OmniCollectionKind.Collection,
        targetKind: OmniDocumentKind.Document,
        relationKind: 'unexpected' as OmniRelationKind,
      }),
    ).toBe(false);
  });
});
