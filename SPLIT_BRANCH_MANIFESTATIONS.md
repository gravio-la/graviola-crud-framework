# `split/manifestations` branch — removed paths

This branch drops the Graviola framework source tree and keeps only SLUB manifestations and exhibition stack apps. `@graviola/*` dependencies come from the public npm registry and from vendored tarballs under `vendor/graviola-packs/`.

## Deleted top-level paths

- `packages/` (entire monorepo library tree: `packages/*`, `packages/form-renderer/*`, `packages/ideas/*`)
- `apps/testapp/`
- `apps/storybook/`
- `apps/datastore-tests/`
- `apps/json-schema-cli/`
- `apps/test-prisma-cli/`
- `_templates/` (hygen templates for new packages)
- `.changeset/` (changesets for `@graviola` publishing)
- `.github/workflows/publish-npm.yml`
- `.github/workflows/storybook-to-pages.yml`

## Kept

- `manifestation/exhibition`, `manifestation/kulinarik`, `manifestation/exhibition-sparql-config`
- `apps/exhibition-live`, `apps/edb-api`, `apps/edb-cli`
- `vendor/graviola-packs/*.tgz` (unpublished `@graviola` packages + `eslint-config-edb`)
- `docker/`, `docker-compose.yml` (nodejs command updated)

## Workspace protocol

- `workspace:*` is used **only** for `@slub/*` packages among themselves (e.g. `@slub/exhibition-sparql-config` → `@slub/exhibition-schema`).
- All `@graviola/*` dependencies use npm semver or `file:../../vendor/graviola-packs/...`.
