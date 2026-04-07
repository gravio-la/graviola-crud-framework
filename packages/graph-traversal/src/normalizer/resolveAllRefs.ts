import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { resolveSchema, isJSONSchema } from "@graviola/json-schema-utils";
import type { NormalizationContext } from "./types";

/**
 * Checks if a schema represents a relationship (an object with @id property).
 *
 * Returns true when @id is present:
 * - directly in `properties` (Pattern A, B, C, D), OR
 * - in any member of an `allOf` array (Pattern E — inheritance via allOf)
 *
 * @param schema The schema to check
 * @returns True if this schema represents a named entity
 */
export function isRelationshipSchema(schema: JSONSchema7): boolean {
  // Direct @id property
  if (schema.properties && "@id" in schema.properties) {
    return true;
  }

  // allOf-inherited @id (Pattern E)
  if (schema.allOf) {
    return schema.allOf.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        (part as JSONSchema7).properties !== undefined &&
        "@id" in (part as JSONSchema7).properties!,
    );
  }

  return false;
}

export interface PropertyMetadata {
  isArray: boolean;
  itemType?: string;
  isRelationship: boolean;
}

/**
 * Extracts metadata about a property schema: whether it is an array, its item
 * type, and whether it (or its items) represents a named entity relationship.
 */
export function extractPropertyMetadata(
  schema: JSONSchema7,
  _context: NormalizationContext,
): PropertyMetadata {
  if (schema.type === "array") {
    const items = Array.isArray(schema.items)
      ? (schema.items[0] as JSONSchema7 | undefined)
      : (schema.items as JSONSchema7 | undefined);
    const itemType = items?.type as string | undefined;
    return {
      isArray: true,
      itemType,
      isRelationship: items ? isRelationshipSchema(items) : false,
    };
  }
  return {
    isArray: false,
    isRelationship: isRelationshipSchema(schema),
  };
}

/**
 * Recursively resolves all $ref references in a schema
 * @param schema The schema to resolve
 * @param context Normalization context
 * @returns A new schema with all $refs resolved
 */
export function resolveAllRefs(
  schema: JSONSchema7,
  context: NormalizationContext,
): JSONSchema7 {
  // Avoid infinite recursion
  if (context.depth > 50) {
    return schema;
  }

  // If this is a $ref, resolve it
  if (schema.$ref) {
    const refPath = schema.$ref;

    // Check if we've already visited this ref at this depth
    const refKey = `${refPath}@${context.depth}`;
    if (context.visitedRefs.has(refKey)) {
      // Return a simplified version to break the cycle
      return {
        type: "object",
        properties: {
          "@id": { type: "string" },
        },
      };
    }

    // Mark this ref as visited
    context.visitedRefs.add(refKey);

    // Resolve the reference from the root schema (refs are always relative to root)
    const resolved = resolveSchema(
      context.rootSchema,
      refPath,
      context.rootSchema,
    );

    if (resolved && isJSONSchema(resolved as JSONSchema7Definition)) {
      // Recursively resolve the resolved schema (cast to JSONSchema7 as we only support v7)
      return resolveAllRefs(resolved as JSONSchema7, {
        ...context,
        depth: context.depth + 1,
      });
    }

    return schema;
  }

  // Create a new schema object (immutable approach)
  const newSchema: JSONSchema7 = { ...schema };

  // Resolve properties
  if (schema.properties) {
    newSchema.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      if (typeof value === "boolean") {
        newSchema.properties[key] = value;
      } else if (isJSONSchema(value)) {
        // Recursively resolve each property (this will handle $refs in properties)
        newSchema.properties[key] = resolveAllRefs(value as JSONSchema7, {
          ...context,
          depth: context.depth + 1,
        });
      } else {
        newSchema.properties[key] = value;
      }
    }
  }

  // Resolve items (for arrays)
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      newSchema.items = schema.items.map((item) => {
        if (isJSONSchema(item)) {
          return resolveAllRefs(item as JSONSchema7, {
            ...context,
            depth: context.depth + 1,
          });
        }
        return item;
      });
    } else if (isJSONSchema(schema.items)) {
      newSchema.items = resolveAllRefs(schema.items as JSONSchema7, {
        ...context,
        depth: context.depth + 1,
      });
    }
  }

  // Resolve allOf
  if (schema.allOf) {
    newSchema.allOf = schema.allOf.map((subSchema) => {
      if (isJSONSchema(subSchema)) {
        return resolveAllRefs(subSchema as JSONSchema7, {
          ...context,
          depth: context.depth + 1,
        });
      }
      return subSchema;
    });
  }

  // Resolve anyOf
  if (schema.anyOf) {
    newSchema.anyOf = schema.anyOf.map((subSchema) => {
      if (isJSONSchema(subSchema)) {
        return resolveAllRefs(subSchema as JSONSchema7, {
          ...context,
          depth: context.depth + 1,
        });
      }
      return subSchema;
    });
  }

  // Resolve oneOf
  if (schema.oneOf) {
    newSchema.oneOf = schema.oneOf.map((subSchema) => {
      if (isJSONSchema(subSchema)) {
        return resolveAllRefs(subSchema as JSONSchema7, {
          ...context,
          depth: context.depth + 1,
        });
      }
      return subSchema;
    });
  }

  return newSchema;
}
