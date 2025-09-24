import {
  MenuGroup,
  NavGroup,
  NavItem,
} from "@graviola/edb-advanced-components";
import { encodeIRI } from "@graviola/edb-core-utils";
import { useAdbContext, useModifiedRouter } from "@graviola/edb-state-hooks";
import { ImportExport, Settings } from "@mui/icons-material";
import { Divider, List, Toolbar, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "next-i18next";
import React, { useCallback, useMemo } from "react";

import SettingsModal from "../../content/settings/SettingsModal";
import { useLocalSettings } from "../../state";
import { useGlobalAuth } from "../../state/useGlobalAuth";
import { createMenuListFromSchema } from "./createMenuListFromSchema";
import { Drawer } from "./menu";

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

const ImportSection = ({ open }) => {
  const { t } = useTranslation();
  const router = useModifiedRouter();
  const openImport = useCallback(() => {
    router.push("/import");
  }, [router]);

  return (
    <List>
      <NavItem
        key={"import"}
        item={{
          id: "import",
          type: "item",
          icon: () => <ImportExport />,
          title: t("import"),
        }}
        onClick={openImport}
        level={0}
        open={open}
      />
    </List>
  );
};

const Options = ({ open }) => {
  const { t } = useTranslation();
  const { openSettings } = useLocalSettings();

  return (
    <List>
      <NavItem
        key={"settings"}
        item={{
          id: "settings",
          url: "#",
          type: "item",
          icon: () => <Settings />,
          title: t("settings"),
        }}
        level={0}
        onClick={openSettings}
        open={open}
      />
      <SettingsModal />
    </List>
  );
};

const Navigation = ({ open, onCreateClicked, onListClicked }) => {
  const { t } = useTranslation();
  const { getPermission } = useGlobalAuth();
  const { schema } = useAdbContext();
  const menuGroup = useMemo<MenuGroup | null>(() => {
    return schema ? createMenuListFromSchema(schema, getPermission, t) : null;
  }, [schema, getPermission, t]);
  return (
    menuGroup && (
      <>
        <NavGroup
          key={menuGroup.id}
          item={menuGroup}
          onCreateClicked={onCreateClicked}
          onListClicked={onListClicked}
        />
      </>
    )
  );
};

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const theme = useTheme();
  const matchUpMd = useMediaQuery(theme.breakpoints.up("md"));
  const { push } = useModifiedRouter();
  const { createEntityIRI } = useAdbContext();

  const handleCreateClicked = useCallback(
    (typeName: string) => {
      const newEncodedURI = encodeIRI(createEntityIRI(typeName));
      push(`/create/${typeName}?encID=${newEncodedURI}`);
    },
    [push, createEntityIRI],
  );

  const handleListClicked = useCallback(
    (typeName: string) => {
      push(`/list/${typeName}`);
    },
    [push],
  );

  return (
    <Drawer
      //container={container}
      variant="permanent"
      anchor="left"
      open={open}
      ModalProps={{ keepMounted: true }}
      color="inherit"
    >
      <Toolbar />
      <Navigation
        open={open}
        onCreateClicked={handleCreateClicked}
        onListClicked={handleListClicked}
      />
      <Options open={open} />
      <Divider />
    </Drawer>
  );
};
