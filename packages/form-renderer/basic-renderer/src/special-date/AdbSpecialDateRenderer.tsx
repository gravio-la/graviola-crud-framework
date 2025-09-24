import { ControlProps, isDescriptionHidden } from "@jsonforms/core";
import { useFocus } from "@jsonforms/material-renderers";
import { withJsonFormsControlProps } from "@jsonforms/react";
import { Box, FormControl, FormHelperText, FormLabel } from "@mui/material";
import merge from "lodash-es/merge";
import React, { useMemo } from "react";

import { AdbSpecialDateFormGroup } from "./AdbSpecialDateFormGroup";

const AdbSpecialDateControlComponent = (props: ControlProps) => {
  const [focused] = useFocus();
  const {
    description,
    errors,
    label,
    visible,
    enabled,
    path,
    handleChange,
    data,
    config,
    uischema,
  } = props;
  const isValid = errors.length === 0;
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const showDescription = !isDescriptionHidden(
    visible,
    description,
    focused,
    true,
  );

  const firstFormHelperText = showDescription
    ? description
    : !isValid
      ? errors
      : null;
  const secondFormHelperText = showDescription && !isValid ? errors : null;

  const numberData = useMemo(() => {
    const num = Number(data);
    return isNaN(num) ? undefined : num;
  }, [data]);

  if (!visible) {
    return null;
  }

  return (
    <Box>
      <FormControl>
        {label &&
          label.length > 0 &&
          appliedUiSchemaOptions.labelPlacement !== "left" && (
            <FormLabel>{label}</FormLabel>
          )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {label &&
            label.length > 0 &&
            appliedUiSchemaOptions.labelPlacement === "left" && (
              <FormLabel>{label}</FormLabel>
            )}
          <AdbSpecialDateFormGroup
            data={numberData}
            handleChange={(value) => handleChange(path, value)}
            disabled={!enabled}
            fullWidth={Boolean(appliedUiSchemaOptions.fullWidth)}
          />
        </Box>
        <FormHelperText error={!isValid && !showDescription}>
          {firstFormHelperText}
        </FormHelperText>
        <FormHelperText error={!isValid}>{secondFormHelperText}</FormHelperText>
      </FormControl>
    </Box>
  );
};

export const AdbSpecialDateRenderer = withJsonFormsControlProps(
  AdbSpecialDateControlComponent,
);
