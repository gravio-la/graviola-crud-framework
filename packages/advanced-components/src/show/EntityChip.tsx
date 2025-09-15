import NiceModal from "@ebay/nice-modal-react";
import { PrimaryFieldResults } from "@graviola/edb-core-types";
import { ellipsis } from "@graviola/edb-core-utils";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import { useAdbContext, useTypeIRIFromEntity } from "@graviola/edb-state-hooks";
import { useCRUDWithQueryClient } from "@graviola/edb-state-hooks";
import { Avatar, Chip, ChipProps, Tooltip } from "@mui/material";
import { MouseEvent, useCallback, useMemo, useState } from "react";

export type EntityChipProps = {
  index?: number;
  disableLoad?: boolean;
  entityIRI: string;
  typeIRI?: string;
  data?: any;
} & ChipProps;
export const EntityChip = ({
  index,
  disableLoad,
  entityIRI,
  typeIRI,
  data: defaultData,
  ...chipProps
}: EntityChipProps) => {
  const classIRI = useTypeIRIFromEntity(entityIRI, typeIRI, disableLoad);
  const {
    queryBuildOptions: { primaryFieldExtracts, primaryFields },
    typeIRIToTypeName,
    components: { EntityDetailModal },
  } = useAdbContext();
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
      enabled: !disableLoad && !defaultData,
      refetchOnWindowFocus: true,
      initialData: defaultData,
    },
    loadQueryKey: "show",
  });

  const data = rawData?.document?.["@type"] ? rawData?.document : defaultData;
  const cardInfo = useMemo<PrimaryFieldResults<string>>(() => {
    const fieldDecl = primaryFieldExtracts[typeName] || primaryFields[typeName];
    if (data && fieldDecl) {
      const { label, image, description } = applyToEachField(
        data,
        fieldDecl,
        extractFieldIfString,
      );
      return {
        label: ellipsis(label, 50),
        description: ellipsis(description, 50),
        image,
      };
    }
    return {
      label: null,
      description: null,
      image: null,
    };
  }, [typeName, data, primaryFieldExtracts, primaryFields]);
  const { label, image, description } = cardInfo;
  const [tooltipEnabled, setTooltipEnabled] = useState(false);
  const showDetailModal = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      NiceModal.show(EntityDetailModal, {
        entityIRI,
        typeIRI: classIRI,
        data,
      });
    },
    [entityIRI, classIRI, EntityDetailModal, data],
  );
  const handleShouldShow = useCallback(
    (e: MouseEvent<Element>) => {
      setTooltipEnabled(true);
    },
    [setTooltipEnabled],
  );

  return (
    <Tooltip
      title={description}
      open={Boolean(description && description.length > 0 && tooltipEnabled)}
      onClose={() => setTooltipEnabled(false)}
    >
      <Chip
        {...chipProps}
        avatar={
          image ? (
            <Avatar alt={label} src={image} />
          ) : typeof index !== "undefined" ? (
            <Avatar>{index}</Avatar>
          ) : null
        }
        onMouseEnter={handleShouldShow}
        label={label}
        onClick={showDetailModal}
      />
    </Tooltip>
  );
};
