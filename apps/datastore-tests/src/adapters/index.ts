import type { AbstractDatastore } from "@graviola/edb-global-types";
import type { DatastoreAdapter } from "../types";
import { createOxigraphLocalAdapter } from "./oxigraphLocalAdapter";
import { createSparqlAdapter } from "./sparqlAdapter";
import { createPrismaAdapter } from "./prismaAdapter";

/** True when SKIP_DEFAULT_ADAPTER is set to a truthy value (1, true, yes; not 0/false/no). */
function skipDefaultAdaptersEnv(): boolean {
  const v = process.env.SKIP_DEFAULT_ADAPTER;
  if (v === undefined || v === "") return false;
  return !["0", "false", "no"].includes(v.trim().toLowerCase());
}

/**
 * Returns the list of adapters to test against, based on environment variables.
 *
 * Always-on (no env var needed), unless SKIP_DEFAULT_ADAPTER=1:
 *   - SPARQL/Oxigraph (in-process) — uses oxigraph npm Store directly
 *
 * Opt-in via env vars:
 *   - OXIGRAPH_URL    → SPARQL/Oxigraph (Docker HTTP)
 *   - BLAZEGRAPH_URL  → SPARQL/Blazegraph (Docker HTTP)
 *   - FUSEKI_URL      → SPARQL/Jena Fuseki TDB (Docker HTTP; dataset base, e.g. …/ds)
 *   - VIRTUOSO_URL    → SPARQL/OpenLink Virtuoso (Docker HTTP; optional VIRTUOSO_DEFAULT_GRAPH, VIRTUOSO_USER, VIRTUOSO_PASSWORD)
 *   - SQLITE_URL      → Prisma/SQLite (with SKIP_DEFAULT_ADAPTER, must be set explicitly to include SQLite)
 *   - POSTGRES_URL    → Prisma/PostgreSQL
 *   - MARIADB_URL     → Prisma/MariaDB
 *   - MONGODB_URL     → Prisma/MongoDB
 *
 * SKIP_DEFAULT_ADAPTER=1 — omit the default in-process Oxigraph and default Prisma/SQLite.
 *   Only backends you select with env vars run (e.g. MARIADB_URL=… bun test).
 *   To include Prisma/SQLite in that mode, set SQLITE_URL explicitly.
 *
 * Example — run with all SPARQL backends:
 *   OXIGRAPH_URL=http://localhost:7878 BLAZEGRAPH_URL=http://localhost:9999/bigdata FUSEKI_URL=http://localhost:3030/ds \
 *   VIRTUOSO_URL=http://localhost:8890 bun test
 *
 * Example — SQLite Prisma (schema is generated on first Prisma adapter setup):
 *   SQLITE_URL=file:./prisma/test.db bun test
 *
 * Example — only MariaDB Prisma:
 *   SKIP_DEFAULT_ADAPTER=1 MARIADB_URL=mysql://… bun test
 */
export async function getActiveAdapters(): Promise<DatastoreAdapter[]> {
  const adapters: DatastoreAdapter[] = [];
  const skipDefault = skipDefaultAdaptersEnv();

  // ─── Always-on: local Oxigraph in-process ────────────────────────────────
  if (!skipDefault) {
    adapters.push(createOxigraphLocalAdapter());
  }

  // ─── SPARQL HTTP endpoints ────────────────────────────────────────────────
  if (process.env.OXIGRAPH_URL) {
    adapters.push(
      createSparqlAdapter(
        "SPARQL/Oxigraph (Docker)",
        process.env.OXIGRAPH_URL,
        "oxigraph",
      ),
    );
    if (process.env.OXIGRAPH_SPARQL12) {
      adapters.push(
        createSparqlAdapter(
          "SPARQL/Oxigraph (Docker) [sparql12]",
          process.env.OXIGRAPH_URL,
          "oxigraph",
          { sparqlFlavour: "sparql12" },
        ),
      );
    }
  }

  if (process.env.BLAZEGRAPH_URL) {
    adapters.push(
      createSparqlAdapter(
        "SPARQL/Blazegraph (Docker)",
        process.env.BLAZEGRAPH_URL,
        "blazegraph",
      ),
    );
  }

  if (process.env.FUSEKI_URL) {
    adapters.push(
      createSparqlAdapter(
        "SPARQL/Jena Fuseki (Docker)",
        process.env.FUSEKI_URL,
        "fuseki",
      ),
    );
    if (process.env.FUSEKI_SPARQL12) {
      adapters.push(
        createSparqlAdapter(
          "SPARQL/Jena Fuseki (Docker) [sparql12]",
          process.env.FUSEKI_URL,
          "fuseki",
          { sparqlFlavour: "sparql12" },
        ),
      );
    }
  }

  if (process.env.VIRTUOSO_URL) {
    adapters.push(
      createSparqlAdapter(
        "SPARQL/Virtuoso (Docker)",
        process.env.VIRTUOSO_URL,
        "virtuoso",
        {
          defaultGraph: process.env.VIRTUOSO_DEFAULT_GRAPH ?? "urn:default",
          username: process.env.VIRTUOSO_USER ?? "dba",
          password: process.env.VIRTUOSO_PASSWORD ?? "dba",
        },
      ),
    );
  }

  // ─── Prisma adapters ──────────────────────────────────────────────────────
  const sqliteUrl = process.env.SQLITE_URL ?? "file:./prisma/test.db";

  // SKIP_PRISMA=1 omits all Prisma adapters.
  // With SKIP_DEFAULT_ADAPTER, default Prisma/SQLite is omitted unless SQLITE_URL is set explicitly.
  if (!process.env.SKIP_PRISMA) {
    if (!skipDefault) {
      adapters.push(createPrismaAdapter("Prisma/SQLite", sqliteUrl));
    } else if (process.env.SQLITE_URL) {
      adapters.push(
        createPrismaAdapter("Prisma/SQLite", process.env.SQLITE_URL),
      );
    }
  }

  if (process.env.POSTGRES_URL) {
    adapters.push(
      createPrismaAdapter("Prisma/PostgreSQL", process.env.POSTGRES_URL),
    );
  }

  if (process.env.MARIADB_URL) {
    adapters.push(
      createPrismaAdapter("Prisma/MariaDB", process.env.MARIADB_URL),
    );
  }

  if (process.env.MONGODB_URL) {
    adapters.push(
      createPrismaAdapter("Prisma/MongoDB", process.env.MONGODB_URL),
    );
  }

  return adapters;
}

/**
 * Creates a fresh in-process Oxigraph store for use as an import source.
 * Defined here (not in import.suite.ts) to centralise the oxigraph import.
 */
export async function createSourceOxigraphStore(): Promise<AbstractDatastore> {
  const adapter = createOxigraphLocalAdapter();
  return adapter.setup();
}
