# Changesets

This repository uses Changesets to prepare version bumps and changelog entries.

Add a changeset when a PR changes public package behavior:

```bash
npm run changeset
```

The repository currently uses a fixed-version release model. A `patch`, `minor`,
or `major` changeset bumps the whole `@nestjs-yalc/*` release group together so
the generated npm distribution keeps one coherent public version.

Select the workspace package or packages that changed. Do not select
`@nestjs-yalc/framework`: it is the generated aggregate package, and
`npm run version:packages` synchronizes its root package version automatically.

After changes land on `dev`, `.github/workflows/changesets.yml` creates or
updates the `chore(release): version packages` PR. Merging that PR applies the
version and changelog updates. Publication is handled separately by the npm
publish workflow.
