import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { SnackbarProvider } from "notistack";
import { GraviolaProvider } from "./provider/GraviolaProvider";
import "./index.css";
import { allRenderers } from "./provider/config.ts";
import { materialCells } from "@jsonforms/material-renderers";
import { metalSchemaConfig } from "./metal-schema.ts";
import { itemSchemaConfig } from "./item-schema.ts";
import { courseSchemaConfig } from "./course-schema.ts";
import { metalSchemaRouteObjects } from "./metal-schema-routes.tsx";
import { itemSchemaRouteObjects } from "./item-schema-routes.tsx";
import { courseSchemaRouteObjects } from "./course-schema-routes.tsx";
import { Layout } from "./Layout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import i18n from "./i18n";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const ALL_SCHEMAS = [metalSchemaConfig, itemSchemaConfig, courseSchemaConfig];

function MetalSchemaLayout() {
  const c = metalSchemaConfig;
  return (
    <GraviolaProvider
      schema={c.schema as any}
      renderers={allRenderers}
      cellRendererRegistry={materialCells}
      baseIRI={c.baseIRI}
      entityBaseIRI={c.entityBaseIRI}
      primaryFields={c.primaryFields}
      typeNameLabelMap={c.typeNameLabelMap}
      typeNameUiSchemaOptionsMap={c.typeNameUiSchemaOptionsMap}
      uischemata={c.uischemata}
      storageKey={c.storageKey}
      initialData={c.initialData}
    >
      <Layout allSchemas={ALL_SCHEMAS} currentSchema={c} />
    </GraviolaProvider>
  );
}

function ItemSchemaLayout() {
  const c = itemSchemaConfig;
  return (
    <GraviolaProvider
      schema={c.schema as any}
      renderers={allRenderers}
      cellRendererRegistry={materialCells}
      baseIRI={c.baseIRI}
      entityBaseIRI={c.entityBaseIRI}
      primaryFields={c.primaryFields}
      typeNameLabelMap={c.typeNameLabelMap}
      typeNameUiSchemaOptionsMap={c.typeNameUiSchemaOptionsMap}
      uischemata={c.uischemata}
      storageKey={c.storageKey}
      initialData={c.initialData}
    >
      <Layout allSchemas={ALL_SCHEMAS} currentSchema={c} />
    </GraviolaProvider>
  );
}

function CourseSchemaLayout() {
  const c = courseSchemaConfig;
  return (
    <GraviolaProvider
      schema={c.schema as any}
      renderers={allRenderers}
      cellRendererRegistry={materialCells}
      baseIRI={c.baseIRI}
      entityBaseIRI={c.entityBaseIRI}
      primaryFields={c.primaryFields}
      typeNameLabelMap={c.typeNameLabelMap}
      typeNameUiSchemaOptionsMap={c.typeNameUiSchemaOptionsMap}
      uischemata={c.uischemata}
      storageKey={c.storageKey}
      initialData={c.initialData}
    >
      <Layout allSchemas={ALL_SCHEMAS} currentSchema={c} />
    </GraviolaProvider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage allSchemas={ALL_SCHEMAS} />,
  },
  {
    path: "metal-schema",
    element: <MetalSchemaLayout />,
    children: metalSchemaRouteObjects,
  },
  {
    path: "item-schema",
    element: <ItemSchemaLayout />,
    children: itemSchemaRouteObjects,
  },
  {
    path: "course-schema",
    element: <CourseSchemaLayout />,
    children: courseSchemaRouteObjects,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider maxSnack={4}>
            <RouterProvider router={router} />
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
