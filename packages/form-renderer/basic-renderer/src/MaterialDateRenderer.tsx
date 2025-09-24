import { ControlProps, isDescriptionHidden } from "@jsonforms/core";
import {
  createOnChangeHandler,
  getData,
  useFocus,
} from "@jsonforms/material-renderers";
import { withJsonFormsControlProps } from "@jsonforms/react";
import { FormHelperText } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { validate, validateWithAjv } from "@graviola/edb-ui-utils";
import dayjs from "dayjs";
import merge from "lodash-es/merge";
import { useTranslation } from "next-i18next";
import { useMemo } from "react";

import { materialDateControlUiSchemaOptionsSchema } from "./materialDateControlUiSchemaOptionsSchema";

const MaterialDateControl = (props: ControlProps) => {
  const [focused, onFocus, onBlur] = useFocus();
  const {
    description,
    id,
    errors,
    label,
    uischema,
    visible,
    enabled,
    required,
    path,
    handleChange,
    data,
    config,
  } = props;
  const isValid = errors.length === 0;
  const appliedUiSchemaOptions = useMemo(() => {
    const merged = merge({}, config, uischema.options);
    try {
      if (validate(materialDateControlUiSchemaOptionsSchema, merged)) {
        return merged;
      } else {
        // Use AJV directly to get detailed validation errors
        const { isValid, errors } = validateWithAjv(
          materialDateControlUiSchemaOptionsSchema,
          merged,
        );
        if (!isValid) {
          console.warn(
            "Invalid uiSchemaOptions for MaterialDateRenderer",
            merged,
          );
          console.warn("Validation errors:", errors);
        }
        return {};
      }
    } catch (e) {
      console.error(
        "Error validating uiSchemaOptions for MaterialDateRenderer:",
        e,
      );
      return {};
    }
  }, [config, uischema.options]);

  // Destructure appliedUiSchemaOptions for better readability
  const {
    showUnfocusedDescription,
    dateFormat,
    dateSaveFormat,
    views,
    focus,
    disableFuture,
    disablePast,
    minDate,
    maxDate,
    displayWeekNumber,
    showDaysOutsideCurrentMonth,
    reduceAnimations,
    openTo,
    orientation,
    yearsPerRow,
    monthsPerRow,
    hideRequiredAsterisk,
    trim,
    actions,
    hideToolbar,
    cancelLabel,
    clearLabel,
    okLabel,
  } = appliedUiSchemaOptions;

  const showDescription = !isDescriptionHidden(
    visible,
    description,
    focused,
    showUnfocusedDescription,
  );

  const { t } = useTranslation();
  const format =
    dateFormat ??
    (t("date_format") !== "date_format" ? t("date_format") : undefined);
  const saveFormat = dateSaveFormat ?? "YYYY-MM-DD";

  const firstFormHelperText = showDescription
    ? description
    : !isValid
      ? errors
      : null;
  const secondFormHelperText = showDescription && !isValid ? errors : null;
  const onChange = useMemo(
    () => createOnChangeHandler(path, handleChange, saveFormat),
    [path, handleChange, saveFormat],
  );

  if (!visible) {
    return null;
  }

  const finalActions = useMemo(() => {
    return (actions || ["clear", "cancel", "accept"]).map((action) =>
      t(action),
    );
  }, [actions, t]);

  return (
    <>
      <DatePicker
        label={label}
        value={getData(data, saveFormat)}
        onChange={(d) => d && onChange(d)}
        format={format}
        views={views}
        disabled={!enabled}
        autoFocus={focus}
        closeOnSelect={true} // Internal control - always close on select for better UX
        disableFuture={disableFuture}
        disablePast={disablePast}
        minDate={minDate ? dayjs(minDate) : undefined}
        maxDate={maxDate ? dayjs(maxDate) : undefined}
        displayWeekNumber={displayWeekNumber}
        showDaysOutsideCurrentMonth={showDaysOutsideCurrentMonth}
        reduceAnimations={reduceAnimations}
        openTo={openTo}
        orientation={orientation}
        yearsPerRow={yearsPerRow}
        monthsPerRow={monthsPerRow}
        slotProps={{
          textField: {
            id: id + "-input",
            required: required && !hideRequiredAsterisk,
            error: !isValid,
            fullWidth: !trim,
            onFocus: onFocus,
            onBlur: onBlur,
            inputProps: { type: "text" },
            InputLabelProps: data ? { shrink: true } : undefined,
          },
          actionBar: {
            actions: finalActions,
          },
          toolbar: {
            hidden: hideToolbar,
          },
        }}
        localeText={{
          cancelButtonLabel: cancelLabel,
          clearButtonLabel: clearLabel,
          okButtonLabel: okLabel,
        }}
      />
      <FormHelperText error={!isValid && !showDescription}>
        {firstFormHelperText}
      </FormHelperText>
      <FormHelperText error={!isValid}>{secondFormHelperText}</FormHelperText>
    </>
  );
};

export const MaterialDateRenderer =
  withJsonFormsControlProps(MaterialDateControl);
