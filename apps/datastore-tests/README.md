# datastore-tests

Integration and contract tests for [`AbstractDatastore`](../../packages/edb-global-types) implementations used across the Graviola stack. The same suites run against every **active** backend (SPARQL stores, Prisma-backed SQL, etc.) so behavior stays aligned.

## Purpose

- Exercise CRUD, query, optional count/flat-result-set/import/class/iterable/label suites from `src/suites/`.
- Regenerate Prisma schema per database URL when a Prisma adapter runs (`scripts/setupPrismaCore.ts`), so one app can target SQLite, PostgreSQL, MariaDB, or (in future) other Prisma providers without a global one-off setup.

Runtime: **Bun** (`bun test`). Adapters are chosen from environment variables before tests collect (see `src/adapters/index.ts`).

On **NixOS**, Prisma tests are meant to run inside a flake dev shell so nixpkgs engines and `PRISMA_*` match. You must also align **`workspaces.catalogs.prisma`** (root `package.json`) with that shell—see below.

## Prerequisites

- From the monorepo root: `bun install` (workspace installs dependencies).
- Optional Docker services for remote SPARQL/SQL databases: from **this directory**, `bun run docker:up` (or `docker compose up -d --wait`).

### Nix dev shell (monorepo root)

**Canonical way to exercise Prisma in these tests:** keep two things in lockstep—**`catalogs.prisma`** and the **flake devShell**—then run via `nix develop … -c '…'`.

1. **Set** the Prisma catalog on the root `package.json` → `workspaces.catalogs.prisma` (`prisma` and `@prisma/client` to the same version). Inside `nix develop`, **`cd` to the monorepo root** and run **`catalogToPrisma <version>`** (on `PATH`, defined in `flake.nix`; the shell suggests `6.19.1` for `.#prisma6`, `7.6.0` for the default shell). It uses **`jq`** to edit both fields in `./package.json`.
2. **Install** from the repo root: `bun install` (so the workspace client matches the catalog).
3. **Pick** the matching shell (see table): Prisma **6** catalog → `nix develop .#prisma6`; Prisma **7** catalog → `nix develop` (default flake shell ships Prisma 7 engines).
4. **Run** tests in one shot from the repo root so `PATH` has the nix `prisma` and `PRISMA_*` is set:

```bash
# Prisma 6 + catalog 6.x (typical; includes MongoDB)
nix develop .#prisma6 -c bash -c 'cd apps/datastore-tests && bun test'
nix develop .#prisma6 -c bash -c 'cd apps/datastore-tests && bun run test:mongo'

# Prisma 7 + catalog 7.x (SQL adapters; no Mongo on ORM 7 yet)
nix develop -c bash -c 'cd apps/datastore-tests && bun test'
```

In the shell, `prisma version` should match the catalog major. The flake sets `PRISMA_*` for nixpkgs engines; `setupPrismaCore.ts` runs the **`prisma`** binary on `PATH`. Do not mix a Prisma 7 `prisma` on `PATH` with catalog 6 (or the reverse): `prisma generate` will fail schema validation.

**Note:** Do not use `bunx prisma` against nix engines here: it can pair an ad hoc npm CLI with nix engine versions and break `db push` (see earlier comments in this README). For **SQLite**, setup deletes the test DB file and runs `db push` **without** `--force-reset`.

| Command                 | Use when                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `nix develop .#prisma6` | Prisma **6** engines; pair with **`catalogs.prisma` 6.x** (MongoDB tests). |
| `nix develop` (default) | Prisma **7** engines; pair with **`catalogs.prisma` 7.x**.                 |

Alternatively, run `nix develop .#prisma6` or `nix develop`, then `cd apps/datastore-tests` and `bun test` (same constraints on catalog + shell).

## Environment variables

