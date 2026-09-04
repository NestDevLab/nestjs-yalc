# Development Quality Policy

All changes to `nestjs-yalc` must be delivered through a focused pull request to the protected `dev` branch. This policy applies equally to human and AI-managed development.

## Required evidence

Every pull request must provide:

1. A single, explicit intent and a description of affected contracts.
2. Focused tests for the changed behavior, including realistic failure paths.
3. A successful full `npm run ci:checks` run on the exact reviewed head.
4. An independent approving review made after the latest push.
5. Resolution of all blocking findings and review conversations.
6. Documentation, migration, and rollout notes when the behavior or operational contract changes.

## Review standard

The reviewer must inspect the code and relevant surrounding contracts. The review must consider:

- functional correctness and edge cases;
- error, retry, concurrency, and partial-failure behavior;
- public API and backward compatibility;
- security, privacy, and data-integrity risks;
- whether tests can fail for the defect they claim to cover;
- documentation accuracy;
- migration, deployment, and rollback impact.

Approval is invalidated by a later push. The updated head must be reviewed again. Self-review, checklist-only review, and review of a stale commit do not satisfy this policy.

## Enforcement

The repository is Git-tracked and AI-managed through Syncwheel. GitHub branch protection on `dev` requires the repository CI checks, one approving review, approval after the latest push, and resolved conversations. Administrators are subject to the same branch rules.

Repository policy and branch protection are complementary: the automated gates establish the minimum evidence, while the independent reviewer remains responsible for the quality of the technical assessment.
