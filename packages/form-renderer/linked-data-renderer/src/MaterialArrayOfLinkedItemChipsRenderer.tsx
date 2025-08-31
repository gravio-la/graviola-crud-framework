import type { ArrayLayoutProps } from "@jsonforms/core";
import { withJsonFormsArrayLayoutProps } from "@jsonforms/react";
import { Hidden } from "@mui/material";
import { useCallback } from "react";

import { MaterialArrayChipsLayout } from "./MaterialArrayChipsLayout";

const MaterialArrayOfLinkedItemChipsRendererComponent = ({
  visible,
  enabled,
  id,
  uischema,
  schema,
  label,
  rootSchema,
  renderers,
  cells,
  data,
  path,
  errors,
  uischemas,
  addItem,
  removeItems,
  arraySchema,
}: ArrayLayoutProps) => {
  if (!visible) {
    return null;
  }
  return (
    <MaterialArrayChipsLayout
      label={label}
      uischema={uischema}
      schema={schema}
      id={id}
      rootSchema={rootSchema}
      errors={errors}
      enabled={enabled}
      visible={visible}
      data={data}
      path={path}
      addItem={addItem}
      removeItems={removeItems}
      renderers={renderers}
      cells={cells}
      uischemas={uischemas}
      arraySchema={arraySchema}
    />
  );
};

export const MaterialArrayOfLinkedItemChipsRenderer =
  withJsonFormsArrayLayoutProps(
    MaterialArrayOfLinkedItemChipsRendererComponent,
  );
