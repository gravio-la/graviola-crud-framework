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
import { useTypeIRIFromEntity } from "@graviola/edb-state-hooks";
import { EntityDetailModalProps } from "@graviola/semantic-jsonform-types";
import { Close as CloseIcon, Edit } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Theme,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTranslation } from "next-i18next";
import { FC, useCallback, useMemo } from "react";

import { EntityDetailCard } from "./EntityDetailCard";

/**
 * Skeleton component for the EntityDetailCard to show while loading
 */
const EntityDetailCardSkeleton: FC<{
  message?: string;
}> = ({ message }) => {
  return (
    <>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="70%" height={40} />
          <Skeleton variant="text" width="50%" />
        </CardContent>
      </Card>
      <Box sx={{ mt: 2, position: "relative" }}>
        <TableContainer>
          <Table sx={{ minWidth: "100%", tableLayout: "fixed" }}>
            <TableBody>
              {[...Array(6)].map((_, index) => (
                <TableRow key={index}>
                  <TableCell style={{ width: "20%" }}>
                    <Skeleton variant="text" width="80%" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" width="100%" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {message && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              gap: 1,
              opacity: 0.7,
            }}
          >
            <CircularProgress size={16} />
            {message}
          </Typography>
        )}
      </Box>
    </>
  );
};

/**
 * Dialog wrapper with loading skeleton
 */
const LoadingDialog: FC<{
  message: string;
  onClose: () => void;
}> = ({ message, onClose }) => {
  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent>
        <EntityDetailCardSkeleton message={message} />
      </DialogContent>
    </Dialog>
  );
};

/**
 * Inner component that displays the entity details when data is available
 */
const EntityDetailContent: FC<{
  classIRI: string;
  entityIRI: string;
  data: any;
  cardInfo: PrimaryFieldResults<string>;
  readonly?: boolean;
  disabledProperties: string[];
  handleEdit: () => void;
  handleClose: () => void;
  disableInlineEditing?: boolean;
}> = ({
  classIRI,
  entityIRI,
  data,
  cardInfo,
  readonly,
  disabledProperties,
  handleEdit,
  handleClose,
  disableInlineEditing,
}) => {
  const { t } = useTranslation();
  const xsDown = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={true}
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
};

/**
 * Inner wrapper component that waits for data or immediately displays it if defaultData is set
 */
const EntityDetailDataWrapper: FC<{
  classIRI: string;
  entityIRI: string;
  typeIRI: string;
  typeName: string;
  defaultData?: any;
  disableLoad?: boolean;
  readonly?: boolean;
  disableInlineEditing?: boolean;
  onClose: () => void;
}> = ({
  classIRI,
  entityIRI,
  typeIRI,
  typeName,
  defaultData,
  disableLoad,
  readonly,
  disableInlineEditing,
  onClose,
}) => {
  const {
    queryBuildOptions: { primaryFields },
    components: { EditEntityModal },
  } = useAdbContext();
  const { t } = useTranslation();

  // Load schema and data
  const {
    loadQuery: { data: rawData },
  } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI: classIRI,
    queryOptions: {
      enabled: !disableLoad,
      refetchOnWindowFocus: true,
      initialData: defaultData,
    },
    loadQueryKey: "show",
  });

  const data = rawData?.document || defaultData;

  // Setup edit functionality
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
      push(`/create/${typeName}?encID=${encodeIRI(entityIRI)}`);
    }
  }, [
    typeIRI,
    entityIRI,
    disableInlineEditing,
    typeName,
    registerModal,
    data,
    EditEntityModal,
    push,
  ]);

  // Prepare card info and disabled properties
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

  // Show loading state if data is not available yet
  if (!data) {
    return <LoadingDialog message={t("loading entity")} onClose={onClose} />;
  }

  // Render the content when data is available
  return (
    <EntityDetailContent
      classIRI={classIRI}
      entityIRI={entityIRI}
      data={data}
      cardInfo={cardInfo}
      readonly={readonly}
      disabledProperties={disabledProperties}
      handleEdit={handleEdit}
      handleClose={onClose}
      disableInlineEditing={disableInlineEditing}
    />
  );
};

/**
 * Middle wrapper component that waits for classIRI
 */
const EntityDetailClassWrapper: FC<{
  typeIRI: string;
  entityIRI: string;
  defaultData?: any;
  disableLoad?: boolean;
  readonly?: boolean;
  disableInlineEditing?: boolean;
  onClose: () => void;
}> = ({
  typeIRI,
  entityIRI,
  defaultData,
  disableLoad,
  readonly,
  disableInlineEditing,
  onClose,
}) => {
  const { typeIRIToTypeName } = useAdbContext();
  const { t } = useTranslation();

  // Get class IRI
  const classIRI = useTypeIRIFromEntity(entityIRI, typeIRI, disableLoad);

  // Show loading state if classIRI is not available yet
  if (!classIRI) {
    return (
      <LoadingDialog
        message={t("loading type information")}
        onClose={onClose}
      />
    );
  }

  // Get type name when classIRI is available
  const typeName = typeIRIToTypeName(classIRI);

  // Render the data wrapper when classIRI is available
  return (
    <EntityDetailDataWrapper
      classIRI={classIRI}
      entityIRI={entityIRI}
      typeIRI={typeIRI}
      typeName={typeName}
      defaultData={defaultData}
      disableLoad={disableLoad}
      readonly={readonly}
      disableInlineEditing={disableInlineEditing}
      onClose={onClose}
    />
  );
};

/**
 * Outer component created with NiceModal.create
 */
export const EntityDetailModal = NiceModal.create(
  ({
    typeIRI,
    entityIRI,
    data: defaultData,
    disableLoad,
    readonly,
    disableInlineEditing,
  }: EntityDetailModalProps) => {
    const modal = useModal();

    const handleClose = useCallback(() => {
      modal.reject();
      modal.remove();
    }, [modal]);

    if (!modal.visible) {
      return null;
    }

    return (
      <EntityDetailClassWrapper
        typeIRI={typeIRI}
        entityIRI={entityIRI}
        defaultData={defaultData}
        disableLoad={disableLoad}
        readonly={readonly}
        disableInlineEditing={disableInlineEditing}
        onClose={handleClose}
      />
    );
  },
);
