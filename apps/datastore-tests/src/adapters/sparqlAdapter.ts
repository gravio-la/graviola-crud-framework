/**
 * Remote SPARQL HTTP adapter.
 *
 * Connects to an HTTP SPARQL endpoint (Oxigraph Docker, Blazegraph, Jena Fuseki, OpenLink Virtuoso, etc.).
 * Activated by environment variables:
 *   OXIGRAPH_URL   — e.g. http://localhost:7878   (Oxigraph)
 *   BLAZEGRAPH_URL — e.g. http://localhost:9999/bigdata  (Blazegraph)
 *   FUSEKI_URL     — e.g. http://localhost:3030/ds  (Jena Fuseki dataset base)
 *   VIRTUOSO_URL   — e.g. http://localhost:8890  (OpenLink Virtuoso; see VIRTUOSO_* below)
 *   AGRAPH_URL     — AllegroGraph repository SPARQL endpoint, e.g.
 *                    http://localhost:10035/repositories/graviola_ds_test
 *                    (see AGRAPH_USER / AGRAPH_PASSWORD; default test / xyzzy)
 *   GRAPHDB_URL    — Ontotext GraphDB repository SPARQL endpoint, e.g.
 *                    http://localhost:7200/repositories/graviola_ds_test
 *                    (optional GRAPHDB_USER / GRAPHDB_PASSWORD for secured instances)
 *
 * Oxigraph HTTP endpoints:
 *   Query:  GET/POST ${base}/query
 *   Update: POST     ${base}/update
 *
 * Blazegraph HTTP endpoints:
 *   Query:  POST ${base}/sparql
 *   Update: POST ${base}/sparql  (with application/sparql-update content-type)
 *
 * Fuseki (TDB) HTTP endpoints:
 *   Query:  POST ${base}/sparql
 *   Update: POST ${base}/update
 *
 * Virtuoso HTTP endpoints (default SPARQL flavour, `default-graph-uri` on all requests):
 *   Query:  POST ${base}/sparql?default-graph-uri=...
 *   Update: POST ${base}/sparql-auth?default-graph-uri=...  (HTTP Digest: VIRTUOSO_USER / VIRTUOSO_PASSWORD)
 *
 * AllegroGraph (SPARQL flavour `allegro`) — repository URL is both query and update:
 *   Query:  POST ${repoUrl}  (Content-Type: application/sparql-query | Accept: …)
 *   Update: POST ${repoUrl}  (Content-Type: application/sparql-update)
 *
 * GraphDB / RDF4J (flavour `default`) — query and update paths differ:
 *   Query:  POST ${repoUrl}
 *   Update: POST ${repoUrl}/statements  (Content-Type: application/sparql-update)
 */
import type { AuthConfig, SPARQLFlavour } from "@graviola/edb-core-types";
import type { AbstractDatastore } from "@graviola/edb-global-types";
import { initSPARQLStore } from "@graviola/sparql-db-impl";
import {
  type HttpFetchFn,
  applySparqlUrlSearchParams,
  createAuthHeaders,
  createHttpSparqlCrudFunctions,
  sparqlUpdateHttp,
} from "@graviola/remote-query-implementations";

import {
  rawTestSchema,
  typeNameToTypeIRI,
  queryBuildOptions,
  BASE_IRI,
} from "../schema/testSchema";
import type { DatastoreAdapter } from "../types";
import { createVirtuosoDigestFetch } from "./virtuosoDigestFetch";

type EndpointConfig = {
  queryUrl: string;
  updateUrl: string;
  flavour: SPARQLFlavour;
  auth?: AuthConfig;
  urlSearchParams?: Record<string, string>;
  customFetch?: HttpFetchFn;
};

export type SparqlAdapterOptions = {
  sparqlFlavour?: SPARQLFlavour;
  /** Virtuoso: named graph IRI (`default-graph-uri` query parameter). */
  defaultGraph?: string;
  /** Virtuoso: Digest credentials for `/sparql-auth`. AllegroGraph / GraphDB: Basic auth when set. */
  username?: string;
  password?: string;
};

function buildEndpointConfig(
  baseUrl: string,
  type:
    | "oxigraph"
    | "blazegraph"
    | "fuseki"
    | "virtuoso"
    | "allegro"
    | "graphdb",
  opts?: SparqlAdapterOptions,
): EndpointConfig {
  const base = baseUrl.replace(/\/$/, "");
  if (type === "blazegraph") {
    return {
      queryUrl: `${base}/sparql`,
      updateUrl: `${base}/sparql`,
      flavour: "blazegraph",
    };
  }
  if (type === "fuseki") {
    return {
      queryUrl: `${base}/sparql`,
      updateUrl: `${base}/update`,
      flavour: "default",
    };
  }
  if (type === "virtuoso") {
    const graph = opts?.defaultGraph ?? "urn:default";
    const user = opts?.username ?? "dba";
    const pass = opts?.password ?? "dba";
    return {
      queryUrl: `${base}/sparql`,
      updateUrl: `${base}/sparql-auth`,
      flavour: "default",
      urlSearchParams: { "default-graph-uri": graph },
      customFetch: createVirtuosoDigestFetch(user, pass),
    };
  }
  if (type === "allegro") {
    const user = opts?.username ?? "test";
    const pass = opts?.password ?? "xyzzy";
    return {
      queryUrl: base,
      updateUrl: base,
      flavour: "allegro",
      auth: { username: user, password: pass },
    };
  }
  if (type === "graphdb") {
    const user = opts?.username;
    const pass = opts?.password;
    const withAuth =
      user !== undefined && user !== "" && pass !== undefined && pass !== "";
    return {
      queryUrl: base,
      updateUrl: `${base}/statements`,
      flavour: "default",
      ...(withAuth ? { auth: { username: user, password: pass } } : {}),
    };
  }
  return {
    queryUrl: `${base}/query`,
    updateUrl: `${base}/update`,
    flavour: "oxigraph",
  };
}

