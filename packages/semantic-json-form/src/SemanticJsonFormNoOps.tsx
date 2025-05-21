import NiceModal from "@ebay/nice-modal-react";
import { SearchbarWithFloatingButton } from "@graviola/edb-basic-components";
import {
  useAdbContext,
  useGlobalSearch,
  useRightDrawerState,
} from "@graviola/edb-state-hooks";
import { SemanticJsonFormNoOpsProps } from "@graviola/semantic-jsonform-types";
import { JsonFormsCore, JsonSchema } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { Card, CardContent, Grid } from "@mui/material";
import { merge } from "lodash-es";
import { useTranslation } from "next-i18next";
import React, { FunctionComponent, useCallback, useMemo } from "react";

import { OptionsModal } from "./OptionsModal";

const WithCard = ({
  children,
  wrapWithinCard,
}: {
  children: React.ReactNode;
  wrapWithinCard?: boolean;
}) =>
  wrapWithinCard ? (
    <Card sx={{ padding: (theme) => theme.spacing(2) }}>
      <CardContent>{children}</CardContent>
    </Card>
  ) : (
    children
  );

export const SemanticJsonFormNoOps: FunctionComponent<
  SemanticJsonFormNoOpsProps
> = ({
  data,
  onChange,
  onError,
  typeIRI,
  schema,
  jsonFormsProps = {},
  onEntityDataChange,
  toolbar,
  searchText,
  disableSimilarityFinder,
  enableSidebar,
  wrapWithinCard,
  formsPath,
  disabled,
}) => {
  const {
    createEntityIRI,
    uiSchemaDefaultRegistry,
    rendererRegistry,
    cellRendererRegistry,
    uischemata,
    components: { SimilarityFinder },
    queryBuildOptions: { typeIRItoTypeName },
  } = useAdbContext();

  const handleFormChange = useCallback(
    (state: Pick<JsonFormsCore, "data" | "errors">) => {
      console.log("state", state);
      onChange?.(state.data, "user");
      if (onError) onError(state.errors);
    },
    [onChange, onError],
  );

  const { closeDrawer } = useRightDrawerState();
  const { t } = useTranslation();

  const handleMappedData = useCallback(
    (newData: any) => {
      if (!newData) return;
      //avoid overriding of id and type by mapped data
      NiceModal.show(OptionsModal, {
        id: "confirm-mapping-dialog",
        content: {
          title: t("merge-or-replace"),
          text: t("confirm-mapping-dialog-message"),
        },
        options: [
          {
            title: t("replace data"),
            value: "replace",
          },
        ],
      }).then((decision: string) => {
        closeDrawer();
        onChange((data: any) => {
          if (decision === "replace") {
            return {
              ...newData,
              "@id": data["@id"] || createEntityIRI(typeIRI),
              "@type": typeIRI,
            };
          } else {
            const computedData = merge(data, {
              ...newData,
              "@id": data["@id"] || createEntityIRI(typeIRI),
              "@type": typeIRI,
            });
            return computedData;
          }
        }, "mapping");
      });
    },
    [onChange, closeDrawer, t, createEntityIRI, typeIRI],
  );

  const handleEntityIRIChange = useCallback(
    (iri) => {
      onEntityDataChange?.(iri);
      closeDrawer();
    },
    [onEntityDataChange, typeIRI, closeDrawer],
  );

  const {
    cells: jfpCells,
    renderers: jfpRenderers,
    config,
    ...jfpProps
  } = jsonFormsProps;
  const finalJsonFormsProps = useMemo(() => {
    return {
      ...jfpProps,
      uischemas: uiSchemaDefaultRegistry,
      uischema:
        jfpProps.uischema ||
        uischemata?.[typeIRItoTypeName(typeIRI)] ||
        undefined,
      config: {
        ...config,
        formsPath,
        typeIRI,
      },
    };
  }, [
    jfpProps,
    uiSchemaDefaultRegistry,
    config,
    formsPath,
    typeIRI,
    uischemata,
    typeIRItoTypeName,
  ]);
  const allRenderer = useMemo(
    () => [...(rendererRegistry || []), ...(jfpRenderers || [])],
    [jfpRenderers, rendererRegistry],
  );
  const allCellRenderer = useMemo(
    () => [...(cellRendererRegistry || []), ...(jfpCells || [])],
    [cellRendererRegistry, jfpCells],
  );
  const { path: globalPath } = useGlobalSearch();

  return (
    <Grid container spacing={0}>
      <Grid item flex={1}>
        <Grid container spacing={0}>
          <Grid
            item
            xs={
              disableSimilarityFinder || enableSidebar || !searchText ? 12 : 6
            }
          >
            <WithCard wrapWithinCard={wrapWithinCard}>
              {toolbar && React.isValidElement(toolbar) ? toolbar : null}
              <JsonForms
                data={data}
                renderers={allRenderer}
                cells={allCellRenderer}
                onChange={handleFormChange}
                schema={schema as JsonSchema}
                readonly={disabled}
                {...finalJsonFormsProps}
              />
            </WithCard>
          </Grid>
          {!disableSimilarityFinder && !enableSidebar && searchText && (
            <Grid xs={6} item>
              <SimilarityFinder
                finderId={formsPath}
                search={searchText}
                data={data}
                classIRI={typeIRI}
                jsonSchema={schema}
                onEntityIRIChange={handleEntityIRIChange}
                onMappedDataAccepted={handleMappedData}
              />
            </Grid>
          )}
        </Grid>
      </Grid>
      {formsPath === globalPath && (
        <Grid item>
          <SearchbarWithFloatingButton>
            <SimilarityFinder
              finderId={formsPath}
              search={searchText}
              data={data}
              classIRI={typeIRI}
              jsonSchema={schema}
              onEntityIRIChange={handleEntityIRIChange}
              onMappedDataAccepted={handleMappedData}
              hideFooter
            />
          </SearchbarWithFloatingButton>{" "}
        </Grid>
      )}
    </Grid>
  );
};
