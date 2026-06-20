# Public npm publication

`nestjs-yalc` is published as a generated npm distribution, not directly from
the source workspace folders.

The source repository remains a monorepo with npm workspaces. `npm run build`
compiles the TypeScript sources into `var/dist` and then writes one publishable
package per library:

- `@nestjs-yalc/framework`: the all-in-one framework package. It depends on the
  individual `@nestjs-yalc/*` libraries and re-exports their public entrypoints.
- `@nestjs-yalc/crud-gen`, `@nestjs-yalc/database`, `@nestjs-yalc/graphql`,
  `@nestjs-yalc/event-manager`, and the other scoped libraries: individually
  installable building blocks.
- `@nestjs-yalc/types` and `@nestjs-yalc/types-extends`: declaration packages
  used by the framework packages and by consumers that need shared type aliases.

## Why publish from `var/dist`

The source workspaces are optimized for local development, examples, TypeScript
path aliases, and tests. Public npm packages need a different shape:

- compiled JavaScript and declaration files;
- no `file:` dependencies;
- no monorepo-only scripts, workspaces, overrides, or dev dependencies;
- `publishConfig.access = "public"` for scoped packages;
- package-local `README.md` and `LICENSE` files.

`build-dist.mjs` is the boundary between those two worlds. It rewrites the
package metadata for npm and keeps generated artifacts out of git.

Every published package must keep its own npm-safe `README.md` next to its
`package.json`. The build intentionally fails when a publishable package is
missing that file, or when the README contains Jekyll front matter, Liquid
expressions, or landing-page HTML. `docs/README.md` is the documentation site
landing page and must not be used as an npm README fallback.

## Release commands

Run the full checks before any publication:

```bash
npm run ci:checks
```

Build the publishable distribution:

```bash
npm run build
```

Validate every generated package with `npm pack --dry-run`:

```bash
npm run pack:dry-run
```

Run an npm publish dry-run for every generated package:

```bash
npm run publish:dry-run
```

The dry-run uses `--skip-existing`, matching the publish workflow retry
behavior. If the current version is already published, the command skips that
package instead of failing on npm's immutable-version guard.

Run the public-package smoke test against local tarballs:

```bash
npm run smoke:public:tarball
```

Publish every generated package publicly:

```bash
npm run publish:public
```

The publish script runs from each `var/dist/*` package directory and uses
`npm publish --access public`.

After publishing, run the same smoke test against the npm registry:

```bash
npm run smoke:public:registry
```

The smoke test creates a temporary consumer project outside the monorepo,
installs the packages, type-checks public imports, and executes runtime imports
from the public package roots. Use the tarball smoke before publication and the
registry smoke immediately after publication.

## GitHub Actions publication

Public npm releases are automated by
`.github/workflows/npm-publish.yml`. The workflow runs the same release gates as
the manual process:

- `npm run ci:checks`
- `npm run pack:dry-run`
- `npm run publish:dry-run`
- `npm run smoke:public:tarball`
- `npm publish --access public --provenance`
- `npm run smoke:public:registry`

The workflow has two entrypoints:

- `release.published`: validates, publishes, and runs the registry smoke test.
- `workflow_dispatch`: validates by default. Set `publish = true` to publish
  manually.

The workflow uses `--skip-existing` for release runs and for manual runs by
default. This makes the job safe to retry after npm propagation delays or a
partially completed publish: package versions that already exist are skipped,
and missing package versions are still published.

Preferred authentication is npm Trusted Publishing with GitHub OIDC. Configure
each published package under the `@nestjs-yalc` scope with this trusted
publisher:

```text
Repository: NestDevLab/nestjs-yalc
Workflow: .github/workflows/npm-publish.yml
Environment: npm
```

The workflow requests `id-token: write` and publishes with `--provenance`, so no
long-lived npm token is required once Trusted Publishing is configured. If a new
package must be published before npm allows Trusted Publishing to be configured,
use a short-lived granular npm token with read/write access to `@nestjs-yalc`,
enable bypass 2FA, store it as the `NPM_TOKEN` repository secret, publish once,
then remove the secret after the package is converted to Trusted Publishing.

## Versioning model

