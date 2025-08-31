import NiceModal from "@ebay/nice-modal-react";
import {
  DiscoverAutocompleteInput,
  EntityDetailListItem,
} from "@graviola/edb-advanced-components";
import { SearchbarWithFloatingButton } from "@graviola/edb-basic-components";
import { AutocompleteSuggestion } from "@graviola/edb-core-types";
import { PrimaryField } from "@graviola/edb-core-types";
import { makeFormsPath } from "@graviola/edb-core-utils";
import { extractFieldIfString } from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useGlobalSearchWithHelper,
  useModalRegistry,
  useRightDrawerState,
} from "@graviola/edb-state-hooks";
import { hidden } from "@graviola/edb-ui-utils";
import {
  ControlProps,
  JsonSchema,
  Resolve,
  resolveSchema,
} from "@jsonforms/core";
import { useJsonForms, withJsonFormsControlProps } from "@jsonforms/react";
import {
  Box,
  FormControl,
  FormHelperText,
  List,
  Theme,
  Typography,
} from "@mui/material";
import { JSONSchema7 } from "json-schema";
import merge from "lodash-es/merge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormHelper } from "./formHelper";
import cloneDeep from "lodash-es/cloneDeep";

const InlineDropdownSemanticFormsRendererComponent = (props: ControlProps) => {
  const {
    id,
    errors,
    schema,
    uischema,
    visible,
    config,
    data,
    handleChange,
    path,
    rootSchema,
    label,
    enabled,
    description,
  } = props;
  const {
    typeIRIToTypeName,
    createEntityIRI,
    queryBuildOptions: { primaryFields },
    components: { SimilarityFinder, EditEntityModal },
  } = useAdbContext();
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const typeIRI =
    appliedUiSchemaOptions.context?.typeIRI ||
    schema.properties?.["@type"]?.const ||
    appliedUiSchemaOptions.typeIRI;
  const { $ref } = appliedUiSchemaOptions || {};
  const enableFinder = appliedUiSchemaOptions.enableFinder || false;
  const ctx = useJsonForms();
  const prepareNewEntityData =
    typeof appliedUiSchemaOptions.prepareNewEntityData === "function"
      ? appliedUiSchemaOptions.prepareNewEntityData
      : undefined;

  const prepareNewEntityDataFinal = useCallback(
    (stub: any) => {
      const _data =
        prepareNewEntityData && typeof prepareNewEntityData === "function"
          ? prepareNewEntityData(cloneDeep(ctx?.core?.data || {}))
          : {};
      return { ..._data, ...(stub || {}) };
    },
    [ctx?.core?.data, prepareNewEntityData],
  );

  const { registerModal } = useModalRegistry(NiceModal);
  const typeName = useMemo(
    () => typeIRI && typeIRIToTypeName(typeIRI),
    [typeIRI, typeIRIToTypeName],
  );
  const [realLabel, setRealLabel] = useState("");
  const formsPath = useMemo(
    () => makeFormsPath(config?.formsPath, path),
    [config?.formsPath, path],
  );
  const selected = useMemo(
    () =>
      data
        ? {
            value: path.endsWith("@id") ? data : data["@id"] || null,
            label: realLabel,
          }
        : { value: null, label: null },
    [data, realLabel, path],
  );
  const subSchema = useMemo(() => {
    if (!$ref) return;
    const schema2 = {
      ...schema,
      $ref,
    };
    const resolvedSchema = resolveSchema(
      schema2 as JsonSchema,
      "",
      rootSchema as JsonSchema,
    );
    return {
      ...rootSchema,
      ...resolvedSchema,
    };
  }, [$ref, schema, rootSchema]);

  useEffect(() => {
    if (!data) setRealLabel("");
  }, [data, setRealLabel]);

  const { closeDrawer } = useRightDrawerState();
  const handleSelectedChange = useCallback(
    (v: AutocompleteSuggestion) => {
      if (!v) {
        handleChange(path, undefined);
        closeDrawer();
        return;
      }
      if (v.value !== data)
        if (path.endsWith("@id")) {
          handleChange(path, v.value);
        } else {
          handleChange(path, {
            "@id": v.value,
            "@type": typeIRI,
            __label: v.label,
          });
        }
      setRealLabel(v.label);
    },
    [path, handleChange, data, setRealLabel, closeDrawer, typeIRI],
  );
  const handleAcceptNewEntity = useCallback(
    (data: any) => {
      if (path.endsWith("@id") && data["@id"]) {
        handleChange(path, data["@id"]);
      } else {
        handleChange(path, data);
      }
      setRealLabel(data.label || data["@id"]);
    },
    [path, handleChange, setRealLabel],
  );

  useEffect(() => {
    setRealLabel((_old) => {
      if ((_old && _old.length > 0) || !data) return _old;
      const parentData = Resolve.data(
        ctx?.core?.data,
        path.substring(0, path.length - ("@id".length + 1)),
      );
      const fieldDecl = primaryFields[typeName] as PrimaryField | undefined;
      let label = "";
      if (fieldDecl?.label)
        label = extractFieldIfString(parentData, fieldDecl.label);
      if (typeof label === "object") {
        return "";
      }
      return label;
    });
  }, [data, ctx?.core?.data, path, setRealLabel, primaryFields]);

  const handleExistingEntityAccepted = useCallback(
    (entityIRI: string, data: any) => {
      handleSelectedChange({
        value: entityIRI,
        label: data.label || entityIRI,
      });
      closeDrawer();
    },
    [handleSelectedChange, closeDrawer],
  );

  const labelKey = useMemo(() => {
    const fieldDecl = primaryFields[typeName] as PrimaryField | undefined;
    return fieldDecl?.label || "title";
  }, [typeName]);

  const handleMappedDataAccepted = useCallback(
    (newData: any) => {
      const newIRI = newData["@id"];
      if (!newIRI) return;
      handleSelectedChange({
        value: newIRI,
        label: newData.__label || newIRI,
      });
    },
    [handleSelectedChange],
  );
  const { open: sidebarOpen } = useRightDrawerState();
  const {
    path: globalPath,
    searchString,
    handleSearchStringChange,
    handleMappedData,
    handleFocus: handleFocusGlobal,
    isActive,
  } = useGlobalSearchWithHelper(
    typeName,
    typeIRI,
    subSchema as JSONSchema7,
    formsPath,
    handleMappedDataAccepted,
  );

  const [disabled, setDisabled] = useState(false);
  const showEditDialog = useCallback(() => {
    const fieldDefinitions = primaryFields[typeName] as
      | PrimaryField
      | undefined;
    const defaultLabelKey = fieldDefinitions?.label || "title";
    const entityIRI = createEntityIRI(typeName);
    const modalID = `edit-${typeIRI}-${entityIRI}`;
    registerModal(modalID, EditEntityModal);
    setDisabled(true);
    const newItemStub = {
      "@id": entityIRI,
      "@type": typeIRI,
      [defaultLabelKey]: searchString,
    };
    const newItem = prepareNewEntityDataFinal(newItemStub);
    NiceModal.show(modalID, {
      entityIRI,
      typeIRI,
      data: newItem,
      disableLoad: true,
    })
      .then(({ data }: { data: any }) => {
        handleAcceptNewEntity(data);
      })
      .finally(() => {
        setDisabled(false);
      });
  }, [
    registerModal,
    typeIRI,
    typeName,
    handleSelectedChange,
    createEntityIRI,
    EditEntityModal,
    primaryFields,
    searchString,
    setDisabled,
    prepareNewEntityDataFinal,
  ]);

  const handleMappedDataIntermediate = useCallback(
    (d: any) => {
      handleMappedData(d);
      closeDrawer();
    },
    [handleMappedData, closeDrawer],
  );

  const showAsFocused = useMemo(
    () => isActive && sidebarOpen,
    [isActive, sidebarOpen],
  );

  const handleClear = useCallback(() => {
    handleSelectedChange(null);
  }, [handleSelectedChange]);

  const hasValue = useMemo(
    () => typeof selected.value === "string",
    [selected],
  );

  const detailsData = useMemo(() => {
    if (!selected.value) return;
    return {
      "@id": selected.value,
      [labelKey]: selected.label,
    };
  }, [selected, labelKey]);

  const {
    isValid,
    firstFormHelperText,
    secondFormHelperText,
    showDescription,
    onFocus,
    onBlur,
  } = useFormHelper({
    errors: Array.isArray(errors) ? errors : [errors],
    config,
    uischema,
    visible,
    description,
  });

  const handleBlur = useCallback(() => {
    onBlur();
  }, [onBlur]);

  const handleFocus = useCallback(() => {
    onFocus();
    handleFocusGlobal();
  }, [onFocus, handleFocusGlobal]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: (theme) => theme.spacing(1),
      }}
    >
      <Typography
        variant={"h5"}
        sx={{
          ...hidden(hasValue),
          color: (theme: Theme) => theme.palette.grey[500],
          textAlign: "left",
        }}
      >
        {label}
      </Typography>
      {!hasValue ? (
        <FormControl fullWidth={!appliedUiSchemaOptions.trim} id={id}>
          <DiscoverAutocompleteInput
            onCreateNew={showEditDialog}
            loadOnStart={true}
            readonly={!enabled}
            typeIRI={typeIRI}
            typeName={typeName || ""}
            selected={selected}
            title={label || ""}
            disabled={disabled}
            onSelectionChange={handleSelectedChange}
            onSearchValueChange={handleSearchStringChange}
            searchString={searchString || ""}
            inputProps={{
              onFocus: handleFocus,
              onBlur: handleBlur,
              ...(showAsFocused && { focused: true }),
            }}
          />
          <FormHelperText error={!isValid && !showDescription}>
            {firstFormHelperText}
          </FormHelperText>
          <FormHelperText error={!isValid}>
            {secondFormHelperText}
          </FormHelperText>
        </FormControl>
      ) : (
        <List sx={{ marginTop: "1em" }} dense>
          <EntityDetailListItem
            entityIRI={selected.value}
            typeIRI={typeIRI}
            onClear={enabled && handleClear}
            data={detailsData}
          />
        </List>
      )}
      {globalPath === formsPath && enableFinder && (
        <SearchbarWithFloatingButton>
          <SimilarityFinder
            finderId={`${formsPath}_${path}`}
            search={searchString}
            data={data}
            classIRI={typeIRI}
            jsonSchema={schema as JSONSchema7}
            onExistingEntityAccepted={handleExistingEntityAccepted}
            onMappedDataAccepted={handleMappedDataIntermediate}
          />
        </SearchbarWithFloatingButton>
      )}
    </Box>
  );
};

export const InlineDropdownSemanticFormsRenderer = withJsonFormsControlProps(
  InlineDropdownSemanticFormsRendererComponent,
);
