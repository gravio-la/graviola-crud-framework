import { EntityDetailListItem } from "@graviola/edb-advanced-components";
import { SearchbarWithFloatingButton } from "@graviola/edb-basic-components";
import { AutocompleteSuggestion } from "@graviola/edb-core-types";
import { PrimaryField } from "@graviola/edb-core-types";
import { makeFormsPath } from "@graviola/edb-core-utils";
import { extractFieldIfString } from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useGlobalSearchWithHelper,
  useKeyEventForSimilarityFinder,
  useRightDrawerState,
} from "@graviola/edb-state-hooks";
import {
  ControlProps,
  JsonSchema,
  Resolve,
  resolveSchema,
} from "@jsonforms/core";
import type { SchemaRegistry } from "@graviola/json-schema-utils";
import { useJsonForms, withJsonFormsControlProps } from "@jsonforms/react";
import {
  Box,
  FormControl,
  FormHelperText,
  List,
  TextField,
  Theme,
  Typography,
} from "@mui/material";
import { JSONSchema7 } from "json-schema";
import merge from "lodash-es/merge";
import isEqual from "lodash-es/isEqual";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormHelper } from "./formHelper";

const InlineCondensedSemanticFormsRendererComponent = (props: ControlProps) => {
  const {
    id,
    errors,
    schema,
    uischema,
    visible,
    description,
    config,
    data,
    handleChange,
    path,
    rootSchema,
    label,
    enabled,
  } = props;
  const {
    typeIRIToTypeName,
    queryBuildOptions: { primaryFields },
    components: { SimilarityFinder },
  } = useAdbContext();
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const {
    $ref,
    typeIRI: typeIRIFromContext,
    mapData,
    getID,
  } = appliedUiSchemaOptions.context || {};
  const ctx = useJsonForms();
  const registry = (ctx?.config as any)?.registry as SchemaRegistry | undefined;
  // Resolve typeIRI: explicit context option → registry O(1) lookup via $ref
  const typeIRI: string | undefined =
    typeIRIFromContext ||
    (registry && $ref ? registry.byPath.get($ref)?.typeIRI : undefined);
  const entityIRI = useMemo(() => {
    if (!data) return null;
    return getID ? getID(data) : data["@id"] || data;
  }, [data, getID]);

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
      entityIRI
        ? { value: entityIRI || null, label: realLabel }
        : { value: null, label: null },
    [entityIRI, realLabel],
  );
  const subSchema = useMemo(() => {
    if (!$ref) return;
    // Fast path: O(1) registry lookup
    if (registry) {
      const entry = registry.byPath.get($ref);
      if (entry) return { ...(rootSchema as object), ...entry.resolvedSchema };
    }
    // Fallback: runtime resolution
    const schema2 = { ...schema, $ref };
    const resolvedSchema = resolveSchema(
      schema2 as JsonSchema,
      "",
      rootSchema as JsonSchema,
    );
    return { ...rootSchema, ...resolvedSchema };
  }, [$ref, schema, rootSchema, registry]);

  useEffect(() => {
    if (!entityIRI) setRealLabel("");
  }, [entityIRI, setRealLabel]);

  const { closeDrawer } = useRightDrawerState();
  const handleSelectedChange = useCallback(
    (v: AutocompleteSuggestion) => {
      if (!v) {
        handleChange(path, undefined);
        closeDrawer();
        return;
      }
      const _data = mapData ? mapData(v.value) : v.value;
      if (!isEqual(_data, data)) handleChange(path, _data);
      setRealLabel(v.label);
    },
    [path, handleChange, data, setRealLabel, closeDrawer, mapData],
  );

  useEffect(() => {
    setRealLabel((_old) => {
      if ((_old && _old.length > 0) || !entityIRI) return _old;
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
  }, [entityIRI, ctx?.core?.data, path, setRealLabel]);

  const handleExistingEntityAccepted = useCallback(
    (entityIRI: string, _data: any) => {
      handleSelectedChange({
        value: entityIRI,
        label: _data.label || entityIRI,
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
  const {
    path: globalPath,
    searchString,
    handleSearchStringChange,
    handleMappedData,
    handleFocus: handleFocusGlobal,
  } = useGlobalSearchWithHelper(
    typeName,
    typeIRI,
    subSchema as JSONSchema7,
    formsPath,
    handleMappedDataAccepted,
  );

  const handleMappedDataIntermediate = useCallback(
    (d: any) => {
      handleMappedData(d);
      closeDrawer();
    },
    [handleMappedData, closeDrawer],
  );

  const handleKeyUp = useKeyEventForSimilarityFinder();

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

  const handleFocus = useCallback(() => {
    onFocus();
    handleFocusGlobal();
  }, [onFocus, handleFocusGlobal]);

  const handleBlur = useCallback(() => {
    onBlur();
  }, [onBlur]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <Box sx={{ position: "relative" }}>
        <Typography
          variant={"h5"}
          sx={{
            transform: !hasValue ? "translateY(2.9em)" : "translateY(0)",
            position: "absolute",
            opacity: hasValue ? 1.0 : 0.0,
            transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
            color: (theme: Theme) => theme.palette.grey[500],
          }}
        >
          {label}
        </Typography>
      </Box>
      <Box>
        {!hasValue ? (
          <FormControl fullWidth={!appliedUiSchemaOptions.trim} id={id}>
            <TextField
              fullWidth
              disabled={!enabled}
              onChange={(ev) => handleSearchStringChange(ev.target.value)}
              value={searchString || ""}
              label={label}
              inputProps={{
                onFocus: handleFocus,
                onBlur: handleBlur,
                onKeyUp: handleKeyUp,
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
          <List sx={{ marginTop: (theme) => theme.spacing(1) }} dense>
            <EntityDetailListItem
              entityIRI={selected.value}
              typeIRI={typeIRI}
              onClear={enabled && handleClear}
              data={detailsData}
            />
          </List>
        )}
        {globalPath === formsPath && enabled && (
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
    </>
  );
};

export const InlineCondensedSemanticFormsRenderer = withJsonFormsControlProps(
  InlineCondensedSemanticFormsRendererComponent,
);
