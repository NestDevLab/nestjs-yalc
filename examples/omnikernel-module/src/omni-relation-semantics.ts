import { OmniCollectionKind } from './omni-collection-kind.enum';
import { OmniDocumentKind } from './omni-document-kind.enum';
import { OmniRelationKind } from './omni-relation-kind.enum';

export interface OmniRelationSemanticsInput {
  sourceKind: string;
  targetKind: string;
  relationKind: OmniRelationKind;
}

export const OMNI_COLLECTION_MEMBERSHIP_RELATION_KIND =
  OmniRelationKind.Contains;

const hasKind = (kind: string): boolean => kind.trim().length > 0;

export const isOmniCollectionRecordKind = (kind: string): boolean =>
  kind === OmniCollectionKind.Collection;

export const isOmniDocumentRecordKind = (kind: string): boolean =>
  kind === OmniDocumentKind.Document;

export const isCanonicalCollectionMembershipRelation = ({
  sourceKind,
  relationKind,
}: Pick<OmniRelationSemanticsInput, 'sourceKind' | 'relationKind'>): boolean =>
  relationKind === OMNI_COLLECTION_MEMBERSHIP_RELATION_KIND &&
  isOmniCollectionRecordKind(sourceKind);

export const isAllowedOmniRelation = ({
  sourceKind,
  targetKind,
  relationKind,
}: OmniRelationSemanticsInput): boolean => {
  if (!hasKind(sourceKind) || !hasKind(targetKind)) {
    return false;
  }

  switch (relationKind) {
    case OmniRelationKind.Contains:
      return isOmniCollectionRecordKind(sourceKind);
    case OmniRelationKind.DerivedFrom:
      return (
        isOmniDocumentRecordKind(sourceKind) &&
        isOmniDocumentRecordKind(targetKind)
      );
    case OmniRelationKind.References:
    case OmniRelationKind.RelatedTo:
      return true;
  }

  return false;
};
