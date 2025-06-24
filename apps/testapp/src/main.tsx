import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GraviolaProvider } from "./provider/GraviolaProvider";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import "./index.css";
import App from "./App.tsx";
import { schema as itemSchema } from "./schema.ts";
import { schema as metalSchema } from "./metal-schema.ts";
import { allRenderers } from "./provider/config.ts";
import { generateDefaultUISchema } from "@graviola/edb-ui-utils";

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Configuration for different schemas
const configurations = {
  items: {
    schema: itemSchema,
    primaryFields: {
      Category: {
        label: "name",
        description: "description",
      },
      Item: {
        label: "name",
        description: "description",
        image: "photos",
      },
      Tag: {
        label: "name",
        description: "description",
        image: "image",
      },
    },
    typeNameLabelMap: {
      Category: "Kategorie",
      Item: "Artikel",
      Tag: "Tag",
    },
    typeNameUiSchemaOptionsMap: {
      Category: {
        dropdown: true,
      },
      Tag: {
        chips: true,
      },
    },
    uischemata: {
      Item: generateDefaultUISchema(
        bringDefinitionToTop(itemSchema as any, "Item") as any,
        {
          scopeOverride: {
            "#/properties/tags": {
              type: "Control",
              scope: "#/properties/tags",
              options: {
                chips: true,
                dropdown: true,
              },
            },
          },
        },
      ),
    },
  },
  metal: {
    schema: metalSchema,
    primaryFields: {
      WeldedComponent: {
        label: "name",
        description: "drawingNumber",
      },
      Person: {
        label: "lastName",
        description: "employeeId",
      },
      QualityCheck: {
        label: "type",
        description: "notes",
      },
      Defect: {
        label: "type",
        description: "location",
      },
      Documentation: {
        label: "type",
        description: "file",
      },
    },
    typeNameLabelMap: {
      WeldedComponent: "Geschweißtes Bauteil",
      Person: "Mitarbeiter",
      QualityCheck: "Qualitätsprüfung",
      Defect: "Mangel",
      Documentation: "Dokument",
    },
    typeNameUiSchemaOptionsMap: {
      WeldedComponent: {
        dropdown: true,
      },
      Person: {
        dropdown: true,
      },
    },
    uischemata: {
      WeldedComponent: generateDefaultUISchema(
        bringDefinitionToTop(metalSchema as any, "WeldedComponent") as any,
        {
          scopeOverride: {
            "#/properties/qualityChecks": {
              type: "Control",
              scope: "#/properties/qualityChecks",
              options: {
                chips: true,
              },
            },
            "#/properties/defects": {
              type: "Control",
              scope: "#/properties/defects",
              options: {
                chips: true,
              },
            },
            "#/properties/inspector": {
              type: "Control",
              scope: "#/properties/inspector",
              options: {
                dropdown: true,
              },
            },
          },
        },
      ),
    },
  },
};

// Get the active configuration from environment variable
const activeConfig = import.meta.env.VITE_ACTIVE_SCHEMA || "items";
const config = configurations[activeConfig as keyof typeof configurations];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GraviolaProvider
          apiBaseUrl="https://graph.walther.sebastian-tilsch.de/query"
          schema={config.schema as any}
          renderers={allRenderers}
          baseIRI={"http://www.example.org/"}
          entityBaseIRI={"http://www.example.org/Item/"}
          primaryFields={config.primaryFields}
          typeNameLabelMap={config.typeNameLabelMap}
          typeNameUiSchemaOptionsMap={config.typeNameUiSchemaOptionsMap}
          uischemata={config.uischemata}
        >
          <App />
        </GraviolaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
