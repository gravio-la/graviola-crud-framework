/**
 * Remote SPARQL HTTP adapter.
 *
 * Connects to an HTTP SPARQL endpoint (Oxigraph Docker, Blazegraph, Jena Fuseki, etc.).
 * Activated by environment variables:
 *   OXIGRAPH_URL   — e.g. http://localhost:7878   (Oxigraph)
 *   BLAZEGRAPH_URL — e.g. http://localhost:9999/bigdata  (Blazegraph)
 *   FUSEKI_URL     — e.g. http://localhost:3030/ds  (Jena Fuseki dataset base)
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
 */
import type { AbstractDatastore } from "@graviola/edb-global-types";
import { initSPARQLStore } from "@graviola/sparql-db-impl";
import type { SPARQLFlavour } from "@graviola/edb-core-types";
import { createHttpSparqlCrudFunctions } from "@graviola/remote-query-implementations";

import {
  rawTestSchema,
  typeNameToTypeIRI,
  queryBuildOptions,
  BASE_IRI,
} from "../schema/testSchema";
import type { DatastoreAdapter } from "../types";

type EndpointConfig = {
  queryUrl: string;
  updateUrl: string;
  flavour: SPARQLFlavour;
};

function buildEndpointConfig(
  baseUrl: string,
  type: "oxigraph" | "blazegraph" | "fuseki",
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
  return {
    queryUrl: `${base}/query`,
    updateUrl: `${base}/update`,
    flavour: "oxigraph",
  };
}

export function createSparqlAdapter(
  name: string,
  baseUrl: string,
  type: "oxigraph" | "blazegraph" | "fuseki",
): DatastoreAdapter {
  const cfg = buildEndpointConfig(baseUrl, type);

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
        const res = await fetch(cfg.queryUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/sparql-query",
            Accept: "application/sparql-results+json",
          },
          body: "ASK { }",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          throw new Error(`Endpoint health check failed with ${res.status}`);
        }
      } catch (e: any) {
        throw new Error(
          `${name}: endpoint ${baseUrl} is not reachable — ${e.message}`,
        );
      }

      const crudFunctions = createHttpSparqlCrudFunctions({
        queryUrl: cfg.queryUrl,
        updateUrl: cfg.updateUrl,
      });

      return initSPARQLStore({
        schema: rawTestSchema as any,
        defaultPrefix: BASE_IRI,
        jsonldContext: { "@vocab": BASE_IRI },
        typeNameToTypeIRI,
        queryBuildOptions: {
          ...queryBuildOptions,
          sparqlFlavour: cfg.flavour,
        },
        sparqlQueryFunctions: crudFunctions,
        defaultLimit: 100,
      });
    },

    clearAll: async (_store: AbstractDatastore) => {
      const res = await fetch(cfg.updateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sparql-update" },
        body: "CLEAR ALL",
      });
      if (!res.ok) {
        throw new Error(
          `CLEAR ALL failed (${res.status}): ${await res.text()}`,
        );
      }
    },

    teardown: async () => {
      // HTTP connections are stateless; nothing to close
    },
  };
}
