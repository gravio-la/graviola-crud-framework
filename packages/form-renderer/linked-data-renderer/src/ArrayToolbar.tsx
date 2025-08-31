import NiceModal from "@ebay/nice-modal-react";
import { DiscoverAutocompleteInput } from "@graviola/edb-advanced-components";
import { SearchbarWithFloatingButton } from "@graviola/edb-basic-components";
import { AutocompleteSuggestion } from "@graviola/edb-core-types";
import { PrimaryField } from "@graviola/edb-core-types";
import {
  useAdbContext,
  useGlobalSearchWithHelper,
  useKeyEventForSimilarityFinder,
  useModalRegistry,
  useRightDrawerState,
} from "@graviola/edb-state-hooks";
import { KnowledgeSources } from "@graviola/semantic-jsonform-types";
import { JsonSchema7 } from "@jsonforms/core";
import {
  Box,
  Button,
  FormControl,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { JSONSchema7 } from "json-schema";
import { useTranslation } from "next-i18next";
import * as React from "react";
import { useCallback, useMemo } from "react";
import { HowManyItemsModal } from "./HowManyItemsModal";
import trim from "lodash-es/trim";
import cloneDeep from "lodash-es/cloneDeep";

export interface ArrayLayoutToolbarProps {
  label: string;
  errors: string;
  path: string;

  enabled?: boolean;

  labelAsHeadline?: boolean;

  addItem(path: string, data: any): () => void;

  createDefault(): any;

  typeIRI?: string;
  isReifiedStatement?: boolean;
  additionalKnowledgeSources?: string[];

  showCreateButton?: boolean;
  allowCreateMultiple?: boolean;

  prepareNewEntityData?: (newDataStub: any) => Promise<any>;
}

export const ArrayLayoutToolbar = ({
  label,
  labelAsHeadline,
  errors,
  addItem,
  enabled,
  path,
  schema,
  isReifiedStatement,
  formsPath,
  additionalKnowledgeSources,
  typeIRI: _typeIRI,
  dropdown,
  showCreateButton,
  allowCreateMultiple,
  prepareNewEntityData,
}: ArrayLayoutToolbarProps & {
  schema?: JsonSchema7;
  formsPath?: string;
  dropdown?: boolean;
}) => {
  const {
    createEntityIRI,
    queryBuildOptions: { primaryFields },
    typeIRIToTypeName,
    components: { SimilarityFinder, EditEntityModal },
  } = useAdbContext();
  const typeIRI = useMemo(
    () => _typeIRI ?? schema?.properties?.["@type"]?.const,
    [schema, _typeIRI],
  );
  const typeName = useMemo(
    () => typeIRIToTypeName(typeIRI),
    [typeIRI, typeIRIToTypeName],
  );
  const handleSelectedChange = React.useCallback(
    (v: AutocompleteSuggestion) => {
      if (!v || !v.value) return;
      addItem(path, {
        "@id": v.value,
        "@type": typeIRI,
        __label: v.label,
      })();
    },
    [addItem, path],
  );

  const handleExistingEntityAccepted = useCallback(
    (iri: string, data: any) => {
      addItem(path, data)();
      handleSelectedChange({ value: undefined, label: "" });
      inputRef.current?.focus();
    },
    [addItem, path, handleSelectedChange],
  );

  const handleMappedDataAccepted = useCallback(
    (newData: any) => {
      addItem(path, newData)();
      inputRef.current?.focus();
    },
    [addItem, path],
  );

  const { open: sidebarOpen } = useRightDrawerState();

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const {
    path: globalPath,
    searchString,
    handleSearchStringChange,
    handleMappedData,
    handleFocus,
    isActive,
  } = useGlobalSearchWithHelper(
    typeName,
    typeIRI,
    schema as JSONSchema7,
    formsPath,
    handleMappedDataAccepted,
  );

  const handleKeyUp = useKeyEventForSimilarityFinder();
  const { keepMounted } = useRightDrawerState();

  const [disabled, setDisabled] = React.useState(false);
  const { registerModal } = useModalRegistry(NiceModal);
  const showEditDialog = useCallback(async () => {
    const fieldDefinitions = primaryFields[typeName] as
      | PrimaryField
      | undefined;
    const defaultLabelKey = fieldDefinitions?.label || "title";
    const entityIRI = createEntityIRI(typeName);
    const modalID = `edit-${typeIRI}-${entityIRI}`;
    registerModal(modalID, EditEntityModal);
    const newItem = {
      "@id": entityIRI,
      "@type": typeIRI,
    };
    if (searchString && trim(searchString).length > 0) {
      newItem[defaultLabelKey] = searchString;
    }
    const preparedData = prepareNewEntityData
      ? await prepareNewEntityData(newItem)
      : newItem;
    setDisabled(true);
    NiceModal.show(modalID, {
      entityIRI,
      typeIRI,
      data: preparedData,
      disableLoad: true,
    })
      .then(({ data }: { data: any }) => {
        if (data["@id"] && data["@type"]) {
          addItem(path, cloneDeep(data))();
        }
      })
      .finally(() => {
        setDisabled(false);
      });
  }, [
    registerModal,
    typeIRI,
    typeName,
    createEntityIRI,
    EditEntityModal,
    primaryFields,
    searchString,
    setDisabled,
    prepareNewEntityData,
  ]);

  const createAndAddItem = useCallback(async () => {
    const newItem = {
      "@id": createEntityIRI(typeName),
      "@type": typeIRI,
      __draft: true,
    };
    const preparedData = prepareNewEntityData
      ? await prepareNewEntityData(newItem)
      : newItem;
    addItem(path, preparedData)();
  }, [prepareNewEntityData, createEntityIRI, typeIRI, typeName, searchString]);

  const handleCreateButtonClick = useCallback(() => {
    if (allowCreateMultiple) {
      NiceModal.show(HowManyItemsModal, {
        entityType: typeName,
      }).then(async (n: number) => {
        for (let i: number = 0; i < n; i++) {
          await createAndAddItem();
        }
      });
    } else {
      createAndAddItem();
    }
  }, [allowCreateMultiple, typeName, createAndAddItem]);

  const { t } = useTranslation();

  return (
    <Box>
      {(isReifiedStatement || labelAsHeadline) && (
        <Box>
          <Typography variant={"h4"}>{label}</Typography>
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          marginTop: (theme) =>
            theme.spacing(
              !dropdown && (keepMounted || sidebarOpen) && !isReifiedStatement
                ? 1
                : 2,
            ),
          marginBottom: (theme) => theme.spacing(1),
        }}
      >
        {!dropdown && (keepMounted || sidebarOpen) && !isReifiedStatement ? (
          <TextField
            fullWidth
            disabled={!enabled}
            label={labelAsHeadline ? typeName : label}
            onChange={(ev) => handleSearchStringChange(ev.target.value)}
            value={searchString || ""}
            inputProps={{
              ref: inputRef,
              onFocus: handleFocus,
              onKeyUp: handleKeyUp,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderTopRightRadius: showCreateButton ? 0 : undefined,
                borderBottomRightRadius: showCreateButton ? 0 : undefined,
              },
            }}
          />
        ) : (
          !isReifiedStatement && (
            <FormControl fullWidth>
              <DiscoverAutocompleteInput
                onCreateNew={showEditDialog}
                loadOnStart={true}
                readonly={!enabled}
                typeIRI={typeIRI}
                typeName={typeName || ""}
                title={label || ""}
                disabled={disabled}
                onSelectionChange={handleSelectedChange}
                onSearchValueChange={handleSearchStringChange}
                searchString={searchString || ""}
                inputProps={{
                  onFocus: handleFocus,
                  sx: {
                    "& .MuiOutlinedInput-root": {
                      borderTopRightRadius: showCreateButton ? 0 : undefined,
                      borderBottomRightRadius: showCreateButton ? 0 : undefined,
                    },
                  },
                }}
              />
            </FormControl>
          )
        )}
        {showCreateButton && (
          <Tooltip title={t("arrayToolbar.createMultiple", { typeName })}>
            <Button
              onClick={handleCreateButtonClick}
              disabled={!enabled}
              variant="outlined"
              sx={{
                minWidth: "auto",
                px: 1.5,
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderLeft: 0,
                "&:hover": {
                  borderLeft: 0,
                },
              }}
            >
              <AddIcon />
            </Button>
          </Tooltip>
        )}
      </Box>
      <Box>
        {globalPath === formsPath && !dropdown && (
          <SearchbarWithFloatingButton>
            <SimilarityFinder
              finderId={`${formsPath}_${path}`}
              search={searchString}
              data={{}}
              classIRI={typeIRI}
              jsonSchema={schema as JSONSchema7}
              onExistingEntityAccepted={handleExistingEntityAccepted}
              onMappedDataAccepted={handleMappedData}
              additionalKnowledgeSources={
                additionalKnowledgeSources as KnowledgeSources[]
              }
              prepareNewEntityData={prepareNewEntityData}
            />
          </SearchbarWithFloatingButton>
        )}
      </Box>
    </Box>
  );
};
