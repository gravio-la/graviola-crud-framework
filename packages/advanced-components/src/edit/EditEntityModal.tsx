import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useAdbContext, useTypeIRIFromEntity } from "@graviola/edb-state-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCRUDWithQueryClient,
  useExtendedSchema,
} from "@graviola/edb-state-hooks";
import { useTranslation } from "next-i18next";
import {
  Button,
  Stack,
  CircularProgress,
  Box,
  Typography,
  Badge,
  Tooltip,
} from "@mui/material";
import type { JSONSchema7 } from "json-schema";
import type { ErrorObject } from "ajv";
import { useFormDataStore } from "@graviola/edb-state-hooks";
import type { PrimaryFieldResults } from "@graviola/edb-core-types";
import { cleanJSONLD } from "@graviola/jsonld-utils";
import { MuiEditDialog } from "@graviola/edb-basic-components";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import type { EditEntityModalProps } from "@graviola/semantic-jsonform-types";

// Component that handles the loaded state with all the form logic
const EditEntityModalContent = ({
  classIRI,
  entityIRI,
  typeIRI,
  defaultData,
  disableLoad,
  modal,
}: {
  classIRI: string;
  entityIRI: string;
  typeIRI?: string;
  defaultData?: any;
  disableLoad?: boolean;
  modal: ReturnType<typeof useModal>;
}) => {
  const {
    jsonLDConfig,
    typeIRIToTypeName,
    queryBuildOptions: { primaryFieldExtracts },
    uischemata,
    components: { SemanticJsonForm },
    useSnackbar,
  } = useAdbContext();
  const { t } = useTranslation();

  const typeName = useMemo(
    () => typeIRIToTypeName(classIRI),
    [classIRI, typeIRIToTypeName],
  );
  const loadedSchema = useExtendedSchema({ typeName });
  const { loadQuery, saveMutation } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI: classIRI,
    schema: loadedSchema,
    queryOptions: {
      enabled: !disableLoad,
      refetchOnWindowFocus: true,
      initialData: defaultData ? { document: defaultData } : undefined,
    },
    loadQueryKey: "show",
  });

  const [firstTimeSaved, setFirstTimeSaved] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const data = loadQuery.data?.document || defaultData;

  const cardInfo = useMemo<PrimaryFieldResults<string>>(() => {
    const fieldDecl = primaryFieldExtracts[typeName];
    if (data && fieldDecl)
      return applyToEachField(data, fieldDecl, extractFieldIfString);
    return {
      label: null,
      description: null,
      image: null,
    };
  }, [typeName, data, primaryFieldExtracts]);

  const { formData, setFormData } = useFormDataStore({
    entityIRI,
    typeIRI,
  });

  useEffect(() => {
    setFormData(data);
  }, [data, setFormData]);

  const uischema = useMemo(() => uischemata?.[typeName], [typeName]);
  const { enqueueSnackbar } = useSnackbar();

  const handleSaveSuccess = useCallback(() => {
    setFirstTimeSaved(true);
    setIsStale(false);
  }, [setFirstTimeSaved, setIsStale]);

  const handleSave = useCallback(
    async (saveSuccess?: () => void) => {
      saveMutation
        .mutateAsync(formData)
        .then(async (skipLoading?: boolean) => {
          enqueueSnackbar("Saved", { variant: "success" });
          !skipLoading && (await loadQuery.refetch());
          handleSaveSuccess();
          typeof saveSuccess === "function" && saveSuccess();
        })
        .catch((e) => {
          enqueueSnackbar("Error while saving " + e.message, {
            variant: "error",
          });
        });
    },
    [enqueueSnackbar, saveMutation, loadQuery, formData, handleSaveSuccess],
  );

  const handleAccept = useCallback(() => {
    const acceptCallback = async () => {
      let cleanedData = await cleanJSONLD(formData, loadedSchema, {
        jsonldContext: jsonLDConfig.jsonldContext,
        defaultPrefix: jsonLDConfig.defaultPrefix,
        keepContext: false,
      });
      modal.resolve({
        entityIRI: formData["@id"],
        data: cleanedData,
      });
      modal.remove();
    };
    return handleSave(acceptCallback);
  }, [formData, loadedSchema, handleSave, modal, jsonLDConfig]);

  const handleFormDataChange = useCallback(
    async (data: any) => {
      setFormData(data);
      setIsStale(true);
    },
    [setIsStale, setFormData],
  );

  const handleClose = useCallback(() => {
    modal.reject();
    modal.remove();
  }, [modal]);

  const [errors, setErrors] = useState<ErrorObject[]>([]);
  const hasErrors = useMemo(() => errors.length > 0, [errors]);

  const handleError = useCallback(
    (errors: ErrorObject[]) => {
      setErrors(errors);
    },
    [setErrors],
  );

  const errorTooltipContent = useMemo(() => {
    if (errors.length === 0) return "";
    return errors
      .map((error) => {
        const path = error.instancePath || error.schemaPath || "root";
        const message = error.message || "Unknown error";
        return `${path}: ${message}`;
      })
      .join("\n");
  }, [errors]);

  const ErrorBadgedAcceptButton = () => {
    const acceptButton = (
      <Button onClick={handleAccept} disabled={hasErrors} variant="contained">
        {isStale || !firstTimeSaved ? t("save and accept") : t("accept")}
      </Button>
    );

    if (!hasErrors) return acceptButton;

    return (
      <Tooltip
        title={
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {errorTooltipContent}
          </pre>
        }
        placement="top"
        arrow
      >
        <Badge badgeContent={errors.length} color="error">
          {acceptButton}
        </Badge>
      </Tooltip>
    );
  };

  return (
    <MuiEditDialog
      open={modal.visible}
      onClose={handleClose}
      onSave={hasErrors ? undefined : handleSave}
      title={cardInfo.label}
      editMode={true}
      actions={
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={handleClose} color="error">
            {t("cancel")}
          </Button>
          <ErrorBadgedAcceptButton />
        </Stack>
      }
    >
      <SemanticJsonForm
        data={formData}
        onChange={handleFormDataChange}
        typeIRI={typeIRI}
        defaultEditMode={true}
        searchText={""}
        schema={loadedSchema as JSONSchema7}
        formsPath={"root"}
        onError={handleError}
        jsonFormsProps={{
          uischema,
        }}
        enableSidebar={false}
        disableSimilarityFinder={true}
        wrapWithinCard={false}
      />
    </MuiEditDialog>
  );
};

