import { JsonFormsCore, JsonSchema } from "@jsonforms/core";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { Typography } from "@mui/material";
import { Box } from "@mui/system";
import { JSONSchema7 } from "json-schema";
import React, { FunctionComponent, useCallback, useMemo } from "react";

import { useSettings } from "../../state";

interface OwnProps {}

type Props = OwnProps;

const schema: JsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "array",
  items: {
    type: "object",
    properties: {
      label: {
        type: "string",
      },
      endpoint: {
        type: "string",
      },
      active: {
        type: "boolean",
      },
      provider: {
        type: "string",
        oneOf: [
          {
            const: "oxigraph",
          },
          {
            const: "allegro",
          },
          {
            const: "qlever",
          },
          {
            const: "rest",
          },
          {
            const: "worker",
          },
        ],
      },
      auth: {
        type: "object",
        properties: {
          username: {
            type: "string",
          },
          password: {
            type: "string",
            format: "password",
          },
          token: {
            type: "string",
          },
        },
      },
    },
  },
};

const EndpointChooser: FunctionComponent<Props> = (props) => {
  const { sparqlEndpoints, setSparqlEndpoints, lockedEndpoint } = useSettings();

  const handleFormChange = useCallback(
    (state: Pick<JsonFormsCore, "data" | "errors">) => {
      setSparqlEndpoints(state.data);
    },
    [setSparqlEndpoints],
  );

  const readOnly = useMemo(() => !!lockedEndpoint, [lockedEndpoint]);
  return (
    !readOnly && (
      <Box>
        <Typography variant="h2">Knowledge Base - SPARQL Endpunkte</Typography>
        <JsonForms
          readonly={readOnly}
          data={sparqlEndpoints}
          schema={schema}
          renderers={materialRenderers}
          cells={materialCells}
          onChange={handleFormChange}
        />
      </Box>
    )
  );
};

export default EndpointChooser;
