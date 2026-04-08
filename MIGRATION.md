# Splitting this monorepo into two GitHub repositories

This repository contains two long-lived branches that share history:

| Branch                 | Purpose                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `split/core-framework` | Graviola framework (`packages/*`) and generic apps (`apps/testapp`, `apps/storybook`, …).                                   |
| `split/manifestations` | SLUB domain schemas (`manifestation/*`) and exhibition stack apps (`apps/exhibition-live`, `apps/edb-api`, `apps/edb-cli`). |

See also `SPLIT_BRANCH_CORE.md` and `SPLIT_BRANCH_MANIFESTATIONS.md` for exact delete lists.

## Publishing to two remotes

From either branch tip:

```bash
# Core framework repo (example remote name)
git remote add core git@github.com:YOUR_ORG/graviola-crud-framework.git
git push core split/core-framework:main

# Manifestations repo
git remote add manifestations git@github.com:YOUR_ORG/graviola-exhibition.git
git push manifestations split/manifestations:main
```

Adjust remote URLs and branch names (`main` vs `master`) to your GitHub setup.

## Refreshing vendored `@graviola` tarballs (manifestations branch only)

The manifestations branch installs most `@graviola/*` packages from the npm registry. Packages that are **not** published are shipped as tarballs under `vendor/graviola-packs/`.

To regenerate those tarballs, use a **full** monorepo checkout that still contains `packages/` (for example `split/core-framework` or `main` before the split), then:

```bash
./scripts/pack-vendor-packages.sh
```

That script runs `bun run build:packages`, `npm pack` for the internal packages, then `sanitize-vendor-tarballs.mjs` and `fix-vendor-workspace-deps.mjs`. Copy the resulting `vendor/graviola-packs/*.tgz` files into the manifestations repo and commit.

## Release order

1. Publish or tag `@graviola/*` releases from the **core** repo as needed.
2. Bump semver ranges (or re-vendor tarballs) in the **manifestations** repo to pick up API changes.