// Main modal component that handles loading state
export const EditEntityModal = NiceModal.create(
  ({
    typeIRI,
    entityIRI,
    data: defaultData,
    disableLoad,
  }: EditEntityModalProps) => {
    const modal = useModal();
    const { t } = useTranslation();
    const classIRI = useTypeIRIFromEntity(entityIRI, typeIRI, disableLoad) as
      | string
      | undefined;

    const handleClose = useCallback(() => {
      modal.reject();
      modal.remove();
    }, [modal]);

    // Show loading screen while classIRI is being resolved
    if (!classIRI) {
      return (
        <MuiEditDialog
          open={modal.visible}
          onClose={handleClose}
          title={t("Loading...")}
          editMode={false}
          actions={
            <Button onClick={handleClose} color="error">
              {t("cancel")}
            </Button>
          }
        >
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight={200}
            gap={2}
          >
            <CircularProgress size={40} />
            <Typography variant="body1" color="text.secondary">
              {t("Loading entity class information...")}
            </Typography>
          </Box>
        </MuiEditDialog>
      );
    }

    // Render the actual modal content once classIRI is available
    return (
      <EditEntityModalContent
        classIRI={classIRI}
        entityIRI={entityIRI}
        typeIRI={typeIRI}
        defaultData={defaultData}
        disableLoad={disableLoad}
        modal={modal}
      />
    );
  },
);
