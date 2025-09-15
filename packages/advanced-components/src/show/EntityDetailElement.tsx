import { PrimaryField, PrimaryFieldResults } from "@graviola/edb-core-types";
import { filterUndefOrNull } from "@graviola/edb-core-utils";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useCRUDWithQueryClient,
} from "@graviola/edb-state-hooks";
import { useTypeIRIFromEntity } from "@graviola/edb-state-hooks";
import { Box, BoxProps } from "@mui/material";
import { useMemo } from "react";

import { EntityDetailCard } from "./EntityDetailCard";

export type EntityDetailElementProps = {
  typeIRI: string | undefined;
  entityIRI: string;
  data: any;
  cardActionChildren?: React.ReactNode;
  disableInlineEditing?: boolean;
  readonly?: boolean;
  disableLoad?: boolean;
};

export const EntityDetailElement = ({
  typeIRI,
  entityIRI,
  data: initialData,
  cardActionChildren,
  disableInlineEditing,
  readonly,
  disableLoad,
  ...rest
}: EntityDetailElementProps & Partial<BoxProps>) => {
  const {
    queryBuildOptions: { primaryFields },
    typeIRIToTypeName,
  } = useAdbContext();
  const classIRI = useTypeIRIFromEntity(entityIRI, typeIRI, disableLoad);
  const typeName = useMemo(
    () => typeIRIToTypeName(classIRI),
    [classIRI, typeIRIToTypeName],
  );
  const {
    loadQuery: { data: rawData },
  } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI: classIRI,
    queryOptions: {
      enabled: true,
      refetchOnWindowFocus: true,
      initialData: initialData ? { document: initialData } : undefined,
    },
    loadQueryKey: "show",
  });
  const data = initialData || rawData?.document;
  const fieldDeclaration = useMemo(
    () => primaryFields[typeName] as PrimaryField,
    [typeName, primaryFields],
  );
  const cardInfo = useMemo<PrimaryFieldResults<string>>(() => {
    if (data && fieldDeclaration)
      return applyToEachField(data, fieldDeclaration, extractFieldIfString);
    return {
      label: null,
      description: null,
      image: null,
    };
  }, [fieldDeclaration, data]);

  const disabledProperties = useMemo(
    () =>
      fieldDeclaration
        ? filterUndefOrNull(Object.values(fieldDeclaration))
        : [],
    [fieldDeclaration],
  );

  return (
    <Box sx={{ p: 2, ...(rest.sx || {}) }} {...rest}>
      <EntityDetailCard
        typeIRI={classIRI}
        entityIRI={entityIRI}
        data={data}
        cardInfo={cardInfo}
        cardActionChildren={cardActionChildren}
        readonly={readonly}
        tableProps={{ disabledProperties }}
      />
    </Box>
  );
};
