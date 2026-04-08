import type {
  AuthConfig,
  CRUDFunctions,
  RDFSelectResult,
  SelectFetchOptions,
  SelectFetchOverload,
} from "@graviola/edb-core-types";
import datasetFactory from "@rdfjs/dataset";
import N3 from "n3";

import {
  createSparqlFetchFunction,
  type HttpFetchFn,
  sparqlFetchConfigs,
} from "./sparqlHttpFetch";

/** Appends search params to a SPARQL HTTP endpoint URL. */
export function applySparqlUrlSearchParams(
  urlString: string,
  params?: Record<string, string>,
): string {
  if (!params || Object.keys(params).length === 0) return urlString;
  const u = new URL(urlString);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

export type HttpSparqlCrudOptions = {
  queryUrl: string;
  updateUrl: string;
  auth?: AuthConfig;
  /**
   * CONSTRUCT response shape. Default `"turtle"` (many endpoints).
   * Use `"ntriples"` for Oxigraph-style HTTP (matches previous `oxigraphCrudOptions`).
   */
  constructResultFormat?: "turtle" | "ntriples";
  /**
   * Merged into the query and update URLs on every request (e.g. OpenLink Virtuoso
   * requires `default-graph-uri` for the target graph).
   */
  urlSearchParams?: Record<string, string>;
  /**
   * Optional `fetch` implementation (e.g. tests wrapping auth). Defaults to `globalThis.fetch`.
   */
  customFetch?: HttpFetchFn;
};

function resolveFetch(customFetch?: HttpFetchFn): HttpFetchFn {
  const fallback: HttpFetchFn = (input, init) => globalThis.fetch(input, init);
  return customFetch ?? fallback;
}

/**
 * Performs a single SPARQL UPDATE using the same transport as
 * {@link createHttpSparqlCrudFunctions}.
 */
export async function sparqlUpdateHttp(
  options: HttpSparqlCrudOptions,
  update: string,
): Promise<void> {
  const fetchBase = resolveFetch(options.customFetch);
  const fetchSPARQLUpdate = createSparqlFetchFunction(
    sparqlFetchConfigs.sparqlUpdate,
    fetchBase,
  );
  const url = applySparqlUrlSearchParams(
    options.updateUrl,
    options.urlSearchParams,
  );
  const res = await fetchSPARQLUpdate(update, url, options.auth);
  if (!res.ok) {
    throw new Error(`UPDATE failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Builds {@link CRUDFunctions} for a SPARQL 1.1 HTTP endpoint with separate
 * query and update URLs
 */
export function createHttpSparqlCrudFunctions(
  options: HttpSparqlCrudOptions,
): CRUDFunctions {
  const {
    queryUrl,
    updateUrl,
    auth,
    constructResultFormat = "turtle",
    urlSearchParams,
    customFetch,
  } = options;

  const fetchBase = resolveFetch(customFetch);
  const fetchNTriples = createSparqlFetchFunction(
    sparqlFetchConfigs.ntriples,
    fetchBase,
  );
  const fetchTurtle = createSparqlFetchFunction(
    sparqlFetchConfigs.turtle,
    fetchBase,
  );
  const fetchSPARQLResults = createSparqlFetchFunction(
    sparqlFetchConfigs.sparqlResults,
    fetchBase,
  );
  const fetchSPARQLUpdate = createSparqlFetchFunction(
    sparqlFetchConfigs.sparqlUpdate,
    fetchBase,
  );

  const resolvedQueryUrl = applySparqlUrlSearchParams(
    queryUrl,
    urlSearchParams,
  );
  const resolvedUpdateUrl = applySparqlUrlSearchParams(
    updateUrl,
    urlSearchParams,
  );

  const fetchConstruct =
    constructResultFormat === "ntriples" ? fetchNTriples : fetchTurtle;

  return {
    askFetch: async (query: string): Promise<boolean> => {
      const res = await fetchSPARQLResults(query, resolvedQueryUrl, auth);
      if (!res.ok) {
        throw new Error(`ASK failed (${res.status}): ${await res.text()}`);
      }
      const json = await res.json();
      return json.boolean === true;
    },

    constructFetch: async (query: string) => {
      const res = await fetchConstruct(query, resolvedQueryUrl, auth);
      if (!res.ok) {
        throw new Error(
          `CONSTRUCT failed (${res.status}): ${await res.text()}`,
        );
      }
      const body = await res.text();
      const parser =
        constructResultFormat === "ntriples"
          ? new N3.Parser()
          : new N3.Parser({ format: "Turtle" });
      const quads = parser.parse(body);
      return datasetFactory.dataset(quads as any);
    },

    updateFetch: async (query: string) => {
      const res = await fetchSPARQLUpdate(query, resolvedUpdateUrl, auth);
      if (!res.ok) {
        throw new Error(`UPDATE failed (${res.status}): ${await res.text()}`);
      }
    },

    selectFetch: (async (query: string, opts?: SelectFetchOptions) => {
      const res = await fetchSPARQLResults(query, resolvedQueryUrl, auth);
      if (!res.ok) {
        throw new Error(`SELECT failed (${res.status}): ${await res.text()}`);
      }
      const resultJson = (await res.json()) as RDFSelectResult;
      return opts?.withHeaders ? resultJson : resultJson?.results?.bindings;
    }) as SelectFetchOverload,
  };
}
