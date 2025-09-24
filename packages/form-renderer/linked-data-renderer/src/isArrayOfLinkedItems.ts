import { resolveSchema, type JsonSchema } from "@graviola/json-schema-utils";
import { type Tester, schemaMatches } from "@jsonforms/core";

export const isArrayOfLinkedItems: Tester = (schema, rootSchema, context) =>
  schemaMatches((_schema, _rootSchema) => {
    if (_schema.type === "array" && typeof _schema.items === "object") {
      const resolvedSchema = resolveSchema(
        _schema.items as JsonSchema,
        undefined,
        _rootSchema as JsonSchema,
      );
      return Boolean(resolvedSchema?.properties?.["@id"]);
    }
    return false;
  })(schema, rootSchema, context);
