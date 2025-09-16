import { SparqlEndpoint } from "@graviola/edb-core-types";
import { CrudProviderContext, useAdbContext } from "@graviola/edb-state-hooks";
import { initSPARQLStore } from "@graviola/sparql-db-impl";
import {
  type FunctionComponent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { bulkLoader, LoadableData } from "./bulkLoader";
import { useSyncLocalWorkerCrudOptions } from "./localSyncOxigraph";
import { initSyncOxigraph } from "./useOxigraph";
import { AbstractDatastore } from "@graviola/edb-global-types";

export type LocalSyncOxigraphStoreProviderProps = {
  children: ReactNode;
  endpoint: SparqlEndpoint;
  defaultLimit: number;
  initialData?: LoadableData;
  loader?: ReactNode;
};

export const LocalSyncOxigraphStoreProvider: FunctionComponent<
  LocalSyncOxigraphStoreProviderProps
> = ({ children, endpoint, defaultLimit, initialData, loader }) => {
  const crudOptions = useSyncLocalWorkerCrudOptions(endpoint);
  const {
    schema,
    typeNameToTypeIRI,
    queryBuildOptions,
    jsonLDConfig: { defaultPrefix, jsonldContext },
    env: { publicBasePath },
  } = useAdbContext();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataStore, setDataStore] = useState<AbstractDatastore | null>(null);
  useEffect(() => {
    const init = async () => {
      const store = await initSyncOxigraph(publicBasePath);
      if (!store) {
        return null;
      }
      const dataStore = initSPARQLStore({
        defaultPrefix,
        jsonldContext,
        typeNameToTypeIRI,
        queryBuildOptions,
        walkerOptions: {
          maxRecursion: 1,
          maxRecursionEachRef: 3,
          skipAtLevel: 10,
        },
        sparqlQueryFunctions: crudOptions,
        schema,
        defaultLimit,
        defaultUpdateGraph: endpoint.defaultUpdateGraph,
      });

      if (initialData && !dataLoaded) {
        bulkLoader(store, initialData)
          .then(() => {
            setDataLoaded(true);
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {
            setDataLoaded(true);
          });
      } else {
        setDataLoaded(true);
      }

      setDataStore(dataStore);
    };
    init();
  }, [
    crudOptions,
    schema,
    typeNameToTypeIRI,
    queryBuildOptions,
    defaultPrefix,
    jsonldContext,
    defaultLimit,
    initialData,
    setDataLoaded,
    setDataStore,
    endpoint.defaultUpdateGraph,
  ]);

  return dataStore ? (
    <CrudProviderContext.Provider
      value={{
        crudOptions,
        dataStore,
        isReady: Boolean(dataStore && dataLoaded),
      }}
    >
      {!loader || dataLoaded ? children : loader}
    </CrudProviderContext.Provider>
  ) : null;
};
