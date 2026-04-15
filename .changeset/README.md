# Changesets

This repository uses Changesets to prepare version bumps and changelog entries.

Add a changeset when a PR changes public package behavior:

```bash
npm run changeset
```

The repository uses independent package versioning. A `patch`, `minor`, or
`major` changeset bumps only the selected package and any dependent packages
that need their internal dependency ranges updated.

Select the workspace package or packages that changed. Do not select
`@nestjs-yalc/framework`: it is the generated aggregate package, and
it is published from the repository root.

After changes land on `dev`, `.github/workflows/changesets.yml` creates or
updates the `chore(release): version packages` PR. Merging that PR applies the
version and changelog updates. Publication is handled separately by the npm
publish workflow.
