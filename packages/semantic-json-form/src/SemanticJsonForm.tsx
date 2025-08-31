import NiceModal from "@ebay/nice-modal-react";
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAdbContext,
  useCRUDWithQueryClient,
  useQueryKeyResolver,
} from "@graviola/edb-state-hooks";
import { SemanticJsonFormToolbar } from "./SemanticJsonFormToolbar";
import { Backdrop, Box, CircularProgress } from "@mui/material";
import { useTranslation } from "next-i18next";
import { GenericModal } from "@graviola/edb-basic-components";
import type {
  ChangeCause,
  SemanticJsonFormProps,
  LoadResult,
} from "@graviola/semantic-jsonform-types";

export const SemanticJsonForm: FunctionComponent<SemanticJsonFormProps> = ({
  entityIRI,
  data,
  onChange,
  shouldLoadInitially,
  typeIRI,
  schema,
  jsonldContext,
  jsonFormsProps,
  hideToolbar,
  forceEditMode,
  defaultEditMode,
  toolbarChildren,
  defaultPrefix,
  ...rest
}) => {
  const { t } = useTranslation();
  const [managedEditMode, setEditMode] = useState(defaultEditMode || false);
  const editMode = useMemo(
    () =>
      (typeof forceEditMode !== "boolean" && managedEditMode) || forceEditMode,
    [managedEditMode, forceEditMode],
  );

  const {
    components: { EntityDetailModal, SemanticJsonForm },
    useSnackbar,
  } = useAdbContext();
  const { enqueueSnackbar } = useSnackbar();

  const { saveMutation, removeMutation, loadEntity } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI,
    schema,
    queryOptions: { enabled: true },
    loadQueryKey: "rootLoad",
  });

  const { updateSourceToTargets, removeSource } = useQueryKeyResolver();
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const isLoading = useMemo(
    () => saveMutation.isPending || isSaving || isReloading,
    [saveMutation.isPending, isSaving, isReloading],
  );

  const refetch = useCallback(() => {
    return loadEntity(entityIRI, typeIRI).then(
      (loadResult: LoadResult | null) => {
        if (loadResult !== null && loadResult?.document) {
          const data = loadResult.document;
          updateSourceToTargets(entityIRI, loadResult.subjects);
          onChange(data);
        }
      },
    );
  }, [loadEntity, entityIRI, typeIRI, schema, onChange, updateSourceToTargets]);

  useEffect(() => {
    return () => {
      removeSource(entityIRI);
    };
  }, [entityIRI, removeSource]);

  const [initialFetchKey, setInitialFetchKey] = useState<string | null>(null);
  const fetchKey = useMemo(
    () => `${entityIRI}-${typeIRI}`,
    [entityIRI, typeIRI],
  );
  const [initiallyLoaded, setInitiallyLoaded] = useState(false);
  useEffect(() => {
    if (!entityIRI || !typeIRI) return;
    if (initialFetchKey === fetchKey) return;
    setInitiallyLoaded(false);
    setInitialFetchKey(fetchKey);
    refetch().finally(() => {
      setInitiallyLoaded(true);
    });
  }, [
    entityIRI,
    typeIRI,
    refetch,
    fetchKey,
    initialFetchKey,
    setInitialFetchKey,
  ]);

  const handleReset = useCallback(() => {
    NiceModal.show(GenericModal, {
      type: "reset",
    }).then(() => {
      onChange({});
    });
  }, [onChange]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    saveMutation
      .mutateAsync(data)
      .then(async ({ mainDocument }) => {
        //TODO should we clear and refetch? or just refetch?
        if (entityIRI) {
          loadEntity(entityIRI, typeIRI)
            .then((data) => {
              if (data?.document) {
                return onChange(data.document);
              }
            })
            .finally(() => {
              enqueueSnackbar("Saved", { variant: "success" });
              setIsSaving(false);
            });
        } else {
          onChange(mainDocument);
          enqueueSnackbar("Created", { variant: "success" });
          setIsSaving(false);
        }
      })
      .catch((e) => {
        setIsSaving(false);
        enqueueSnackbar("Error while saving " + e.message, {
          variant: "error",
        });
      });
  }, [
    setIsSaving,
    enqueueSnackbar,
    saveMutation,
    data,
    onChange,
    loadEntity,
    typeIRI,
    entityIRI,
  ]);

  const handleRemove = useCallback(async () => {
    NiceModal.show(GenericModal, {
      type: "delete",
    }).then(() => {
      removeMutation.mutate();
    });
  }, [removeMutation]);

  const handleReload = useCallback(async () => {
    NiceModal.show(GenericModal, {
      type: "reload",
    }).then(() => {
      setIsReloading(true);
      onChange({});
      refetch()
        .then(() => {
          enqueueSnackbar(t("reloaded"), { variant: "success" });
        })
        .catch((error) => {
          enqueueSnackbar(t("reload_failed") + ": " + error.message, {
            variant: "error",
          });
        })
        .finally(() => {
          setIsReloading(false);
        });
    });
  }, [refetch, onChange, setIsReloading, enqueueSnackbar, t]);

  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, [setEditMode]);

  const handleShowEntry = useCallback(() => {
    NiceModal.show(EntityDetailModal, {
      typeIRI,
      entityIRI: entityIRI,
      readonly: true,
    });
  }, [typeIRI, entityIRI, EntityDetailModal]);

  const handleOnChange = useCallback(
    (data: any, reason: ChangeCause) => {
      if (
        (reason === "user" && editMode && !isLoading) ||
        (reason === "mapping" && !isLoading) ||
        (reason === "reload" && isReloading)
      ) {
        onChange(data);
      }
    },
    [onChange, editMode, isLoading, isReloading],
  );

  const jsonFormsPropsFinal = useMemo(
    () => ({
      readonly: !editMode || (shouldLoadInitially && !initiallyLoaded),
      ...(jsonFormsProps || {}),
    }),
    [editMode, initiallyLoaded, jsonFormsProps],
  );

  return (
    <Box sx={{ minHeight: "100%", width: "100%" }}>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isLoading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <SemanticJsonForm
        typeIRI={typeIRI}
        data={data}
        onChange={handleOnChange}
        schema={schema}
        formsPath="root"
        jsonFormsProps={jsonFormsPropsFinal}
        toolbar={
          !hideToolbar && (
            <SemanticJsonFormToolbar
              editMode={editMode}
              onEditModeToggle={handleToggleEditMode}
              onReset={handleReset}
              onSave={handleSave}
              onRemove={entityIRI ? handleRemove : undefined}
              onReload={entityIRI ? handleReload : undefined}
              onShow={entityIRI ? handleShowEntry : undefined}
            >
              {toolbarChildren}
            </SemanticJsonFormToolbar>
          )
        }
        {...rest}
      />
    </Box>
  );
};
