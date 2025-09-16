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

const fetchNTriples = (
  query: string,
  endpoint: string,
  auth?: { username?: string; password?: string; token?: string },
  additionalHeaders?: Record<string, string>,
) =>
  fetch(endpoint, {
    headers: createAuthHeaders(
      {
        accept: "application/qlever-results+json",
        "content-type": "application/x-www-form-urlencoded",
      },
      auth,
      additionalHeaders,
    ),
    body: `query=${encodeURIComponent(query)}`,
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-cache",
  });
const fetchSPARQLResults = (
  query: string,
  endpoint: string,
  auth?: { username?: string; password?: string; token?: string },
  additionalHeaders?: Record<string, string>,
) =>
  fetch(endpoint, {
    headers: createAuthHeaders(
      {
        accept: "application/sparql-results+json,*/*;q=0.9",
        "content-type": "application/x-www-form-urlencoded",
      },
      auth,
      additionalHeaders,
    ),
    body: `query=${encodeURIComponent(query)}`,
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-cache",
  });

export const qleverCrudOptions: (endpoint: SparqlEndpoint) => CRUDFunctions = ({
  endpoint: url,
  auth,
}: SparqlEndpoint) => ({
  askFetch: async (query: string) => {
    const res = await fetchSPARQLResults(query, url, auth);
    const { boolean } = await res.json();
    return boolean === true;
  },
  constructFetch: async (query: string) => {
    const res = await fetchNTriples(query, url, auth);
    const jsonRes = await res.json();
    const reader = new N3.Parser(),
      ntriples =
        jsonRes?.res
          ?.map(
            ([subject, predicate, object]) =>
              `${subject} ${predicate} ${object} .`,
          )
          ?.join("\n") || "",
      ds = datasetFactory.dataset(reader.parse(ntriples));
    return ds;
  },
  updateFetch: async (query: string) => {
    throw new Error("qleverCrudOptions:updateFetch not implemented");
  },
  selectFetch: (async (query: string, options?: SelectFetchOptions) => {
    const res = await fetchSPARQLResults(query, url, auth);
    const resultJson = (await res.json()) as RDFSelectResult;
    return options?.withHeaders ? resultJson : resultJson?.results?.bindings;
  }) as SelectFetchOverload,
});