| Variable               | Effect                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKIP_DEFAULT_ADAPTER` | If set to a truthy value (`1`, `true`, `yes`), omits the default **in-process Oxigraph** and default **Prisma/SQLite** unless you opt in explicitly (see below).        |
| `SKIP_PRISMA`          | If set, omits **all** Prisma adapters (SQLite, PostgreSQL, MariaDB, MongoDB).                                                                                           |
| `SQLITE_URL`           | Prisma/SQLite URL (e.g. `file:./prisma/test.db`). With `SKIP_DEFAULT_ADAPTER=1`, SQLite Prisma runs only if this is set.                                                |
| `POSTGRES_URL`         | Enables **Prisma/PostgreSQL** (e.g. `postgresql://test:test@localhost:5432/graviola_test`).                                                                             |
| `MARIADB_URL`          | Enables **Prisma/MariaDB** (e.g. `mysql://test:test@localhost:3307/graviola_test`).                                                                                     |
| `MONGODB_URL`          | Enables **Prisma/MongoDB** (Prisma 6.x here). For local Docker, add **`replicaSet=rs0`** and usually **`directConnection=true`** (see [MongoDB notes](#mongodb-notes)). |
| `OXIGRAPH_URL`         | SPARQL over HTTP against Oxigraph (e.g. `http://localhost:7878`).                                                                                                       |
| `BLAZEGRAPH_URL`       | SPARQL over HTTP against Blazegraph (e.g. `http://localhost:9999/bigdata`).                                                                                             |
| `FUSEKI_URL`           | SPARQL over HTTP against Jena Fuseki with a TDB-backed dataset; value is the **dataset base** (e.g. `http://localhost:3030/ds` — not `/ds/sparql`).                     |

`DATABASE_URL` is set internally by Prisma setup from the adapter URL; you normally do not set it yourself for tests.

## Scripts (`package.json`)

| Script                                      | Description                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `bun run test`                              | Run the contract test file (`src/datastore.test.ts`).                         |
| `bun run test:mongo`                        | Runs tests with `SKIP_DEFAULT_ADAPTER=1` and a sample `MONGODB_URL`.          |
| `bun run docker:up` / `bun run docker:down` | Start/stop Compose services in this directory.                                |
| `bun run setup:prisma`                      | Optional standalone Prisma schema generation (see `scripts/setup-prisma.ts`). |

## Typical commands

Default local run (in-process Oxigraph + Prisma/SQLite):

```bash
cd apps/datastore-tests
bun test
```

Only MariaDB Prisma (after `docker compose up` for `mariadb`):

```bash
SKIP_DEFAULT_ADAPTER=1 MARIADB_URL='mysql://test:test@localhost:3307/graviola_test' bun test
```

Jena Fuseki (after `docker compose up` for `fuseki`):

```bash
FUSEKI_URL=http://localhost:3030/ds bun test
```

The `fuseki` service mounts [`fuseki-assembler.ttl`](fuseki-assembler.ttl) so TDB2 uses a normal default graph (the stock SeCo image’s assembler sets `unionDefaultGraph`, which hides triples from plain `SELECT`/`CONSTRUCT`).

Docker URLs for this repo’s `docker-compose.yml` are summarized at the top of that file.

## MongoDB notes

- Prisma ORM **6.x** is used here to keep MongoDB support available.
- `docker-compose.yml` uses the official **`mongo:7`** image with **`--replSet rs0`** and a **`mongo-keyfile`** bind mount (required when auth and replica set are both enabled). The healthcheck runs **`rs.initiate`** once for a single-node set named **`rs0`**. If the keyfile is missing, run `openssl rand -base64 756 | tr -d '\n' > mongo-keyfile && chmod 400 mongo-keyfile` in this directory. Use a URL that matches, e.g.  
  `mongodb://USER:PASS@localhost:27017/graviola_test?authSource=admin&directConnection=true&replicaSet=rs0`  
  **`directConnection=true`** avoids replica-set discovery issues when only `localhost:27017` is reachable from the host. **`replicaSet=rs0`** matches the set name above.
- If Mongo tests fail after switching branches, reset the local volume and restart:
  - `docker compose down -v`
  - `docker compose up -d --wait`

## Layout

- `src/datastore.test.ts` — entry point; loops adapters and attaches suites.
- `src/adapters/` — Oxigraph, SPARQL HTTP, Prisma.
- `src/suites/` — shared test suites.
- `src/schema/testSchema.ts` — JSON Schema used for Prisma generation and stores.
- `scripts/setupPrismaCore.ts` — writes `prisma/schema.prisma`, runs `prisma generate` and `db push` for the active URL.
