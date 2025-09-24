import { CssBaseline, CircularProgress } from "@mui/material";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@graviola/edb-state-hooks";

import { BASE_IRI, PUBLIC_BASE_PATH } from "../components/config";
import { AdbProvider, store } from "@graviola/edb-state-hooks";
import {
  EntityDetailModal,
  EditEntityModal,
} from "@graviola/edb-advanced-components";
import { Provider } from "react-redux";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { exhibitionConfig } from "../components/config/exhibitionAppConfig";
import { SemanticJsonFormNoOps } from "@graviola/edb-linked-data-renderer";
import { SimilarityFinder } from "../components/form/similarity-finder/SimilarityFinder";
import { ThemeComponent } from "@graviola/edb-default-theme";
import { LocalOxigraphStoreProvider } from "@graviola/local-oxigraph-store-provider";
import NiceModal from "@ebay/nice-modal-react";
import "react-json-view-lite/dist/index.css";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export const parameters = {
  nextRouter: {
    Provider: AppRouterContext.Provider, // next 13 next 13 (using next/navigation)
  },
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

const queryClient = new QueryClient();

const LocalStoreWithExampleDataProvider = ({ children }) => {
  const { data } = useQuery({
    queryKey: ["exampleData"],
    queryFn: async () => {
      const basePath = PUBLIC_BASE_PATH || "";
      const data = await fetch(basePath + "/example-exhibitions.ttl").then(
        (res) => res.text(),
      );
      const ontology = await fetch(
        basePath + "/ontology/exhibition-info.owl.ttl",
      ).then((res) => res.text());
      return [data, ontology];
    },
  });
  return (
    <LocalOxigraphStoreProvider
      endpoint={{
        endpoint: "urn:worker",
        label: "Local",
        provider: "worker",
      }}
      defaultLimit={10}
      initialData={data}
      loader={<CircularProgress />}
    >
      {children}
    </LocalOxigraphStoreProvider>
  );
};

export const useRouterMock = () => {
  return {
    push: async (url) => {
      console.log("push", url);
    },
    replace: async (url) => {
      console.log("replace", url);
    },
    asPath: "",
    pathname: "",
    query: {},
  };
};

export const withMuiTheme = (Story) => {
  return (
    <Provider store={store}>
      <AdbProvider
        {...exhibitionConfig}
        env={{
          publicBasePath: PUBLIC_BASE_PATH || "",
          baseIRI: BASE_IRI,
        }}
        components={{
          EntityDetailModal: EntityDetailModal,
          EditEntityModal: EditEntityModal,
          SemanticJsonForm: SemanticJsonFormNoOps,
          SimilarityFinder: SimilarityFinder,
        }}
        useRouterHook={useRouterMock}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <ThemeComponent>
            <QueryClientProvider client={queryClient}>
              <LocalStoreWithExampleDataProvider>
                <NiceModal.Provider>
                  <CssBaseline />
                  <Story />
                </NiceModal.Provider>
              </LocalStoreWithExampleDataProvider>
            </QueryClientProvider>
          </ThemeComponent>
        </LocalizationProvider>
      </AdbProvider>
    </Provider>
  );
};

export const decorators = [withMuiTheme];
