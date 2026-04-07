import {
  resolveSchema,
  type JsonSchema,
  type SchemaRegistry,
} from "@graviola/json-schema-utils";
import { type Tester, schemaMatches } from "@jsonforms/core";

export const isArrayOfLinkedItems: Tester = (schema, rootSchema, context) =>
  schemaMatches((_schema, _rootSchema) => {
    if (_schema.type === "array" && typeof _schema.items === "object") {
      const items = _schema.items as JsonSchema;

      // Fast path: use pre-compiled registry when available (O(1) lookup).
      // The registry is injected into JsonForms config by SemanticJsonFormNoOps.
      const registry = (context as any)?.config?.registry as
        | SchemaRegistry
        | undefined;
      if (registry && (items as any).$ref) {
        const entry = registry.byPath.get((items as any).$ref);
        if (entry !== undefined) return entry.isEntity;
        // $ref not in registry — fall through to runtime resolution
      }

      // Fallback: resolve $ref at runtime (backward compatible)
      const resolvedSchema = resolveSchema(
        items,
        undefined,
        _rootSchema as JsonSchema,
      );
      return Boolean(resolvedSchema?.properties?.["@id"]);
    }
    return false;
  })(schema, rootSchema, context);
