import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { PrimaryField, PrimaryFieldResults } from "@graviola/edb-core-types";
import { encodeIRI, filterUndefOrNull } from "@graviola/edb-core-utils";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useCRUDWithQueryClient,
  useModalRegistry,
  useModifiedRouter,
} from "@graviola/edb-state-hooks";
import {
  useExtendedSchema,
  useTypeIRIFromEntity,
} from "@graviola/edb-state-hooks";
import { EntityDetailModalProps } from "@graviola/semantic-jsonform-types";
import { Close as CloseIcon, Edit } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Theme,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTranslation } from "next-i18next";
import { useCallback, useMemo, useState } from "react";

import { EntityDetailCard } from "./EntityDetailCard";

export const EntityDetailModal = NiceModal.create(
  ({
    typeIRI,
    entityIRI,
    data: defaultData,
    disableLoad,
    readonly,
    disableInlineEditing,
  }: EntityDetailModalProps) => {
    const {
      queryBuildOptions: { primaryFields },
      typeIRIToTypeName,
      components: { EditEntityModal },
    } = useAdbContext();
    const modal = useModal();

    const handleClose = useCallback(() => {
      modal.reject();
      modal.remove();
    }, [modal]);

    const classIRI = useTypeIRIFromEntity(entityIRI, typeIRI, disableLoad);
    const typeName = useMemo(
      () => typeIRIToTypeName(classIRI),
      [classIRI, typeIRIToTypeName],
    );
    const loadedSchema = useExtendedSchema({ typeName });
    const {
      loadQuery: { data: rawData },
    } = useCRUDWithQueryClient({
      entityIRI,
      typeIRI: classIRI,
      schema: loadedSchema,
      queryOptions: {
        enabled: !disableLoad,
        refetchOnWindowFocus: true,
        initialData: defaultData,
      },
      loadQueryKey: "show",
    });
    const { t } = useTranslation();

    const data = rawData?.document || defaultData;

    const { push } = useModifiedRouter();
    const { registerModal } = useModalRegistry(NiceModal);
    const handleEdit = useCallback(() => {
      if (!disableInlineEditing) {
        const modalID = `edit-${typeIRI}-${entityIRI}`;
        registerModal(modalID, EditEntityModal);
        NiceModal.show(modalID, {
          entityIRI: entityIRI,
          typeIRI: typeIRI,
          data,
          disableLoad: true,
        }).catch((e) => {
          console.error(e);
        });
      } else {
        const typeName = typeIRIToTypeName(typeIRI);
        push(`/create/${typeName}?encID=${encodeIRI(entityIRI)}`);
      }
    }, [
      typeIRI,
      entityIRI,
      disableInlineEditing,
      typeIRIToTypeName,
      registerModal,
      data,
      EditEntityModal,
      push,
    ]);

    const cardInfo = useMemo<PrimaryFieldResults<string>>(() => {
      const fieldDecl = primaryFields[typeName];
      if (data && fieldDecl)
        return applyToEachField(data, fieldDecl, extractFieldIfString);
      return {
        label: null,
        description: null,
        image: null,
      };
    }, [typeName, data, primaryFields]);

    const fieldDeclaration = useMemo(
      () => primaryFields[typeName] as PrimaryField,
      [typeName, primaryFields],
    );
    const disabledProperties = useMemo(
      () => filterUndefOrNull(Object.values(fieldDeclaration || {})),
      [fieldDeclaration],
    );
    const xsDown = useMediaQuery((theme: Theme) =>
      theme.breakpoints.down("sm"),
    );
    return (
      <Dialog
        open={modal.visible}
        onClose={handleClose}
        scroll={"paper"}
        disableScrollLock={false}
        maxWidth={false}
        fullScreen={xsDown}
        disableEnforceFocus={true}
        sx={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppBar position="static">
          <Toolbar variant="dense">
            <Typography variant="h4" color="inherit" component="div">
              {cardInfo.label}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: "flex" }}>
              <IconButton
                size="large"
                aria-label={t("close")}
                onClick={handleClose}
                color="inherit"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <Box sx={{ flexGrow: 1, display: "flex" }}>
          {cardInfo.image && (
            <Box
              sx={{
                display: { xs: "none", md: "block" },
                minWidth: "200px",
                borderRight: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <Box
                component="img"
                src={cardInfo.image}
                alt={cardInfo.label || ""}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Box>
          )}
          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <DialogContent
              sx={{
                p: 0,
                position: "relative",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  overflow: "auto",
                  p: 2,
                }}
              >
                <EntityDetailCard
                  typeIRI={classIRI}
                  entityIRI={entityIRI}
                  data={data}
                  cardInfo={cardInfo}
                  readonly={readonly}
                  tableProps={{ disabledProperties }}
                  cardProps={{ elevation: 0 }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              {!readonly && (
                <Button
                  variant="outlined"
                  onClick={handleEdit}
                  startIcon={<Edit />}
                >
                  {!disableInlineEditing ? t("edit inline") : t("edit")}
                </Button>
              )}
              <Button onClick={handleClose} color="primary" variant="contained">
                {t("close")}
              </Button>
            </DialogActions>
          </Box>
        </Box>
      </Dialog>
    );
  },
);