The repository uses Changesets with independent workspace package versions. A
changeset explicitly declares which public package or packages changed and
whether each change is `patch`, `minor`, or `major`. There is no automatic file
analysis: the PR author records the intended public release impact in the
changeset.

Internal package dependencies are rewritten to the current public version of the
target package:

```json
{
  "@nestjs-yalc/database": "^1.3.3"
}
```

This keeps version PRs focused: changing one leaf package usually updates that
package, its changelog, and any dependent packages that Changesets determines
must receive an internal dependency range update.

`@nestjs-yalc/framework` is the generated aggregate package published from the
repository root. It depends on the individual workspace packages using caret
ranges. For normal patch and minor workspace releases, existing framework
versions can resolve the newer compatible packages through npm's semver rules.
Only bump the root framework package when the aggregate package itself changes
or when a workspace package needs a new incompatible major range.

Add a changeset in every PR that changes public behavior:

```bash
npm run changeset
```

Select the workspace package or packages changed by the PR. Do not select
`@nestjs-yalc/framework` for ordinary library changes; it is the repository root
package and should only be bumped when the aggregate package itself needs a new
release.

Choose the highest required release type for the overall public release:

- `patch`: bug fixes, documentation corrections that affect package consumers,
  and compatible internal improvements.
- `minor`: new public APIs, new supported package entrypoints, or new framework
  capabilities.
- `major`: breaking public API or runtime behavior changes.

For changes that only affect CI, tests, or repository maintenance, do not add a
changeset.

Check pending release impact locally:

```bash
npm run changeset:status
```

After changes are merged into `dev`, `.github/workflows/changesets.yml` creates
or updates a release PR titled `chore(release): version packages`. That PR runs
`npm run version:packages`, updates the selected package versions, updates
internal dependency ranges, updates changelogs, updates `package-lock.json`, and
removes consumed changeset files.

The version PR does not publish by itself. Once the version PR is merged, use
the npm publication workflow described above to publish the new immutable npm
versions.

## Publishing order

The helper scripts publish packages in dependency-first order. This prevents the
aggregate `@nestjs-yalc/framework` package from being published before the
individual `@nestjs-yalc/*` packages it depends on. For the first real public
release, publish from a clean git state and verify that the npm user has publish
rights for the `@nestjs-yalc` scope before running `npm run publish:public`.

If npm rejects a package because the version already exists, create or merge the
next Changesets version PR and rebuild. npm package versions are immutable.

## Consumer installation

Install the full framework:

```bash
npm install @nestjs-yalc/framework
```

Install only a specific library:

```bash
npm install @nestjs-yalc/crud-gen
```

Single-library installs are supported, but consumers still need the relevant
NestJS, GraphQL, TypeORM, or transport peer dependencies required by the feature
they use.

## Public example mirrors

The examples inside this monorepo are development testbeds. They intentionally
use local `file:` dependencies so framework changes can be exercised immediately
by the runnable apps and e2e suites.

Public read-only example repositories should not be maintained by hand and
should not depend on monorepo paths. Generate their source trees from the
monorepo instead:

```bash
npm run examples:export
```

The export command writes standalone example sources under `var/example-exports`:

- `var/example-exports/skeleton`
- `var/example-exports/omnikernel`
- `var/example-exports/task`

During export, framework dependencies such as `@nestjs-yalc/crud-gen` and
`@nestjs-yalc/framework` are rewritten to their package-specific current public
version ranges. Example-local packages stay as local `file:` dependencies
inside the exported tree, for example `@nestjs-yalc/skeleton-module` or
`@nestjs-yalc/task-system-module`.

The exported directories are the intended source for future read-only mirrors
such as `nestjs-yalc-example-skeleton`, `nestjs-yalc-example-omnikernel`, and
`nestjs-yalc-example-task`. Those mirrors should demonstrate how a consumer
installs Yalc from npm, while the monorepo examples remain optimized for
framework development and CI coverage.

Each export also includes a standalone GitHub Actions workflow that installs the
example app, builds it, and runs its e2e tests. See
[Public example mirrors](./public-example-mirrors.md) for the repository sync
workflow, required GitHub token, and read-only mirror operating model.
