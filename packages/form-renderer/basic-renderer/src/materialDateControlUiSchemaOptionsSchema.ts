import { JSONSchema } from "json-schema-to-ts";

export const materialDateControlUiSchemaOptionsSchema = {
  type: "object",
  properties: {
    dateFormat: {
      type: "string",
      description: "Format of the date when rendered in the input",
    },
    dateSaveFormat: {
      type: "string",
      description: "Format used for saving the date value",
    },
    views: {
      type: "array",
      items: {
        type: "string",
        enum: ["day", "month", "year"],
      },
      description: "Available views for the date picker",
    },
    openTo: {
      type: "string",
      enum: ["day", "month", "year"],
      description: "The default visible view",
    },
    orientation: {
      type: "string",
      enum: ["landscape", "portrait"],
      description: "Force rendering in particular orientation",
    },
    displayWeekNumber: {
      type: "boolean",
      description: "Display week numbers in the calendar",
    },
    showDaysOutsideCurrentMonth: {
      type: "boolean",
      description: "Show days outside the current month",
    },
    disableFuture: {
      type: "boolean",
      description: "Disable future dates",
    },
    disablePast: {
      type: "boolean",
      description: "Disable past dates",
    },
    minDate: {
      anyOf: [
        {
          type: "string",
          format: "date",
        },
        {
          type: "number",
        },
      ],
      description: "Minimum selectable date (YYYY-MM-DD format or timestamp)",
    },
    maxDate: {
      anyOf: [
        {
          type: "string",
          format: "date",
        },
        {
          type: "number",
        },
      ],
      description: "Maximum selectable date (YYYY-MM-DD format or timestamp)",
    },
    yearsPerRow: {
      type: "number",
      enum: [3, 4],
      description: "Years rendered per row",
    },
    monthsPerRow: {
      type: "number",
      enum: [3, 4],
      description: "Months rendered per row",
    },
    reduceAnimations: {
      type: "boolean",
      description: "Disable heavy animations",
    },
    hideRequiredAsterisk: {
      type: "boolean",
      description: "Hide the required asterisk",
    },
    trim: {
      type: "boolean",
      description: "Trim the input field width",
    },
    focus: {
      type: "boolean",
      description: "Auto focus the input field",
    },
    showUnfocusedDescription: {
      type: "boolean",
      description: "Show description when field is not focused",
    },
    cancelLabel: {
      type: "string",
      description: "Label for cancel button",
    },
    clearLabel: {
      type: "string",
      description: "Label for clear button",
    },
    okLabel: {
      type: "string",
      description: "Label for ok button",
    },
    hideToolbar: {
      type: "boolean",
      description: "Hide the toolbar",
    },
    actions: {
      type: "array",
      items: {
        type: "string",
        enum: ["clear", "cancel", "accept"],
      },
      description: "Available actions in the action bar",
    },
  },
} as const satisfies JSONSchema;
