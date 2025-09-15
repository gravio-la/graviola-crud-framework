import NiceModal from "@ebay/nice-modal-react";
import { PrimaryFieldDeclaration } from "@graviola/edb-core-types";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import {
  useAdbContext,
  useCRUDWithQueryClient,
} from "@graviola/edb-state-hooks";
import { specialDate2LocalDate, withEllipsis } from "@graviola/edb-ui-utils";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import { JsonSchema, update } from "@jsonforms/core";
import { useJsonForms } from "@jsonforms/react";
import { Clear, Save } from "@mui/icons-material";
import {
  Avatar,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
} from "@mui/material";
import dot from "dot";
import { JSONSchema7 } from "json-schema";
import get from "lodash-es/get";
import { useTranslation } from "next-i18next";
import React, { useCallback, useEffect, useMemo } from "react";

type SimpleExpandPanelRendererProps = {
  data: any;
  entityIRI: string;
  typeIRI: string;
  typeName: string;
  index: number;
  count: number;
  schema: JsonSchema;
  rootSchema: JsonSchema;
  onRemove: (entityIRI: string) => void;
  onChange: (data: any) => void;
  path: string;
  childLabelTemplate?: string;
  elementDetailItemPath?: string;
  elementLabelProp?: string;
  imagePath?: string;
  formsPath?: string;
  primaryFields: PrimaryFieldDeclaration;
  mapData?: (data: any) => any;
};
export const SimpleExpandPanelRenderer = (
  props: SimpleExpandPanelRendererProps,
) => {
  const { dispatch, config } = useJsonForms();
  const {
    data,
    entityIRI,
    onRemove,
    count,
    childLabelTemplate,
    imagePath,
    elementLabelProp,
    elementDetailItemPath,
    typeIRI,
    typeName,
    primaryFields,
    mapData,
  } = props;
  const onData = useCallback(
    (_data) => {
      dispatch(update(props.path, () => (mapData ? mapData(_data) : _data)));
    },
    [mapData],
  );
  const {
    components: { EntityDetailModal },
  } = useAdbContext();

  const {
    i18n: { language: locale },
  } = useTranslation();

  const elementDetailItem = useMemo(
    () => (elementDetailItemPath ? get(data, elementDetailItemPath) : null),
    [elementDetailItemPath, data],
  );

  const { saveMutation } = useCRUDWithQueryClient({
    entityIRI,
    typeIRI,
    queryOptions: {
      enabled: false, //!data?.__draft && !data?.__label,
      refetchOnWindowFocus: true,
    },
  });
  const draft = data?.__draft && !saveMutation.isSuccess;

  // @ts-ignore
  const { label, description, image } = useMemo(() => {
    let imageUrl = null;
    if (imagePath) {
      imageUrl = get(data, imagePath);
    }
    if (!typeName) return {};
    const fieldDecl = primaryFields[typeName];
    if (data && fieldDecl) {
      const extratedInfo = applyToEachField(
        data,
        fieldDecl,
        extractFieldIfString,
      );
      return {
        image: imageUrl || extratedInfo.image,
        ...extratedInfo,
      };
    }
    return { image: imageUrl };
  }, [data, typeName, entityIRI]);

  const realLabel = useMemo(() => {
    if (childLabelTemplate) {
      try {
        const template = dot.template(childLabelTemplate);
        //we would need a middleware but it is hard to get the date converted correctly here
        const modifiedData = Object.fromEntries(
          Object.entries(data).map(([key, value]: [string, any]) => {
            if (
              key.toLowerCase().includes("date") &&
              typeof value === "number"
            ) {
              return [key, specialDate2LocalDate(value, locale)];
            }
            return [key, value];
          }),
        );
        return template(modifiedData);
      } catch (e) {
        console.warn("could not render childLabelTemplate", e);
      }
    } else if (elementLabelProp) {
      const label_ = get(data, elementLabelProp);
      if (label_) return label_;
    }
    return label || data?.__label;
  }, [childLabelTemplate, elementLabelProp, data, label, locale]);
  const handleSave = useCallback(async () => {
    if (!saveMutation) return;
    saveMutation.mutate(data);
  }, [saveMutation, data]);

  const showDetailModal = useCallback(() => {
    if (elementDetailItem?.["@id"] && elementDetailItem?.["@type"]) {
      NiceModal.show(EntityDetailModal, {
        typeIRI: elementDetailItem["@type"],
        entityIRI: elementDetailItem["@id"],
        data: elementDetailItem,
        inlineEditing: true,
      });
    } else {
      NiceModal.show(EntityDetailModal, {
        typeIRI,
        entityIRI,
        data,
        inlineEditing: true,
      });
    }
  }, [typeIRI, entityIRI, data, elementDetailItem]);

  return (
    <ListItem
      secondaryAction={
        <Stack direction="row" spacing={1}>
          {draft && (
            <IconButton onClick={handleSave} aria-label={"Save"} size="large">
              <Save />
            </IconButton>
          )}
          <IconButton
            aria-label={"Delete"}
            size="large"
            onClick={() => onRemove && onRemove(entityIRI)}
          >
            <Clear />
          </IconButton>
        </Stack>
      }
    >
      <ListItemButton onClick={!draft ? showDetailModal : undefined}>
        <ListItemAvatar>
          <Avatar aria-label="Index" src={image}>
            {count + 1}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primaryTypographyProps={{ style: { whiteSpace: "normal" } }}
          secondaryTypographyProps={{ style: { whiteSpace: "normal" } }}
          primary={withEllipsis(realLabel, 80)}
          secondary={withEllipsis(description, 100)}
        />
      </ListItemButton>
    </ListItem>
  );
};
