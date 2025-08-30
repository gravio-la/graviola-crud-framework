import { type JsonSchema, type Tester, schemaMatches } from "@jsonforms/core";

export const isArrayOfLinkedItems: Tester = (schema, rootSchema, context) =>
  schemaMatches((_schema) => {
    if (
      !(
        _schema.type === "array" &&
        typeof _schema.items === "object" &&
        (_schema.items as JsonSchema).properties
      )
    ) {
      return Boolean((_schema.items as JsonSchema).$ref);
    }
    const props = (_schema.items as JsonSchema).properties;
    return Boolean(props["@id"]);
  })(schema, rootSchema, context);
