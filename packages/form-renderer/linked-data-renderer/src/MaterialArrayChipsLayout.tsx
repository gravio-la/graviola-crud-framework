import { irisToData, makeFormsPath } from "@graviola/edb-core-utils";
import { useAdbContext } from "@graviola/edb-state-hooks";
import { useCRUDWithQueryClient } from "@graviola/edb-state-hooks";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import {
  ArrayLayoutProps,
  composePaths,
  computeLabel,
  createDefaultValue,
  JsonSchema,
  JsonSchema7,
  Resolve,
} from "@jsonforms/core";
import { useJsonForms } from "@jsonforms/react";
import AddIcon from "@mui/icons-material/Add";
import { Box, Grid, IconButton, Stack } from "@mui/material";
import { JSONSchema7 } from "json-schema";
import { orderBy, uniqBy } from "lodash-es";
import merge from "lodash-es/merge";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrayLayoutToolbar } from "./ArrayToolbar";
import { SemanticFormsInline } from "./SemanticFormsInline";
import { SimpleChipRenderer } from "./SimpleChipRenderer";

const MaterialArrayChipsLayoutComponent = (props: ArrayLayoutProps & {}) => {
  const innerCreateDefaultValue = useCallback(
    () => createDefaultValue(props.schema, props.rootSchema),
    [props.schema, props.rootSchema],
  );
  const { createEntityIRI, typeIRIToTypeName } = useAdbContext();
  const {
    data,
    path,
    schema,
    errors,
    addItem,
    enabled,
    label,
    required,
    rootSchema,
    config,
    removeItems,
  } = props;
  const {
    isReifiedStatement,
    hideRequiredAsterisk,
    additionalKnowledgeSources,
    elementLabelTemplate,
    elementLabelProp,
    dropdown,
    context,
    showCreateButton,
    allowCreateMultiple,
  } = useMemo(
    () => merge({}, config, props.uischema.options),
    [config, props.uischema.options],
  );
  const { core } = useJsonForms();
  const realData = Resolve.data(core.data, path);
  const typeIRI = context?.typeIRI ?? schema.properties?.["@type"]?.const;
  const typeName = useMemo(
    () => typeIRIToTypeName(typeIRI),
    [typeIRI, typeIRIToTypeName],
  );

  const [formData, setFormData] = useState<any>(
    irisToData(createEntityIRI(typeName), typeIRI),
  );

  const subSchema = useMemo(
    () =>
      bringDefinitionToTop(rootSchema as JSONSchema7, typeName) as JsonSchema,
    [rootSchema, typeName],
  );
  const entityIRI = useMemo(() => formData["@id"], [formData]);
  const { saveMutation } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI,
    schema: subSchema as JSONSchema7,
    queryOptions: { enabled: false },
  });

  const { enqueueSnackbar } = useSnackbar();
  const handleSaveAndAdd = useCallback(() => {
    const finalData = {
      ...formData,
    };
    //if(typeof saveMethod === 'function')  saveMethod();
    saveMutation
      .mutateAsync(finalData)
      .then(({ mainDocument }) => {
        enqueueSnackbar("Saved", { variant: "success" });
        addItem(path, mainDocument)();
        setFormData({
          "@id": createEntityIRI(typeName),
          "@type": typeIRI,
        });
      })
      .catch((e) => {
        enqueueSnackbar("Error while saving " + e.message, {
          variant: "error",
        });
      });
  }, [saveMutation, typeIRI, typeName, addItem, setFormData]);

  useEffect(() => {
    setFormData(irisToData(createEntityIRI(typeName), typeIRI));
  }, [typeIRI, typeName, setFormData]);

  return (
    <Box>
      <ArrayLayoutToolbar
        label={computeLabel(
          label,
          Boolean(required),
          Boolean(hideRequiredAsterisk),
        )}
        errors={errors}
        path={path}
        schema={schema as JsonSchema7 | undefined}
        addItem={addItem}
        createDefault={innerCreateDefaultValue}
        enabled={enabled}
        dropdown={dropdown}
        isReifiedStatement={Boolean(isReifiedStatement)}
        formsPath={makeFormsPath(config?.formsPath, path)}
        additionalKnowledgeSources={additionalKnowledgeSources}
        showCreateButton={showCreateButton}
        allowCreateMultiple={allowCreateMultiple}
      />
      {isReifiedStatement && (
        <Grid
          display={"flex"}
          container
          direction={"row"}
          alignItems={"center"}
        >
          <Grid item flex={"1"}>
            <SemanticFormsInline
              schema={subSchema}
              entityIRI={formData["@id"]}
              typeIRI={typeIRI}
              formData={formData}
              onFormDataChange={(data) => setFormData(data)}
              semanticJsonFormsProps={{
                disableSimilarityFinder: true,
              }}
              formsPath={makeFormsPath(config?.formsPath, path)}
            />
          </Grid>
          <Grid item>
            <IconButton onClick={handleSaveAndAdd}>
              <AddIcon style={{ fontSize: 40 }} />
            </IconButton>
          </Grid>
        </Grid>
      )}
      <Stack
        spacing={1}
        direction="row"
        flexWrap={"wrap"}
        sx={{ marginBottom: 1 }}
      >
        {data > 0
          ? orderBy(
              uniqBy(
                realData?.map((childData, index) => ({
                  id: childData["@id"],
                  childData,
                  index,
                })),
                "id",
              ),
              "id",
            ).map(({ id, childData, index }: any, count) => {
              const childPath = composePaths(path, `${index}`);
              return (
                <Box key={id}>
                  <SimpleChipRenderer
                    typeIRI={typeIRI}
                    onRemove={removeItems(path, [index])}
                    schema={schema}
                    onChange={() => {}}
                    rootSchema={rootSchema}
                    entityIRI={id}
                    data={childData}
                    index={index}
                    count={count}
                    path={childPath}
                    childLabelTemplate={elementLabelTemplate}
                    elementLabelProp={elementLabelProp}
                    formsPath={makeFormsPath(config?.formsPath, childPath)}
                  />
                </Box>
              );
            })
          : null}
      </Stack>
    </Box>
  );
};

export const MaterialArrayChipsLayout = MaterialArrayChipsLayoutComponent;
