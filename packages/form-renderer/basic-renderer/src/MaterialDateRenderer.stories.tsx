import { JsonFormsCore, rankWith, scopeEndsWith } from "@jsonforms/core";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { useCallback, useState } from "react";

import { MaterialDateRenderer } from "./MaterialDateRenderer";
import { materialDateControlUiSchemaOptionsSchema } from "./materialDateControlUiSchemaOptionsSchema";

export default {
  title: "ui/form/renderer/MaterialDateRenderer",
  component: MaterialDateRenderer,
  parameters: {
    jsonschema: {
      schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://my-components/material-date-renderer.schema.json",
        ...materialDateControlUiSchemaOptionsSchema,
      },
    },
  },
};

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://example.com/event.schema.json",
  title: "Event",
  description: "An event with a date",
  type: "object",
  properties: {
    eventDate: {
      title: "Event Date",
      description: "The date of the event",
      type: "string",
      format: "date",
    },
  },
  required: ["eventDate"],
};

const renderers = [
  ...materialRenderers,
  {
    tester: rankWith(10, scopeEndsWith("eventDate")),
    renderer: MaterialDateRenderer,
  },
];

// Intermediate component that receives the whole uischema as props
const MaterialDateRendererWithConfig = (args: any) => {
  const [data, setData] = useState<any>({});

  const handleFormChange = useCallback(
    ({ data }: Pick<JsonFormsCore, "data" | "errors">) => {
      setData(data);
    },
    [setData],
  );

  const uischema = {
    type: "Control",
    scope: "#/properties/eventDate",
    options: args,
  };

  return (
    <>
      <JsonForms
        data={data}
        renderers={renderers}
        cells={materialCells}
        onChange={handleFormChange}
        schema={schema}
        uischema={uischema}
      />
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
};

export const MaterialDateRendererDefault = MaterialDateRendererWithConfig.bind(
  {},
);
MaterialDateRendererDefault.args = {
  dateFormat: "DD/MM/YYYY",
  dateSaveFormat: "YYYY-MM-DD",
  views: ["day", "month", "year"],
  openTo: "day",
  orientation: "portrait",
  displayWeekNumber: false,
  showDaysOutsideCurrentMonth: false,
  disableFuture: false,
  disablePast: false,
  minDate: "1900-01-01",
  maxDate: "2099-12-31",
  yearsPerRow: 4,
  monthsPerRow: 3,
  reduceAnimations: false,
  hideRequiredAsterisk: false,
  trim: false,
  focus: false,
  showUnfocusedDescription: false,
  cancelLabel: "Cancel",
  clearLabel: "Clear",
  okLabel: "OK",
  hideToolbar: false,
  actions: ["clear", "cancel", "accept"],
};
