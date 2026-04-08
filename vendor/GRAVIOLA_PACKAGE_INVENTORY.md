# Graviola dependency inventory for manifestations split

Generated for the `split/manifestations` branch: `@graviola/*` dependencies are resolved from the **npm registry** where published, and from **committed tarballs** under `vendor/graviola-packs/` for packages that are not published.

## Published on npm (use semver in package.json)

| Package                                | Version (pinned at split) |
| -------------------------------------- | ------------------------- |
| @graviola/async-oxigraph               | ^0.2.0                    |
| @graviola/data-mapping-hooks           | ^1.1.8                    |
| @graviola/edb-advanced-components      | ^1.5.0                    |
| @graviola/edb-authorities              | ^0.2.4                    |
| @graviola/edb-basic-components         | ^1.3.0                    |
| @graviola/edb-basic-renderer           | ^4.0.0                    |
| @graviola/edb-cli-creator              | ^1.2.5                    |
| @graviola/edb-core-types               | ^1.3.0                    |
| @graviola/edb-core-utils               | ^1.4.1                    |
| @graviola/edb-data-mapping             | ^0.2.7                    |
| @graviola/edb-debug-utils              | ^1.2.2                    |
| @graviola/edb-default-theme            | ^1.1.2                    |
| @graviola/edb-file-import              | ^1.0.8                    |
| @graviola/edb-global-types             | ^1.2.0                    |
| @graviola/edb-graph-traversal          | ^1.3.2                    |
| @graviola/edb-kxp-utils                | ^1.1.8                    |
| @graviola/edb-layout-renderer          | ^1.2.0                    |
| @graviola/edb-linked-data-renderer     | ^4.0.1                    |
| @graviola/edb-marc-to-rdf              | ^1.1.5                    |
| @graviola/edb-markdown-renderer        | ^1.3.0                    |
| @graviola/edb-state-hooks              | ^1.5.0                    |
| @graviola/edb-table-components         | ^1.3.0                    |
| @graviola/edb-ui-utils                 | ^1.3.0                    |
| @graviola/edb-virtualized-components   | ^1.3.0                    |
| @graviola/edb-vis-timeline             | ^1.2.0                    |
| @graviola/edb-wikidata-utils           | ^1.1.0                    |
| @graviola/entity-finder                | ^1.3.0                    |
| @graviola/json-schema-prisma-utils     | ^1.2.8                    |
| @graviola/json-schema-utils            | ^1.4.1                    |
| @graviola/prisma-db-impl               | ^1.5.4                    |
| @graviola/remote-query-implementations | ^1.3.1                    |
| @graviola/semantic-json-form           | ^1.4.0                    |
| @graviola/sparql-db-impl               | ^1.4.0                    |
| @graviola/sparql-schema                | ^1.4.0                    |
| @graviola/sparql-store-provider        | ^4.0.0                    |

## Not on npm (vendored tarballs in `vendor/graviola-packs/`)

| Package                    | Source path in full monorepo (before split) |
| -------------------------- | ------------------------------------------- |
| @graviola/edb-build-helper | packages/build-helper                       |
| @graviola/edb-charts       | packages/ideas/charts                       |
| @graviola/edb-tsconfig     | packages/tsconfig                           |
| @graviola/edb-tsup-config  | packages/tsup-config                        |
| eslint-config-edb          | packages/eslint-config-edb                  |

Tarball filenames match `npm pack` output (e.g. `graviola-edb-build-helper-0.4.4.tgz`).

## Workspace-only (manifestations repo)

- `@slub/exhibition-schema`, `@slub/kulinarik-schema`, `@slub/exhibition-sparql-config` — `workspace:*` only among these packages where applicable.