export function createSparqlAdapter(
  name: string,
  baseUrl: string,
  type:
    | "oxigraph"
    | "blazegraph"
    | "fuseki"
    | "virtuoso"
    | "allegro"
    | "graphdb",
  opts?: SparqlAdapterOptions,
): DatastoreAdapter {
  const cfg = buildEndpointConfig(baseUrl, type, opts);
  const flavour = opts?.sparqlFlavour ?? cfg.flavour;

  const crudOptions = {
    queryUrl: cfg.queryUrl,
    updateUrl: cfg.updateUrl,
    auth: cfg.auth,
    urlSearchParams: cfg.urlSearchParams,
    customFetch: cfg.customFetch,
    ...(type === "allegro"
      ? { constructResultFormat: "ntriples" as const }
      : {}),
  };

  return {
    name,

    capabilities: {
      crud: true,
      listDocuments: true,
      findDocuments: true,
      countDocuments: true,
      findDocumentsByLabel: true,
      findDocumentsByAuthorityIRI: false,
      findDocumentsAsFlatResultSet: true,
      getClasses: true,
      importDocuments: false,
      iterables: false,
      filterTyped: true,
      findEntityByTypeName: true,
    },

    setup: async () => {
      // Verify the endpoint is reachable before running tests
      try {
        const healthUrl = applySparqlUrlSearchParams(
          cfg.queryUrl,
          cfg.urlSearchParams,
        );
        const fetchImpl = cfg.customFetch ?? globalThis.fetch;

        if (type === "graphdb") {
          const origin = new URL(healthUrl).origin;
          const listRes = await fetchImpl(`${origin}/rest/repositories`, {
            method: "GET",
            headers: createAuthHeaders(
              { Accept: "application/json" },
              cfg.auth,
            ),
            signal: AbortSignal.timeout(5000),
          });
          if (!listRes.ok) {
            const t = await listRes.text().catch(() => "");
            throw new Error(
              `GraphDB REST /rest/repositories failed (${listRes.status})${t ? ` — ${t.slice(0, 300)}` : ""}`,
            );
          }
        }

        const res = await fetchImpl(healthUrl, {
          method: "POST",
          headers: createAuthHeaders(
            {
              "Content-Type": "application/sparql-query",
              Accept: "application/sparql-results+json",
            },
            cfg.auth,
          ),
          body: "ASK { }",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (
            type === "graphdb" &&
            /no license was set|license was set/i.test(body)
          ) {
            throw new Error(
              `${name}: GraphDB did not find a license. Mount ./graphdb.license → /opt/graphdb/home/graphdb.license (see \`graphdb\` in docker-compose), set chmod 644 / chown 1000:1000 on the host file if needed, then \`docker compose up -d --force-recreate graphdb\`.`,
            );
          }
          if (
            type === "graphdb" &&
            /failed to read license|license validation has failed/i.test(body)
          ) {
            throw new Error(
              `${name}: GraphDB rejected the license file (unreadable, wrong edition, expired, or wrong minor version). Free keys are tied to a version line (e.g. 11.0.x): use a matching \`ontotext/graphdb\` tag in docker-compose and see Ontotext’s license email.`,
            );
          }
          throw new Error(
            `Endpoint health check failed with ${res.status}${body ? ` — ${body.slice(0, 400)}` : ""}`,
          );
        }
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (msg.startsWith(`${name}: GraphDB`)) {
          throw new Error(msg);
        }
        throw new Error(
          `${name}: endpoint ${baseUrl} is not reachable — ${msg}`,
        );
      }

      const crudFunctions = createHttpSparqlCrudFunctions(crudOptions);

      return initSPARQLStore({
        schema: rawTestSchema as any,
        defaultPrefix: BASE_IRI,
        jsonldContext: { "@vocab": BASE_IRI },
        typeNameToTypeIRI,
        queryBuildOptions: {
          ...queryBuildOptions,
          sparqlFlavour: flavour,
        },
        sparqlQueryFunctions: crudFunctions,
        defaultLimit: 100,
      });
    },

    clearAll: async (_store: AbstractDatastore) => {
      await sparqlUpdateHttp(crudOptions, "CLEAR ALL");
    },

    teardown: async () => {
      // HTTP connections are stateless; nothing to close
    },
  };
}
