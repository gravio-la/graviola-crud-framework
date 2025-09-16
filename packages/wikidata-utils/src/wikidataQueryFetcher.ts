import type { RDFSelectResult, AuthConfig } from "@graviola/edb-core-types";
import datasetFactory from "@rdfjs/dataset";
import N3 from "n3";

export type WikidataSparqlFetcher = {
  selectFetch: (query: string) => Promise<RDFSelectResult>;
  constructFetch: (
    query: string,
  ) => Promise<ReturnType<typeof datasetFactory.dataset>>;
  askFetch: (query: string) => Promise<boolean>;
};

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
} as const;

const createAuthHeaders = (
  headers: Record<string, string>,
  auth?: AuthConfig,
) => {
  const authHeaders = { ...headers };

  if (auth?.username && auth?.password) {
    const credentials = btoa(`${auth.username}:${auth.password}`);
    authHeaders.Authorization = `Basic ${credentials}`;
  } else if (auth?.token) {
    authHeaders.Authorization = `Bearer ${auth.token}`;
  }

  return authHeaders;
};

const createFetchFunction =
  (config: FetchConfig) =>
  (query: string, endpoint: string, auth?: AuthConfig) =>
    fetch(endpoint, {
      headers: createAuthHeaders(
        {
          accept: config.accept,
          "content-type": config.contentType,
        },
        auth,
      ),
      body: query,
      method: "POST",
      mode: "cors",
      credentials: "omit", // Wikidata doesn't support credentials with CORS
      ...(config.cache && { cache: config.cache }),
    });

const fetchNTriples = createFetchFunction(fetchConfigs.ntriples);
const fetchSPARQLResults = createFetchFunction(fetchConfigs.sparqlResults);

export const createDefaultWikidataSparqlFetcher = (
  endpoint: string = "https://query.wikidata.org/sparql",
  auth?: AuthConfig,
): WikidataSparqlFetcher => ({
  askFetch: async (query: string) => {
    const res = await fetchSPARQLResults(query, endpoint, auth);
    const { boolean } = await res.json();
    return boolean === true;
  },
  constructFetch: async (query: string) => {
    const res = await fetchNTriples(query, endpoint, auth);
    const reader = new N3.Parser();
    const ntriples = await res.text();
    const ds = datasetFactory.dataset(reader.parse(ntriples));
    return ds;
  },
  selectFetch: async (query: string) => {
    const res = await fetchSPARQLResults(query, endpoint, auth);
    const resultJson = (await res.json()) as RDFSelectResult;
    return resultJson;
  },
});
