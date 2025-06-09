import { materialCustomAnyOfControlTester } from "@graviola/edb-layout-renderer";
import {
  JsonFormsCore,
  Layout,
  rankWith,
  Scopable,
  scopeEndsWith,
} from "@jsonforms/core";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { useCallback, useState } from "react";

import { MarkdownTextFieldRenderer } from "./MarkdownTextFieldRenderer";

export default {
  title: "ui/form/renderer/MarkdownTextFieldRenderer",
  component: MarkdownTextFieldRenderer,
};

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://example.com/person.schema.json",
  title: "Person",
  description: "A human being",
  type: "object",
  properties: {
    description: {
      type: "string",
    },
  },
};

const renderers = [
  ...materialRenderers,
  {
    tester: rankWith(10, scopeEndsWith("description")),
    renderer: MarkdownTextFieldRenderer,
  },
];
export const MarkdownTextFieldRendererDefault = () => {
  const [data, setData] = useState<any>({});

  const handleFormChange = useCallback(
    ({ data }: Pick<JsonFormsCore, "data" | "errors">) => {
      setData(data);
    },
    [setData],
  );

  return (
    <JsonForms
      data={data}
      renderers={renderers}
      cells={materialCells}
      onChange={handleFormChange}
      schema={schema}
    />
  );
};

const uiSchemaWithImageUpload: Layout = {
  type: "VerticalLayout",
  elements: [
    {
      type: "Control",
      scope: "#/properties/description",
      options: {
        imageUploadOptions: {
          uploadImage: (file: File) => Promise.resolve(file.name),
          openImageSelectDialog: () =>
            Promise.resolve({
              url: "https://example.com/image.png",
              alt: "Example image",
            }),
        },
      },
    },
  ],
};

export const MarkdownTextFieldRendererWithImageUpload = () => {
  const [data, setData] = useState<any>({});

  const handleFormChange = useCallback(
    ({ data }: Pick<JsonFormsCore, "data" | "errors">) => {
      setData(data);
    },
    [setData],
  );

  return (
    <JsonForms
      data={data}
      renderers={renderers}
      cells={materialCells}
      onChange={handleFormChange}
      schema={schema}
      uischema={uiSchemaWithImageUpload}
    />
  );
};
