/**
 * HTTP Digest for OpenLink Virtuoso `/sparql-auth` — delegates to `digest-fetch`.
 * Pass the result as `customFetch` on `createHttpSparqlCrudFunctions` / `sparqlUpdateHttp`.
 */
import DigestClient from "digest-fetch";
import type { HttpFetchFn } from "@graviola/remote-query-implementations";

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

export function createVirtuosoDigestFetch(
  username: string,
  password: string,
): HttpFetchFn {
  const client = new DigestClient(username, password);
  return (input, init) =>
    client.fetch(toUrlString(input), init ?? {}) as Promise<Response>;
}
