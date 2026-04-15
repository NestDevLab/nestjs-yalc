# Public example mirrors

The public example repositories are generated from the monorepo examples. They
are read-only consumer templates, not independent development branches.

The monorepo remains the source of truth for:

- `examples/skeleton`: the minimal `CrudGenResourceFactory` path.
- `examples/omnikernel`: the reusable OmniKernel backend plus generated REST and
  GraphQL APIs.
- `examples/task`: the larger composition example with OmniKernel persistence,
  CrudGen APIs, API Strategy, EventManager, and e2e coverage.

## Mirror repositories

The public mirror repositories are:

- [NestDevLab/nestjs-yalc-example-skeleton](https://github.com/NestDevLab/nestjs-yalc-example-skeleton)
- [NestDevLab/nestjs-yalc-example-omnikernel](https://github.com/NestDevLab/nestjs-yalc-example-omnikernel)
- [NestDevLab/nestjs-yalc-example-task](https://github.com/NestDevLab/nestjs-yalc-example-task)

They are configured as public template repositories so consumers can start a new
application from the generated example layout without cloning the full
framework monorepo.

The mirrors should be configured so normal users cannot push directly. Keep the
default branch protected and allow writes only from maintainers or the sync
token used by the source repository workflow.

## Export model

Generate standalone sources with:

```bash
npm run examples:export
```

The command writes generated repositories under `var/example-exports`:

- `var/example-exports/skeleton`
- `var/example-exports/omnikernel`
- `var/example-exports/task`

Each export includes:

- the example `app` and local example `module` packages;
- any additional local example modules required by the app;
- a generated `.github/workflows/ci.yml`;
- a generated `.gitignore`;
- `PUBLIC_EXPORT.md`, which explains that the repository is generated.

Framework dependencies are rewritten from monorepo `file:` dependencies to the
package-specific public npm range. Example-local packages remain `file:`
dependencies inside the exported repository, because they are part of the
template itself.

## Mirror sync

Sync all mirrors from the generated exports with:

```bash
npm run examples:mirror
```

Preview pending mirror changes without committing or pushing:

```bash
npm run examples:mirror:dry-run
```

The sync script expects the mirror repositories to already exist and to have a
`main` branch. By default it targets the `NestDevLab` owner and these repository
names:

- `nestjs-yalc-example-skeleton`
- `nestjs-yalc-example-omnikernel`
- `nestjs-yalc-example-task`

Override defaults with environment variables when needed:

```bash
EXAMPLE_MIRROR_OWNER=NestDevLab
EXAMPLE_MIRROR_BRANCH=main
EXAMPLE_MIRROR_SKELETON_REPOSITORY=nestjs-yalc-example-skeleton
EXAMPLE_MIRROR_OMNIKERNEL_REPOSITORY=nestjs-yalc-example-omnikernel
EXAMPLE_MIRROR_TASK_REPOSITORY=nestjs-yalc-example-task
```

For authenticated pushes, set `EXAMPLE_MIRROR_TOKEN` or `GH_TOKEN` to a GitHub
token that can write to the mirror repositories.

## GitHub Actions

`.github/workflows/example-mirrors.yml` runs the mirror sync from the source
repository. It can be triggered manually and also runs after changes to the
canonical example folders or mirror scripts on `dev`.

Configure this secret in `NestDevLab/nestjs-yalc` before enabling real pushes:

```text
EXAMPLE_MIRROR_TOKEN
```

Use a fine-grained GitHub token with write access only to the three mirror
repositories. The source repository `GITHUB_TOKEN` is intentionally not used for
external pushes.

## Mirror CI

Each generated mirror contains its own CI workflow. The workflow runs:

```bash
npm install --prefer-offline --no-audit
npm run build
npm run test:e2e
```

Each export has a generated root `package.json` with npm workspaces for `app`,
`module`, and any additional local example modules. CI installs from the export
root so sibling modules can resolve both the public framework packages and the
example-local packages through the shared workspace dependency tree.

The workflow uses `npm install` rather than `npm ci` because the exported
template does not reuse monorepo lockfiles. If a mirror should become fully
locked later, generate lockfiles inside the exported repository after dependency
rewrites instead of copying workspace lockfiles from the monorepo.

## Contribution model

Do not edit mirror repositories directly. Apply changes to the corresponding
monorepo example, run the example e2e suite, export the mirrors, and let the
sync workflow update the public repositories.
