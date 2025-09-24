import { CellProps, ControlProps, WithClassname } from "@jsonforms/core";
import { withJsonFormsControlProps } from "@jsonforms/react";
import { Checkbox, FormControlLabel } from "@mui/material";
import isEmpty from "lodash-es/isEmpty";
import isNil from "lodash-es/isNil";
import merge from "lodash-es/merge";
import React, { useCallback } from "react";

const MuiCheckbox = React.memo((props: CellProps & WithClassname) => {
  const { data, className, id, enabled, uischema, path, handleChange, config } =
    props;
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const inputProps = { autoFocus: !!appliedUiSchemaOptions.focus };

  const handleThreestateChange = useCallback(
    (_ev: React.ChangeEvent, isChecked: boolean) => {
      handleChange(path, data ? undefined : data === false);
    },
    [data, path, handleChange],
  );

  return (
    <Checkbox
      checked={Boolean(data)}
      onChange={handleThreestateChange}
      className={className}
      indeterminate={isNil(data)}
      id={id}
      disabled={!enabled}
      inputProps={inputProps}
    />
  );
});
const MaterialBooleanControl = ({
  data,
  visible,
  label,
  id,
  enabled,
  uischema,
  schema,
  rootSchema,
  handleChange,
  errors,
  path,
  config,
}: ControlProps) => {
  if (!visible) {
    return null;
  }

  return (
    <FormControlLabel
      label={label}
      id={id}
      control={
        <MuiCheckbox
          id={`${id}-input`}
          isValid={isEmpty(errors)}
          data={data}
          enabled={enabled}
          visible={visible}
          path={path}
          uischema={uischema}
          schema={schema}
          rootSchema={rootSchema}
          handleChange={handleChange}
          errors={errors}
          config={config}
        />
      }
    />
  );
};

export const MaterialBooleanControlRenderer = withJsonFormsControlProps(
  MaterialBooleanControl,
);
