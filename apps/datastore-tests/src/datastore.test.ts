/**
 * Main datastore contract test entry point.
 *
 * Runs all contract suite functions against every active adapter.
 * Active adapters are determined by environment variables (see adapters/index.ts).
 *
 * Default adapters (no env var), unless SKIP_DEFAULT_ADAPTER=1:
 *   - SPARQL/Oxigraph (in-process)
 *   - Prisma/SQLite (schema generated on adapter setup; disable with SKIP_PRISMA=1)
 *
 * Opt-in adapters:
 *   OXIGRAPH_URL=http://localhost:7878    → SPARQL/Oxigraph (Docker)
 *   BLAZEGRAPH_URL=http://localhost:9999/bigdata  → SPARQL/Blazegraph (Docker)
 *   POSTGRES_URL=postgresql://...        → Prisma/PostgreSQL
 *   MARIADB_URL=mysql://...              → Prisma/MariaDB
 *   MONGODB_URL=mongodb://...            → Prisma/MongoDB (Docker single-node RS: add
 *                                          ?authSource=admin&directConnection=true&replicaSet=rs0)
 *
 * SKIP_DEFAULT_ADAPTER=1 — run only backends selected via env (omit default Oxigraph + default SQLite Prisma).
 *   Example: SKIP_DEFAULT_ADAPTER=1 MARIADB_URL=mysql://… bun test
 *   Include SQLite Prisma in that mode by setting SQLITE_URL explicitly.
 *
 * Usage:
 *   bun test                             # default local adapters
 *   OXIGRAPH_URL=... bun test            # + Docker Oxigraph
 *   SKIP_PRISMA=1 bun test               # skip Prisma entirely
 */
import { describe, beforeAll, afterAll, beforeEach } from "bun:test";
import type { AbstractDatastore } from "@graviola/edb-global-types";

import { getActiveAdapters, createSourceOxigraphStore } from "./adapters";
import type { DatastoreAdapter } from "./types";

import { runCrudSuite } from "./suites/crud.suite";
import { runQuerySuite } from "./suites/query.suite";
import { runCountSuite } from "./suites/count.suite";
import { runFlatResultSetSuite } from "./suites/flatResultSet.suite";
import { runImportSuite } from "./suites/import.suite";
import { runClassesSuite } from "./suites/classes.suite";
import { runIterableSuite } from "./suites/iterable.suite";
import { runFindByLabelSuite } from "./suites/findByLabel.suite";
import { runTypedFilterSuite } from "./suites/typedFilter.suite";

// ─── Adapter loop ─────────────────────────────────────────────────────────────
// Top-level await is supported in bun:test — adapters are resolved before
// any describe blocks are collected.

const adapters = await getActiveAdapters();

if (adapters.length === 0) {
  throw new Error(
    "No datastore adapters. With SKIP_DEFAULT_ADAPTER=1 you must set at least one backend " +
      "(e.g. MARIADB_URL, OXIGRAPH_URL, SQLITE_URL, …). " +
      "Unset SKIP_DEFAULT_ADAPTER to use the default Oxigraph + Prisma/SQLite.",
  );
}

for (const adapter of adapters) {
  describe(adapter.name, () => {
    let store: AbstractDatastore;

    beforeAll(async () => {
      store = await adapter.setup();
    });

    afterAll(async () => {
      await adapter.teardown();
    });

    beforeEach(async () => {
      await adapter.clearAll(store);
    });

    // ─── Required suites (all adapters) ────────────────────────────────────
    runCrudSuite(() => store);
    runQuerySuite(() => store);

    // ─── Optional suites (capability-gated) ────────────────────────────────
    if (adapter.capabilities.countDocuments) {
      runCountSuite(() => store);
    }

    if (adapter.capabilities.findDocumentsAsFlatResultSet) {
      runFlatResultSetSuite(() => store);
    }

    if (adapter.capabilities.importDocuments) {
      runImportSuite(() => store, createSourceOxigraphStore);
    }

    if (adapter.capabilities.getClasses) {
      runClassesSuite(() => store);
    }

    if (adapter.capabilities.iterables) {
      runIterableSuite(() => store);
    }

    if (adapter.capabilities.findDocumentsByLabel) {
      runFindByLabelSuite(() => store);
    }

    if (adapter.capabilities.filterTyped) {
      runTypedFilterSuite(() => store);
    }
  });
}
