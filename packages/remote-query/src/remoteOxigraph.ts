import {
  CRUDFunctions,
  RDFSelectResult,
  SelectFetchOptions,
  SelectFetchOverload,
  SparqlEndpoint,
} from "@graviola/edb-core-types";
import datasetFactory from "@rdfjs/dataset";
import N3 from "n3";
import { createAuthHeaders } from "./authHelpers";

type AuthConfig = { username?: string; password?: string; token?: string };

interface FetchConfig {
  accept: string;
  contentType: string;
  cache?: RequestCache;
}

const fetchConfigs = {
  ntriples: {
    accept: "application/n-triples,*/*;q=0.9",
    contentType: "application/sparql-query",
    cache: "no-cache" as RequestCache,
  },
  sparqlResults: {
    accept: "application/sparql-results+json,*/*;q=0.9",
    contentType: "application/sparql-query",
    cache: "no-cache" as RequestCache,
  },
  sparqlUpdate: {
    accept: "*/*",
    contentType: "application/sparql-update",
  },
} as const;

const createFetchFunction =
  (config: FetchConfig) =>
  (
    query: string,
    endpoint: string,
    auth?: AuthConfig,
    additionalHeaders?: Record<string, string>,
  ) => {
    console.log("fetching", endpoint, auth, additionalHeaders);
    return fetch(endpoint, {
      headers: createAuthHeaders(
        {
          accept: config.accept,
          "content-type": config.contentType,
        },
        auth,
        additionalHeaders,
      ),
      body: query,
      method: "POST",
      mode: "cors",
      credentials: "include",
      ...(config.cache && { cache: config.cache }),
    });
  };

const fetchNTriples = createFetchFunction(fetchConfigs.ntriples);
const fetchSPARQLResults = createFetchFunction(fetchConfigs.sparqlResults);
const fetchSPARQLUpdate = createFetchFunction(fetchConfigs.sparqlUpdate);
export const oxigraphCrudOptions: (
  endpoint: SparqlEndpoint,
) => CRUDFunctions = ({ endpoint: url, auth }: SparqlEndpoint) => ({
  askFetch: async (query: string) => {
    const res = await fetchSPARQLResults(query, url, auth);
    const { boolean } = await res.json();
    return boolean === true;
  },
  constructFetch: async (query: string) => {
    const res = await fetchNTriples(query, url, auth),
      reader = new N3.Parser(),
      ntriples = await res.text(),
      ds = datasetFactory.dataset(reader.parse(ntriples));
    return ds;
  },
  updateFetch: async (query: string) => {
    const res = await fetchSPARQLUpdate(
      query,
      url.replace(/\/query$/, "/update"),
      auth,
    );
    return res;
  },
  selectFetch: (async (query: string, options?: SelectFetchOptions) => {
    const res = await fetchSPARQLResults(query, url, auth);
    const resultJson = (await res.json()) as RDFSelectResult;
    return options?.withHeaders ? resultJson : resultJson?.results?.bindings;
  }) as SelectFetchOverload,
});
