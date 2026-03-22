/**
 * Schema-driven partial update for Prisma store.
 *
 * Uses the JSON Schema to determine how each property is stored:
 * - Scalars → direct column update
 * - Nested objects (no @id in schema) → underscore-prefixed flat columns
 * - Entity references (@id in schema) → Prisma connect/disconnect
 * - Arrays of references → Prisma set (replaces all connections)
 * - null → sets column to null / disconnects relation
 */

import type { IRIToStringFn, SchemaValidator } from "@graviola/edb-core-types";
import {
  isJSONSchema,
  resolveSchema,
  validatePatchData,
} from "@graviola/json-schema-utils";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

const resolvePropertySchema = (
  propSchema: JSONSchema7Definition,
  rootSchema: JSONSchema7,
): JSONSchema7 | undefined => {
  if (!isJSONSchema(propSchema)) return undefined;
  if (propSchema.$ref) {
    const resolved = resolveSchema(propSchema, "", rootSchema);
    return resolved && isJSONSchema(resolved as JSONSchema7Definition)
      ? (resolved as JSONSchema7)
      : undefined;
  }
  return propSchema;
};

/**
 * Checks if a schema represents an entity reference (has @id property).
 * Same convention as isRelationshipSchema() in graph-traversal.
 */
const isEntityReferenceSchema = (schema: JSONSchema7): boolean =>
  !!(schema.properties && "@id" in schema.properties);

export type PrismaPatchOptions = {
  /** Optional schema validator facade (e.g. AJV). */
  validator?: SchemaValidator;
  /** Optional IRI → database ID conversion. */
  IRItoId?: IRIToStringFn;
  /** Enable debug logging. */
  debug?: boolean;
};

/**
 * Flattens a nested object value into underscore-prefixed properties,
 * guided by the schema structure. Only processes keys present in the patch data
 * that also exist in the schema (shallow merge).
 */
function flattenNestedObject(
  value: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  prefix: string,
): { properties: Record<string, unknown>; connects: Record<string, unknown> } {
  const properties: Record<string, unknown> = {};
  const connects: Record<string, unknown> = {};
  const schemaProps = schema.properties || {};

  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith("@")) continue;
    if (!(key in schemaProps)) continue;

    const nestedSchema = resolvePropertySchema(schemaProps[key], rootSchema);
    if (!nestedSchema) continue;

    const prefixedKey = `${prefix}${key}`;

    if (
      nestedSchema &&
      (nestedSchema.type === "object" || nestedSchema.properties) &&
      !isEntityReferenceSchema(nestedSchema)
    ) {
      // Deeper nesting — recurse with underscore prefix
      if (val === null) {
        // null clears all sub-properties
        for (const subKey of Object.keys(nestedSchema.properties || {})) {
          if (subKey.startsWith("@")) continue;
          properties[`${prefixedKey}_${subKey}`] = null;
        }
      } else if (typeof val === "object" && !Array.isArray(val)) {
        const nested = flattenNestedObject(
          val as Record<string, unknown>,
          nestedSchema,
          rootSchema,
          `${prefixedKey}_`,
        );
        Object.assign(properties, nested.properties);
        Object.assign(connects, nested.connects);
      }
    } else if (isEntityReferenceSchema(nestedSchema)) {
      // Entity reference at nested level
      if (val === null) {
        connects[prefixedKey] = { disconnect: true };
      } else if (
        typeof val === "object" &&
        !Array.isArray(val) &&
        val !== null &&
        "@id" in val
      ) {
        connects[prefixedKey] = {
          connect: { id: (val as Record<string, string>)["@id"] },
        };
      }
    } else {
      // Scalar at nested level
      properties[prefixedKey] = val;
    }
  }

  return { properties, connects };
}

/**
 * Builds the Prisma update payload from patch data, driven by schema.
 */
