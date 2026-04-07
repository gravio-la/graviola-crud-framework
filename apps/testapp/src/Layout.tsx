import HomeIcon from "@mui/icons-material/Home";
import MenuIcon from "@mui/icons-material/Menu";
import {
  createMenuFromSchema,
  NavGroup,
} from "@graviola/edb-advanced-components";
import type { MenuUISchema } from "@graviola/edb-advanced-components";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@mui/material";
import type { JSONSchema7 } from "json-schema";
import type { SchemaConfig, SchemaIcon } from "./schemaTypes";
import { useCallback, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import type { SchemaRouteOutletContext } from "./schemaOutletContext";

const drawerWidth = 280;

function renderSchemaIcon(icon: SchemaIcon | undefined, size = "1.1rem") {
  if (!icon) return null;
  if (typeof icon === "string") {
    return (
      <Box component="span" sx={{ fontSize: size, mr: 0.5, lineHeight: 1 }}>
        {icon}
      </Box>
    );
  }
  const Cmp = icon;
  return <Cmp stroke={1.5} size={size} />;
}

type LayoutProps = {
  allSchemas: SchemaConfig[];
  currentSchema: SchemaConfig;
};

export function Layout({ allSchemas, currentSchema }: LayoutProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showSidebar =
    currentSchema.schemaName === "item-schema" ||
    currentSchema.schemaName === "course-schema";

  const itemMenuGroup = useMemo(() => {
    if (!showSidebar) return null;
    const schema = currentSchema.schema as JSONSchema7;
    const definitions = schema.definitions ?? {};
    const hiddenDefinitions = Object.keys(definitions).filter(
      (k) => !(k in currentSchema.typeNameLabelMap),
    );
    const menuUiSchema: MenuUISchema = {};
    for (const [typeName, label] of Object.entries(
      currentSchema.typeNameLabelMap,
    )) {
      menuUiSchema[typeName] = {
        title: label,
        editable: true,
      };
    }
    return createMenuFromSchema(schema, menuUiSchema, {
      hiddenDefinitions,
      defaultConfig: { editable: true },
    });
  }, [currentSchema, showSidebar]);

  const basePath = `/${currentSchema.schemaName}`;
  const handleListClicked = useCallback(
    (typeName: string) => {
      navigate(`${basePath}/list/${typeName}`);
      setMobileOpen(false);
    },
    [basePath, navigate],
  );
  const handleCreateClicked = useCallback(
    (typeName: string) => {
      navigate(`${basePath}/create/${typeName}`);
      setMobileOpen(false);
    },
    [basePath, navigate],
  );

  const handleTabChange = (_: React.SyntheticEvent, schemaName: string) => {
    navigate(`/${schemaName}`);
  };

  const outletContext: SchemaRouteOutletContext = {
    schemaConfig: currentSchema,
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Sticky AppBar — takes its natural height, no offset calculations needed */}
      <AppBar
        position="sticky"
        sx={{ flexShrink: 0, zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar variant="dense">
          {showSidebar ? (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1, display: { sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <IconButton
            component={Link}
            to="/"
            color="inherit"
            edge="start"
            sx={{ mr: 1 }}
            aria-label="Home"
          >
            <HomeIcon />
          </IconButton>
          {renderSchemaIcon(currentSchema.icon)}
          <Typography variant="h6" noWrap sx={{ flexGrow: 0, mr: 2 }}>
            {currentSchema.label}
          </Typography>
          <Tabs
            value={currentSchema.schemaName}
            onChange={handleTabChange}
            textColor="inherit"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ ml: "auto", minHeight: 48 }}
          >
            {allSchemas.map((s) => (
              <Tab
                key={s.schemaName}
                value={s.schemaName}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {renderSchemaIcon(s.icon, "1rem")}
                    <span>{s.label}</span>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Content row: sidebar + main — fills all remaining height */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {showSidebar && itemMenuGroup ? (
          <Box
            component="nav"
            sx={{
              width: { xs: 0, sm: drawerWidth },
              flexShrink: 0,
              display: { xs: "none", sm: "flex" },
              flexDirection: "column",
              borderRight: 1,
              borderColor: "divider",
              overflow: "auto",
            }}
          >
            <NavGroup
              item={itemMenuGroup}
              onListClicked={handleListClicked}
              onCreateClicked={handleCreateClicked}
            />
          </Box>
        ) : null}

        {/* Mobile drawer — only renders on xs */}
        {showSidebar && itemMenuGroup ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ display: { xs: "block", sm: "none" } }}
          >
            <Divider />
            <Box sx={{ overflow: "auto" }}>
              <NavGroup
                item={itemMenuGroup}
                onListClicked={handleListClicked}
                onCreateClicked={handleCreateClicked}
              />
            </Box>
          </Drawer>
        ) : null}

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Outlet context={outletContext} />
        </Box>
      </Box>
    </Box>
  );
}
