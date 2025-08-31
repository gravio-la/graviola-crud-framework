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
import dayjs from "dayjs";
import { materialCells } from "@jsonforms/material-renderers";

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
      WeldingTemplate: {
        label: "name",
        description: "drawingNumber",
      },
      WeldedComponent: {
        label: "uniqueNumber",
        description: "partId",
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
      WeldingTemplate: "Schweißvorlage",
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
      WeldingTemplate: generateDefaultUISchema(
        bringDefinitionToTop(metalSchema as any, "WeldingTemplate") as any,
        {
          scopeOverride: {
            "#/properties/weldedComponents": {
              type: "Control",
              scope: "#/properties/weldedComponents",
              options: {
                dropdown: true,
                showCreateButton: true,
                prepareNewEntityData: (parentData: any) => {
                  const newData = {
                    material: parentData.material,
                    weldingTemplate: parentData,
                    weldingDate: dayjs().format("YYYY-MM-DD"),
                    uniqueNumber: String(
                      Math.floor(10000000 + Math.random() * 90000000),
                    ),
                    partId: Array.from({ length: 8 }, () =>
                      String.fromCharCode(65 + Math.floor(Math.random() * 26)),
                    ).join(""),
                  };
                  return newData;
                },
              },
            },
          },
        },
      ),
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
              label: "Mängelliste",
              options: {
                chips: true,
              },
            },
            "#/properties/welder": {
              type: "Control",
              scope: "#/properties/welder",
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
          cellRendererRegistry={materialCells}
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
