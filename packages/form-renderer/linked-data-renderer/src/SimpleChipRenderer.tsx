import NiceModal from "@ebay/nice-modal-react";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useCRUDWithQueryClient,
} from "@graviola/edb-state-hooks";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import { JsonSchema, update } from "@jsonforms/core";
import { useJsonForms } from "@jsonforms/react";
import { Avatar, Chip, ChipProps, Tooltip } from "@mui/material";
import dot from "dot";
import { JSONSchema7 } from "json-schema";
import get from "lodash-es/get";
import React, {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type SimpleChipRendererProps = {
  data: any;
  entityIRI: string;
  index: number;
  count: number;
  schema: JsonSchema;
  rootSchema: JsonSchema;
  onRemove: (entityIRI: string) => void;
  onChange: (data: any) => void;
  path: string;
  childLabelTemplate?: string;
  elementLabelProp?: string;
  formsPath?: string;
  typeIRI?: string;
};

const hasRealData = ({ ["@id"]: _1, ["@type"]: _2, ...rest }: any) => {
  return Object.keys(rest).length > 0;
};

export const SimpleChipRenderer = (
  props: SimpleChipRendererProps & ChipProps,
) => {
  const { dispatch } = useJsonForms();
  const {
    data,
    index,
    entityIRI,
    typeIRI,
    schema,
    rootSchema,
    onRemove,
    count,
    childLabelTemplate,
    elementLabelProp,
    formsPath,
    ...chipProps
  } = props;
  const {
    typeIRIToTypeName,
    queryBuildOptions: { primaryFields },
    components: { EntityDetailModal },
  } = useAdbContext();
  const typeName = useMemo(
    () => typeIRI && typeIRIToTypeName(typeIRI),
    [typeIRI],
  );
  const onData = useCallback((_data) => {
    dispatch(update(props.path, () => _data));
  }, []);
  // @ts-ignore
  const { label, description, image } = useMemo(() => {
    if (!typeName) return {};
    const fieldDecl = primaryFields[typeName];
    if (data && fieldDecl)
      return applyToEachField(data, fieldDecl, extractFieldIfString);
    return {};
  }, [data, typeName, entityIRI, primaryFields]);
  const subSchema = useMemo(
    () =>
      bringDefinitionToTop(rootSchema as JSONSchema7, typeName) as JSONSchema7,
    [rootSchema, typeName],
  );
  const realLabel = useMemo(() => {
    if (childLabelTemplate) {
      try {
        const template = dot.template(childLabelTemplate);
        return template(data);
      } catch (e) {
        console.warn("could not render childLabelTemplate", e);
      }
    } else if (elementLabelProp) {
      const label_ = get(data, elementLabelProp);
      if (label_) return label_;
    }
    return label || data?.__label;
  }, [childLabelTemplate, elementLabelProp, data, label]);

  const queryEnabled = useMemo(() => !hasRealData(data), [data]);
  const {
    loadQuery: { data: loadedData },
  } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI,
    queryOptions: {
      enabled: queryEnabled,
      initialData: data ? { document: data } : undefined,
      refetchOnWindowFocus: true,
    },
  });
  useEffect(() => {
    if (loadedData?.document) {
      onData(loadedData.document);
    }
  }, [loadedData, onData]);

  const [tooltipEnabled, setTooltipEnabled] = useState(false);

  const showDetailModal = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      NiceModal.show(EntityDetailModal, {
        typeIRI,
        entityIRI,
        data: Object.fromEntries(
          Object.entries(data).filter(([key]) => !key.startsWith("__")),
        ),
      });
    },
    [entityIRI, typeIRI, data],
  );
  const handleShouldShow = useCallback(
    (e: MouseEvent<Element>) => {
      setTooltipEnabled(true);
    },
    [setTooltipEnabled, showDetailModal],
  );
  return (
    <Tooltip
      title={description}
      open={description && description.length > 0 && tooltipEnabled}
      onClose={() => setTooltipEnabled(false)}
    >
      <Chip
        {...chipProps}
        data-testid={`chip-${formsPath}-${index}`}
        avatar={
          image ? (
            <Avatar alt={realLabel} src={image} />
          ) : (
            <Avatar>{count + 1}</Avatar>
          )
        }
        onMouseEnter={handleShouldShow}
        label={realLabel}
        onClick={showDetailModal}
        onDelete={() => onRemove && onRemove(entityIRI)}
      />
    </Tooltip>
  );
};
