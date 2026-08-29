import { OmniRelationKind } from './omni-relation-kind.enum.js';

export const omniRelationKindPattern = /^[a-z][a-z0-9_]{0,63}$/;

export const canonicalOmniRelationKinds = Object.freeze([
  OmniRelationKind.Contains,
  OmniRelationKind.References,
  OmniRelationKind.RelatedTo,
  OmniRelationKind.DerivedFrom,
] as const);

export interface OmniRelationKindContract {
  readonly kinds: ReadonlySet<string>;
  assert(kind: unknown): asserts kind is string;
  has(kind: string): boolean;
}

/**
 * Canonical kinds are stable exports. Applications may register additional
 * syntactically portable kinds at module composition time without changing
 * OmniKernel or turning arbitrary strings into valid graph semantics.
 */
export function createOmniRelationKindContract(
  additionalKinds: readonly string[] = [],
): OmniRelationKindContract {
  const kinds = new Set<string>(canonicalOmniRelationKinds);
  for (const kind of additionalKinds) {
    if (typeof kind !== 'string' || !omniRelationKindPattern.test(kind)) {
      throw new TypeError(
        'Omni relation kinds must use lowercase letters, digits, and underscores.',
      );
    }
    kinds.add(kind);
  }

  return Object.freeze({
    kinds,
    assert(kind: unknown): asserts kind is string {
      if (typeof kind !== 'string' || !kinds.has(kind)) {
        throw new TypeError(
          'Omni relation kind is not registered for this module.',
        );
      }
    },
    has(kind: string): boolean {
      return kinds.has(kind);
    },
  });
}
