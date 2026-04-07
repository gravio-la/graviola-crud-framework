import { Navigate, type RouteObject } from "react-router-dom";
import { GenericCreatePage } from "./pages/GenericCreatePage";
import { GenericDetailPage } from "./pages/GenericDetailPage";
import { GenericEditPage } from "./pages/GenericEditPage";
import { GenericListPage } from "./pages/GenericListPage";

export const courseSchemaRouteObjects: RouteObject[] = [
  {
    index: true,
    element: <Navigate to="list/Course" replace />,
  },
  {
    path: "create/:typeName",
    element: <GenericCreatePage />,
  },
  {
    path: "list/:typeName",
    element: <GenericListPage />,
  },
  {
    path: "edit/:typeName/:entityID",
    element: <GenericEditPage />,
  },
  {
    path: "detail/:typeName/:entityID",
    element: <GenericDetailPage />,
  },
];
