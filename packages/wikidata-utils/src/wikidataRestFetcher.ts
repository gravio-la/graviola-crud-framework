import type { AuthConfig } from "@graviola/edb-core-types";

export type WikidataRestFetcher = {
  searchFetch: (searchParams: URLSearchParams) => Promise<any>;
  entityFetch: (entityParams: URLSearchParams) => Promise<any>;
  restSearchFetch: (searchParams: URLSearchParams) => Promise<any>;
};

const createAuthHeaders = (auth?: AuthConfig) => {
  const headers: Record<string, string> = {};

  if (auth?.username && auth?.password) {
    const credentials = btoa(`${auth.username}:${auth.password}`);
    headers.Authorization = `Basic ${credentials}`;
  } else if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  return headers;
};

export const createDefaultWikidataRestFetcher = (
  apiEndpoint: string = "https://www.wikidata.org/w/api.php",
  restEndpoint: string = "https://www.wikidata.org/w/rest.php/v1/search/page",
  auth?: AuthConfig,
): WikidataRestFetcher => ({
  searchFetch: async (searchParams: URLSearchParams) => {
    const url = `${apiEndpoint}?${searchParams.toString()}`;
    const response = await fetch(url, {
      headers: createAuthHeaders(auth),
      method: "GET",
      mode: "cors",
      credentials: "omit", // Wikidata doesn't support credentials with CORS
    });
    return response.json();
  },

  entityFetch: async (entityParams: URLSearchParams) => {
    const url = `${apiEndpoint}?${entityParams.toString()}`;
    const response = await fetch(url, {
      headers: createAuthHeaders(auth),
      method: "GET",
      mode: "cors",
      credentials: "omit", // Wikidata doesn't support credentials with CORS
    });
    return response.json();
  },

  restSearchFetch: async (searchParams: URLSearchParams) => {
    const url = `${restEndpoint}?${searchParams.toString()}`;
    const response = await fetch(url, {
      headers: createAuthHeaders(auth),
      method: "GET",
      mode: "cors",
      credentials: "omit", // Wikidata doesn't support credentials with CORS
    });
    return response.json();
  },
});
