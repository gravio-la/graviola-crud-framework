import type {
  CRUDFunctions,
  SparqlEndpoint,
  WalkerOptions,
} from "@graviola/edb-core-types";
import { CrudProviderContext, useAdbContext } from "@graviola/edb-state-hooks";
import { initSPARQLStore } from "@graviola/sparql-db-impl";
import { type FunctionComponent, type ReactNode, useMemo } from "react";

import { tripleStoreImplementations } from "./tripleStoreImplementations";

export type SparqlStoreProviderProps = {
  children: ReactNode;
  endpoint: SparqlEndpoint;
  defaultLimit: number;
  walkerOptions?: Partial<WalkerOptions>;
  enableInversePropertiesFeature?: boolean;
};
export const SparqlStoreProvider: FunctionComponent<
  SparqlStoreProviderProps
> = ({
  children,
  endpoint,
  defaultLimit,
  walkerOptions,
  enableInversePropertiesFeature,
}) => {
  const crudOptions = useMemo<CRUDFunctions | null>(() => {
    return tripleStoreImplementations[endpoint.provider](endpoint);
  }, [endpoint]);

  const {
    schema,
    typeNameToTypeIRI,
    queryBuildOptions,
    jsonLDConfig: { defaultPrefix, jsonldContext },
    makeStubSchema,
  } = useAdbContext();

  const dataStore = useMemo(() => {
    return initSPARQLStore({
      defaultPrefix,
      jsonldContext,
      typeNameToTypeIRI,
      queryBuildOptions,
      walkerOptions: walkerOptions || {},
      sparqlQueryFunctions: crudOptions,
      schema,
      defaultLimit,
      makeStubSchema,
      enableInversePropertiesFeature,
      defaultUpdateGraph: endpoint.defaultUpdateGraph,
    });
  }, [
    crudOptions,
    schema,
    typeNameToTypeIRI,
    queryBuildOptions,
    defaultPrefix,
    jsonldContext,
    defaultLimit,
    walkerOptions,
    endpoint.defaultUpdateGraph,
    makeStubSchema,
    enableInversePropertiesFeature,
  ]);

  return (
    <CrudProviderContext.Provider
      value={{ crudOptions, dataStore, isReady: Boolean(dataStore) }}
    >
      {children}
    </CrudProviderContext.Provider>
  );
};