function buildPrismaUpdatePayload(
  data: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  IRItoId?: IRIToStringFn,
): { properties: Record<string, unknown>; connects: Record<string, unknown> } {
  const properties: Record<string, unknown> = {};
  const connects: Record<string, unknown> = {};
  const schemaProps = schema.properties || {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("@")) continue;
    if (!(key in schemaProps)) continue;

    const propSchema = resolvePropertySchema(schemaProps[key], rootSchema);
    if (!propSchema) continue;

    // Nested object (blank node) — flatten with underscore prefix
    if (
      (propSchema.type === "object" || propSchema.properties) &&
      !isEntityReferenceSchema(propSchema)
    ) {
      if (value === null) {
        // null clears all sub-properties in the flat representation
        for (const subKey of Object.keys(propSchema.properties || {})) {
          if (subKey.startsWith("@")) continue;
          properties[`${key}_${subKey}`] = null;
        }
      } else if (typeof value === "object" && !Array.isArray(value)) {
        const nested = flattenNestedObject(
          value as Record<string, unknown>,
          propSchema,
          rootSchema,
          `${key}_`,
        );
        Object.assign(properties, nested.properties);
        Object.assign(connects, nested.connects);
      }
      continue;
    }

    // Entity reference (object with @id in schema) — use Prisma connect/disconnect
    if (isEntityReferenceSchema(propSchema)) {
      if (value === null) {
        connects[key] = { disconnect: true };
      } else if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        value !== null &&
        "@id" in value
      ) {
        const id = (value as Record<string, string>)["@id"];
        connects[key] = { connect: { id: IRItoId ? IRItoId(id) : id } };
      }
      continue;
    }

    // Array property
    if (propSchema.type === "array" && Array.isArray(value)) {
      const itemSchema = propSchema.items
        ? resolvePropertySchema(
            propSchema.items as JSONSchema7Definition,
            rootSchema,
          )
        : undefined;

      if (itemSchema && isEntityReferenceSchema(itemSchema)) {
        // Array of entity references — use Prisma set to replace all connections
        const ids = value
          .filter(
            (item): item is Record<string, string> =>
              typeof item === "object" && item !== null && "@id" in item,
          )
          .map((item) => ({
            id: IRItoId ? IRItoId(item["@id"]) : item["@id"],
          }));
        connects[key] = { set: ids };
      } else {
        // Array of scalars — direct property update
        properties[key] = value;
      }
      continue;
    }

    // Scalar property — direct update
    properties[key] = value;
  }

  return { properties, connects };
}

/**
 * Partially update specific properties of an entity in a Prisma store.
 *
 * Uses the JSON Schema as the single source of truth to determine how each
 * property maps to the Prisma data model (scalar column, flattened nested
 * object, or relation connect/disconnect).
 *
 * @param typeName - Prisma model name
 * @param entityIRI - IRI (or ID) of the entity to patch
 * @param data - Partial data with property names as keys
 * @param schema - JSON Schema for the entity type (brought to top level)
 * @param rootSchema - Root schema for $ref resolution
 * @param prisma - Prisma client instance
 * @param options - Optional validator, IRI conversion, debug
 */
export const patchPrisma = async (
  typeName: string,
  entityIRI: string,
  data: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  prisma: any,
  options: PrismaPatchOptions = {},
): Promise<void> => {
  const { validator, IRItoId, debug } = options;

  // Filter out JSON-LD metadata
  const dataKeys = Object.keys(data).filter((k) => !k.startsWith("@"));
  if (dataKeys.length === 0) return;

  // Validate against schema
  const validationErrors = validatePatchData(
    data,
    schema,
    rootSchema,
    validator,
  );
  if (validationErrors.length > 0) {
    throw new Error(
      `Patch validation failed: ${validationErrors.map((e) => `${e.property}: ${e.message}`).join("; ")}`,
    );
  }

  const entityId = IRItoId ? IRItoId(entityIRI) : entityIRI;

  // Check entity exists
  const existing = await prisma[typeName].findUnique({
    where: { id: entityId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error(`Entity does not exist: ${entityIRI} (type: ${typeName})`);
  }

  const { properties, connects } = buildPrismaUpdatePayload(
    data,
    schema,
    rootSchema,
    IRItoId,
  );

  // Build the Prisma update object
  const updateData: Record<string, unknown> = { ...properties };

  // Add relation operations
  for (const [key, operation] of Object.entries(connects)) {
    updateData[key] = operation;
  }

  if (Object.keys(updateData).length === 0) return;

  try {
    await prisma[typeName].update({
      where: { id: entityId },
      data: updateData,
    });
  } catch (e) {
    if (debug) {
      console.error("Prisma patch failed:", typeName, entityId, e);
    }
    throw new Error("Failed to execute partial update - Prisma update failed", {
      cause: e,
    });
  }
};
