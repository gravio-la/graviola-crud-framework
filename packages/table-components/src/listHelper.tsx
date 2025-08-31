import NiceModal from "@ebay/nice-modal-react";
import { OverflowContainer } from "@graviola/edb-basic-components";
import type {
  PrimaryField,
  PrimaryFieldDeclaration,
} from "@graviola/edb-core-types";
import { filterUndefOrNull } from "@graviola/edb-core-utils";
import { applyToEachField } from "@graviola/edb-data-mapping";
import { useAdbContext } from "@graviola/edb-state-hooks";
import { isJSONSchema } from "@graviola/json-schema-utils";
import { JsonSchema, RankedTester, TesterContext } from "@jsonforms/core";
import { Avatar, Box, Link } from "@mui/material";
import { TFunction } from "i18next";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import maxBy from "lodash-es/maxBy";
import type { MRT_ColumnDef } from "material-react-table";
import * as React from "react";
import { MouseEvent, useCallback, useMemo } from "react";

import { cellConfigRegistry } from "./cellConfigRegistry";
import {
  extractSingleFieldIfString,
  mkAccessor,
  pathToString,
  urlSuffix,
} from "./tableRegistryHelper";

type PrimaryColumnContentProps = {
  entityIRI: string;
  typeName: string;
  children: React.ReactNode;
  data: any;
  density?: "comfortable" | "compact" | "spacious";
};
export const PrimaryColumnContent = ({
  entityIRI,
  typeName,
  children,
  data,
  density,
}: PrimaryColumnContentProps) => {
  const {
    queryBuildOptions: { primaryFields },
    typeNameToTypeIRI,
    components: { EntityDetailModal },
  } = useAdbContext();
  const primaryContent = useMemo(() => {
    const fieldDecl = primaryFields[typeName] as PrimaryField | undefined;
    if (data && fieldDecl)
      return applyToEachField(data, fieldDecl, extractSingleFieldIfString);
    return {
      label: null,
      description: null,
      image: null,
    };
  }, [data, typeName, primaryFields]);
  const showDetailModal = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      NiceModal.show(EntityDetailModal, {
        entityIRI,
        typeIRI: typeNameToTypeIRI(typeName),
        data: {},
        disableInlineEditing: true,
      });
    },
    [entityIRI, EntityDetailModal, typeNameToTypeIRI, typeName],
  );

  return (
    <Link
      component="button"
      variant="body2"
      onClick={showDetailModal}
      underline={"hover"}
      color={"inherit"}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {primaryContent.image && (
          <Avatar
            alt="avatar"
            variant={
              typeName.toLowerCase().includes("person") ? "circular" : "rounded"
            }
            sx={
              density === "compact"
                ? { width: 24, height: 24 }
                : { width: 42, height: 42 }
            }
            src={primaryContent.image}
          />
        )}
        {/* using renderedCellValue instead of cell.getValue() preserves filter match highlighting */}
        <OverflowContainer tooltip={children}>{children}</OverflowContainer>
      </Box>
    </Link>
  );
};
type ComputeColumnDefFunction<T = any> = (
  typeName: string,
  key: string,
  schemaDef: JSONSchema7Definition,
  t: TFunction,
  path?: string[],
  primaryFields?: PrimaryFieldDeclaration,
) => MRT_ColumnDef<T>;
export interface MuiTableColumnDefinitionRegistryEntry<T = any> {
  tester: RankedTester;
  columnDef: ComputeColumnDefFunction<T>;
}

export const defaultColumnDefinitionStub: (
  typeName: string,
  key: string,
  schemaDef: JSONSchema7Definition,
  rootSchema: JSONSchema7,
  t: TFunction,
  path?: string[],
  primaryFields?: PrimaryFieldDeclaration,
) => MRT_ColumnDef<any> = (
  typeName,
  key,
  schemaDef,
  rootSchema,
  t,
  path = [],
  primaryFields,
) => {
  const testerContext: TesterContext = {
    rootSchema: rootSchema as JsonSchema,
    config: {},
  };
  const uiSchema = {
    type: "Control",
    scope: `#/properties/${key}`,
  };

  const columnDef = maxBy(cellConfigRegistry, (entry) => {
    const tested = entry.tester(
      uiSchema,
      schemaDef as JsonSchema,
      testerContext,
    );
    return tested;
  });
  const rank = columnDef.tester(
    uiSchema,
    schemaDef as JsonSchema,
    testerContext,
  );
  //console.log({columnDef})
  return rank > 0
    ? columnDef.columnDef(typeName, key, schemaDef, t, path, primaryFields)
    : null;
};

export type ColumnDefMatcher<TData = any> = (
  key: string,
  schemaDef: JSONSchema7Definition,
  typeName: string,
  t: TFunction,
  path?: string[],
) => MRT_ColumnDef<TData> | null;
export const computeColumns: (
  schema: JSONSchema7,
  typeName: string,
  t: TFunction,
  matcher?: ColumnDefMatcher,
  path?: string[],
  primaryFields?: PrimaryFieldDeclaration,
) => MRT_ColumnDef<any>[] = (
  schema,
  typeName,
  t,
  matcher,
  path = [],
  primaryFields,
) =>
  (!schema?.properties
    ? []
    : [
        {
          id: pathToString([...path, "IRI"]),
          header: pathToString([...path, "IRI"]),
          accessorFn: mkAccessor(
            `${pathToString([...path, "entity"])}.value`,
            "",
          ),
          Cell: ({ cell }) => (
            <OverflowContainer tooltip={cell.getValue()}>
              {urlSuffix(cell.getValue() ?? "")}
            </OverflowContainer>
          ),
        },
        ...filterUndefOrNull(
          Object.entries(schema.properties).map(
            ([key, propertyDefinition], index): MRT_ColumnDef<any> => {
              const columnDefinition = matcher
                ? matcher(key, propertyDefinition, typeName, t, path)
                : null;
              return (
                columnDefinition ||
                defaultColumnDefinitionStub(
                  typeName,
                  key,
                  propertyDefinition,
                  schema,
                  t,
                  path,
                  primaryFields,
                )
              );
            },
          ),
        ),
        ...Object.entries(schema.properties || {})
          .filter(
            ([, value]) =>
              typeof value === "object" &&
              value.type === "object" &&
              !value.$ref,
          )
          .map(([key, value]) =>
            isJSONSchema(value)
              ? computeColumns(
                  value,
                  typeName,
                  t,
                  matcher,
                  [...path, key],
                  primaryFields,
                )
              : [],
          )
          .flat(),
      ]) as any as MRT_ColumnDef<any>[];
